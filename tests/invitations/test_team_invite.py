from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest
from django.http import HttpResponse
from django.test import RequestFactory

from seahub.api2.endpoints.org_admin.users import OrgAdminInviteUsers
from seahub.base.accounts import User
from seahub.invitations.models import Invitation
from seahub.invitations.views import token_view


@pytest.mark.django_db
def test_token_view_rejects_mismatched_password_confirmation():
    invitation = Invitation.objects.add(
        inviter='admin@example.com',
        accepter='member@example.com',
    )
    request = RequestFactory().post(
        f'/invitations/{invitation.token}/',
        {'password': 'Password123!', 'password2': 'Different123!'},
    )

    captured = {}

    def fake_render(_request, template, context):
        captured['template'] = template
        captured['context'] = context
        return HttpResponse('passwords mismatch')

    with patch('seahub.invitations.views.messages.error') as mock_error, \
            patch('seahub.invitations.views.render', fake_render):
        response = token_view(request, invitation.token)

    assert response.status_code == 200
    assert captured['template'] == 'invitations/token_view.html'
    assert captured['context']['iv'] == invitation
    mock_error.assert_called_once()
    assert "Passwords don't match" in str(mock_error.call_args.args[1])


@pytest.mark.django_db
def test_token_view_accepts_invitation_and_activates_user_on_matching_passwords():
    invitation = Invitation.objects.add(
        inviter='admin@example.com',
        accepter='member@example.com',
    )
    request = RequestFactory().post(
        f'/invitations/{invitation.token}/',
        {'password': 'Password123!', 'password2': 'Password123!'},
    )
    user = Mock(username='virtual-member', is_active=False)
    inviter_org = SimpleNamespace(org_id=31)

    with patch('seahub.auth.utils.get_virtual_id_by_email', return_value='virtual-member'), \
            patch('seahub.invitations.views.User') as mock_user_cls, \
            patch('seahub.invitations.views.authenticate', return_value=user) as mock_authenticate, \
            patch('seahub.invitations.views.auth_login') as mock_auth_login, \
            patch('seahub.invitations.views.Organization') as mock_org_cls, \
            patch('seahub.invitations.views.Workspaces') as mock_workspaces_cls, \
            patch('seahub.invitations.views.org_member_invite_accepted') as mock_signal:
        mock_user_cls.DoesNotExist = User.DoesNotExist
        mock_user_cls.objects.get.return_value = user
        mock_org_cls.objects.get_org_by_username.return_value = inviter_org
        mock_workspaces_cls.objects.get_workspace_by_owner.return_value = None

        response = token_view(request, invitation.token)

    invitation.refresh_from_db()
    assert response.status_code == 302
    assert user.set_password.call_args.args == ('Password123!',)
    assert user.is_active is True
    user.save.assert_called_once()
    assert invitation.accept_time is not None
    mock_workspaces_cls.objects.create_workspace.assert_called_once_with(user.username, inviter_org.org_id)
    mock_authenticate.assert_called_once_with(username=user.username, password='Password123!')
    mock_auth_login.assert_called_once_with(request, user)
    mock_signal.send.assert_called_once()


class _InviteRequestData:
    def __init__(self, emails):
        self._emails = emails

    def getlist(self, key, default=None):
        if key == 'email':
            return self._emails
        return default


def test_org_admin_invite_rolls_back_created_user_when_email_send_fails():
    request = SimpleNamespace(
        data=_InviteRequestData(['member@example.com']),
        user=SimpleNamespace(
            username='admin@example.com',
            org=SimpleNamespace(org_id=31, url_prefix='team-a'),
        ),
    )
    new_user = Mock(username='virtual-member')
    invitation = Mock()
    invitation.send_to.return_value = False

    with patch('seahub.api2.endpoints.org_admin.users.IS_EMAIL_CONFIGURED', True), \
            patch('seahub.api2.endpoints.org_admin.users.ORG_MEMBER_QUOTA_ENABLED', False), \
            patch('seahub.api2.endpoints.org_admin.users.Organization') as mock_org, \
            patch('seahub.api2.endpoints.org_admin.users.User') as mock_user_cls, \
            patch('seahub.api2.endpoints.org_admin.users.get_virtual_id_by_email', return_value='member@example.com'), \
            patch('seahub.api2.endpoints.org_admin.users.set_org_user') as mock_set_org_user, \
            patch('seahub.api2.endpoints.org_admin.users.unset_org_user') as mock_unset_org_user, \
            patch('seahub.api2.endpoints.org_admin.users.Invitation') as mock_invitation_cls:
        mock_org.objects.get_org_by_id.return_value = SimpleNamespace(org_id=31)
        mock_org.objects.get_org_users_by_url_prefix.return_value = []
        mock_user_cls.DoesNotExist = User.DoesNotExist
        mock_user_cls.objects.get.side_effect = User.DoesNotExist
        mock_user_cls.objects.create_user.return_value = new_user
        mock_invitation_cls.objects.add.return_value = invitation

        response = OrgAdminInviteUsers().post(request, org_id='31')

    assert response.status_code == 200
    assert response.data['success'] == []
    assert response.data['failed'][0]['email'] == 'member@example.com'
    mock_set_org_user.assert_called_once_with(31, new_user.username)
    invitation.delete.assert_called_once()
    mock_unset_org_user.assert_called_once_with(31, new_user.username)
    new_user.delete.assert_called_once()
