import json
from datetime import datetime, timezone
from unittest.mock import Mock, patch

import pytest
import pytz
from django.contrib.auth.models import AnonymousUser

from seahub.portal.apis import PortalCustomerMemberView, PortalCustomerMembersView, PortalCustomerView, PortalCustomersView, PortalExternalInvitationsView, \
    PortalExternalLoginSendCodeView, PortalExternalUsersView, PortalIssueCommentsView, PortalIssueView, PortalIssuesView, PortalMyIssuesView, \
    PortalTeamIssuesView
from seahub.portal.files import PortalFileView
from seahub.portal.models import PortalCustomer, PortalExternalInvitation, ProjectExternalUser
from seahub.portal.views import portal_external_invitation_accept_view
from seahub.project.view_utils import view_data_2_sql
from seahub.seadb_models.utils import list_my_portal_issues


def _external_request_user():
    return AnonymousUser()


def _set_external_session(request, project_uuid, username):
    request.session['portal_external_username'] = username
    request.session['portal_external_project_uuid'] = str(project_uuid)


@pytest.mark.django_db
class TestPortalCustomersView:

    def test_create_and_list_customer(self, factory, project_creator, real_project):
        project_uuid = str(real_project.uuid)
        created_at = datetime(2026, 9, 15, 1, 2, 3, tzinfo=timezone.utc)
        updated_at = datetime(2026, 9, 15, 4, 5, 6, tzinfo=timezone.utc)
        expected_created_at = '2026-09-15T01:02:03+00:00'
        expected_updated_at = '2026-09-15T04:05:06+00:00'
        request = factory.post(
            f'/api/v1/portal/{project_uuid}/customers/',
            data={'name': 'Acme'},
            format='json',
        )
        request.user = project_creator

        with patch('django.db.models.fields.timezone.now', return_value=created_at), \
                patch('seahub.utils.timeutils.current_timezone', pytz.timezone('Asia/Shanghai')):
            response = PortalCustomersView.as_view()(request, project_uuid=project_uuid)

        assert response.status_code == 201
        assert response.data['customer']['name'] == 'Acme'
        assert response.data['customer']['created_at'] == expected_created_at
        assert response.data['customer']['updated_at'] == expected_created_at
        assert 'code' not in response.data['customer']

        list_request = factory.get(f'/api/v1/portal/{project_uuid}/customers/')
        list_request.user = project_creator
        list_response = PortalCustomersView.as_view()(list_request, project_uuid=project_uuid)

        assert list_response.status_code == 200
        assert list_response.data['customers'][0]['name'] == 'Acme'
        assert list_response.data['customers'][0]['created_at'] == expected_created_at
        assert list_response.data['customers'][0]['updated_at'] == expected_created_at
        assert 'member_count' not in list_response.data['customers'][0]

        update_request = factory.put(
            f'/api/v1/portal/{project_uuid}/customers/{response.data["customer"]["id"]}/',
            data={'name': 'Acme Updated'},
            format='json',
        )
        update_request.user = project_creator
        with patch('django.db.models.fields.timezone.now', return_value=updated_at), \
                patch('seahub.utils.timeutils.current_timezone', pytz.timezone('Asia/Shanghai')):
            update_response = PortalCustomerView.as_view()(
                update_request,
                project_uuid=project_uuid,
                customer_id=response.data['customer']['id'],
            )

        assert update_response.status_code == 200
        assert update_response.data['customer']['created_at'] == expected_created_at
        assert update_response.data['customer']['updated_at'] == expected_updated_at

    def test_create_customer_without_members(self, factory, project_creator, real_project):
        project_uuid = str(real_project.uuid)
        request = factory.post(
            f'/api/v1/portal/{project_uuid}/customers/',
            data={'name': 'Acme'},
            format='json',
        )
        request.user = project_creator

        response = PortalCustomersView.as_view()(request, project_uuid=project_uuid)

        assert response.status_code == 201
        assert response.data['customer']['name'] == 'Acme'

    def test_duplicate_name_returns_conflict(self, factory, project_creator, real_project):
        PortalCustomer.objects.create(project_uuid=str(real_project.uuid), name='Acme')
        request = factory.post(
            f'/api/v1/portal/{real_project.uuid}/customers/',
            data={'name': 'Acme'},
            format='json',
        )
        request.user = project_creator

        response = PortalCustomersView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 409

    def test_delete_customer_unassigns_users_and_invitations(self, factory, project_creator, real_project):
        project_uuid = str(real_project.uuid)
        customer = PortalCustomer.objects.create(project_uuid=project_uuid, name='Acme')
        member = ProjectExternalUser.objects.create(
            email='member@example.com', username='member', project_uuid=project_uuid,
            customer_id=customer.id, activated=True,
        )
        invitation = PortalExternalInvitation.objects.add(
            project_creator.username, 'invite@example.com', project_uuid, customer.id,
        )
        request = factory.delete(f'/api/v1/portal/{project_uuid}/customers/{customer.id}/')
        request.user = project_creator

        seadb_api = Mock()
        seadb_api.query_rows.return_value = {'results': []}
        with patch('seahub.portal.apis.SeaDBAPI', return_value=seadb_api):
            response = PortalCustomerView.as_view()(
                request, project_uuid=project_uuid, customer_id=customer.id
            )

        assert response.status_code == 204
        assert not PortalCustomer.objects.filter(id=customer.id).exists()
        member.refresh_from_db()
        invitation.refresh_from_db()
        assert member.customer_id is None
        assert invitation.customer_id is None

    def test_delete_customer_soft_deletes_customer_issues(self, factory, project_creator, real_project):
        project_uuid = str(real_project.uuid)
        customer = PortalCustomer.objects.create(project_uuid=project_uuid, name='Acme')
        request = factory.delete(f'/api/v1/portal/{project_uuid}/customers/{customer.id}/')
        request.user = project_creator
        seadb_api = Mock()
        seadb_api.query_rows.return_value = {
            'results': [
                {'_pk': 10, 'linked_ticket': None},
                {'_pk': 11, 'linked_ticket': None},
            ],
        }

        with patch('seahub.portal.apis.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.portal.apis.send_portal_issue_update_msg') as notify:
            response = PortalCustomerView.as_view()(
                request, project_uuid=project_uuid, customer_id=customer.id
            )

        assert response.status_code == 204
        seadb_api.query_rows.assert_called_once()
        query_call = seadb_api.query_rows.call_args
        assert query_call[0][0] == project_uuid
        assert '`customer_id` = %s' % customer.id in query_call[0][1]
        assert 'SET `deleted`=true' in query_call[0][1]
        assert seadb_api.query_rows.call_count == 1
        seadb_api.update_rows.assert_not_called()
        seadb_api.delete_rows.assert_not_called()
        notify.assert_not_called()

    def test_rename_to_duplicate_name_returns_conflict(self, factory, project_creator, real_project):
        PortalCustomer.objects.create(project_uuid=str(real_project.uuid), name='Acme')
        customer = PortalCustomer.objects.create(project_uuid=str(real_project.uuid), name='Beta')
        request = factory.put(
            f'/api/v1/portal/{real_project.uuid}/customers/{customer.id}/',
            data={'name': 'Acme'},
            format='json',
        )
        request.user = project_creator

        response = PortalCustomerView.as_view()(
            request, project_uuid=str(real_project.uuid), customer_id=customer.id
        )

        assert response.status_code == 409

    def test_update_customer_name(self, factory, project_creator, real_project):
        project_uuid = str(real_project.uuid)
        customer = PortalCustomer.objects.create(project_uuid=project_uuid, name='Acme')
        request = factory.put(
            f'/api/v1/portal/{project_uuid}/customers/{customer.id}/',
            data={
                'name': 'Renamed customer',
            },
            format='json',
        )
        request.user = project_creator

        response = PortalCustomerView.as_view()(
            request, project_uuid=project_uuid, customer_id=customer.id
        )

        assert response.status_code == 200
        customer.refresh_from_db()
        assert customer.name == 'Renamed customer'

    def test_customer_detail_lists_active_and_inactive_members(self, factory, project_creator, real_project):
        customer = PortalCustomer.objects.create(project_uuid=str(real_project.uuid), name='Acme')
        ProjectExternalUser.objects.create(
            email='active@example.com', username='active-user', project_uuid=str(real_project.uuid),
            customer_id=customer.id, activated=True,
        )
        ProjectExternalUser.objects.create(
            email='inactive@example.com', username='inactive-user', project_uuid=str(real_project.uuid),
            customer_id=customer.id, activated=False,
        )
        request = factory.get(f'/api/v1/portal/{real_project.uuid}/customers/{customer.id}/')
        request.user = project_creator

        response = PortalCustomerMembersView.as_view()(
            request, project_uuid=str(real_project.uuid), customer_id=customer.id
        )

        assert response.status_code == 200
        assert [member['email'] for member in response.data['members']] == [
            'active@example.com', 'inactive@example.com',
        ]
        assert [member['activated'] for member in response.data['members']] == [True, False]
        assert 'joined_at' not in response.data['members'][0]

    def test_add_and_remove_customer_member(self, factory, project_creator, real_project, settings):
        settings.IS_PORTAL_MODE = True
        customer = PortalCustomer.objects.create(
            project_uuid=str(real_project.uuid), name='Acme'
        )
        member = ProjectExternalUser.objects.create(
            email='member@example.com',
            username='member',
            project_uuid=str(real_project.uuid),
            activated=True,
        )
        members_url = f'/api/v1/portal/{real_project.uuid}/customers/{customer.id}/members/'
        add_request = factory.post(members_url, data={'email': member.email}, format='json')
        add_request.user = project_creator
        with patch('seahub.portal.apis.SeaDBAPI') as seadb_api:
            add_response = PortalCustomerMembersView.as_view()(
                add_request, project_uuid=str(real_project.uuid), customer_id=customer.id
            )

        assert add_response.status_code == 200
        member.refresh_from_db()
        assert member.customer_id == customer.id
        seadb_api.assert_not_called()

        remove_url = f'{members_url}{member.id}/'
        remove_request = factory.delete(remove_url, data={'email': member.email}, format='json')
        remove_request.user = project_creator
        remove_response = PortalCustomerMemberView.as_view()(
            remove_request, project_uuid=str(real_project.uuid), customer_id=customer.id, member_id=member.id
        )

        assert remove_response.status_code == 200
        member.refresh_from_db()
        assert member.customer_id is None
        assert member.activated is True

        colleague = ProjectExternalUser.objects.create(
            email='colleague@example.com',
            username='colleague',
            project_uuid=str(real_project.uuid),
            customer_id=customer.id,
            activated=True,
        )
        issue = {'_pk': 10, 'creator': member.username, 'customer_id': customer.id}
        issue_request = factory.get(f'/api/v1/portal/{real_project.uuid}/issues/10/')
        issue_request.user = _external_request_user()
        _set_external_session(issue_request, real_project.uuid, colleague.username)
        with patch('seahub.portal.apis.get_portal_issue', return_value=(issue, [])), \
                patch('seahub.portal.apis.list_portal_issue_comments_records', return_value=(issue, [], '')):
            issue_response = PortalIssueView.as_view()(
                issue_request, project_uuid=str(real_project.uuid), issue_id=10
            )

        assert issue_response.status_code == 200

        customer_b = PortalCustomer.objects.create(project_uuid=str(real_project.uuid), name='Beta')
        reassign_request = factory.post(
            f'/api/v1/portal/{real_project.uuid}/customers/{customer_b.id}/members/',
            data={'email': member.email},
            format='json',
        )
        reassign_request.user = project_creator
        reassign_response = PortalCustomerMembersView.as_view()(
            reassign_request, project_uuid=str(real_project.uuid), customer_id=customer_b.id
        )

        assert reassign_response.status_code == 200
        member.refresh_from_db()
        assert member.customer_id == customer_b.id
        assert member.activated is True

        issue_request = factory.get(f'/api/v1/portal/{real_project.uuid}/issues/10/')
        issue_request.user = _external_request_user()
        _set_external_session(issue_request, real_project.uuid, member.username)
        with patch('seahub.portal.apis.get_portal_issue', return_value=(issue, [])):
            issue_response = PortalIssueView.as_view()(
                issue_request, project_uuid=str(real_project.uuid), issue_id=10
            )

        assert issue_response.status_code == 404

    def test_add_customer_members_in_bulk(self, factory, project_creator, real_project):
        project_uuid = str(real_project.uuid)
        customer = PortalCustomer.objects.create(project_uuid=project_uuid, name='Acme')
        members = [
            ProjectExternalUser.objects.create(
                email=f'member-{index}@example.com', username=f'member-{index}', project_uuid=project_uuid,
                activated=True,
            )
            for index in range(2)
        ]
        request = factory.post(
            f'/api/v1/portal/{project_uuid}/customers/{customer.id}/members/',
            data={'emails': [member.email for member in members] + ['missing@example.com']},
            format='json',
        )
        request.user = project_creator

        response = PortalCustomerMembersView.as_view()(
            request, project_uuid=project_uuid, customer_id=customer.id
        )

        assert response.status_code == 200
        assert {item['email'] for item in response.data['success']} == {
            member.email for member in members
        }
        assert response.data['failed'] == [{
            'email': 'missing@example.com',
            'error_msg': 'External user not found.',
        }]
        assert ProjectExternalUser.objects.filter(
            id__in=[member.id for member in members], customer_id=customer.id
        ).count() == len(members)

    def test_member_cannot_be_assigned_to_another_customer(self, factory, project_creator, real_project):
        customer_a = PortalCustomer.objects.create(project_uuid=str(real_project.uuid), name='Acme')
        customer_b = PortalCustomer.objects.create(project_uuid=str(real_project.uuid), name='Beta')
        member = ProjectExternalUser.objects.create(
            email='member@example.com',
            username='member',
            project_uuid=str(real_project.uuid),
            customer_id=customer_a.id,
            activated=False,
        )
        request = factory.post(
            f'/api/v1/portal/{real_project.uuid}/customers/{customer_b.id}/members/',
            data={'email': member.email},
            format='json',
        )
        request.user = project_creator

        response = PortalCustomerMembersView.as_view()(
            request, project_uuid=str(real_project.uuid), customer_id=customer_b.id
        )

        assert response.status_code == 409
        member.refresh_from_db()
        assert member.customer_id == customer_a.id
        assert member.activated is False

    def test_invitation_assigns_customer_only_when_accepted(self, factory, project_creator, real_project):
        customer = PortalCustomer.objects.create(project_uuid=str(real_project.uuid), name='Acme')
        member = ProjectExternalUser.objects.create(
            email='member@example.com',
            username='member',
            project_uuid=str(real_project.uuid),
            activated=True,
        )
        request = factory.post(
            f'/api/v1/portal/{real_project.uuid}/external-invitations/',
            data={'email': member.email, 'customer_id': customer.id},
            format='json',
        )
        request.user = project_creator
        with patch('seahub.portal.apis.IS_EMAIL_CONFIGURED', True), \
                patch.object(PortalExternalInvitation, 'get_link', return_value='https://portal.test/invite'), \
                patch('seahub.portal.apis.send_html_email_with_dj_template', return_value=True):
            response = PortalExternalInvitationsView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 200
        member.refresh_from_db()
        assert member.customer_id is None

        invitation = PortalExternalInvitation.objects.get(email=member.email, project_uuid=str(real_project.uuid))
        accept_request = factory.get(f'/external/accept/{invitation.token}/')
        accept_response = portal_external_invitation_accept_view(
            accept_request, invitation.token, str(real_project.uuid)
        )

        assert accept_response.status_code == 302
        member.refresh_from_db()
        invitation.refresh_from_db()
        assert member.customer_id == customer.id
        assert invitation.accepted_at is not None

    def test_existing_customer_member_cannot_receive_another_invitation(self, factory, project_creator, real_project):
        customer = PortalCustomer.objects.create(project_uuid=str(real_project.uuid), name='Acme')
        another_customer = PortalCustomer.objects.create(project_uuid=str(real_project.uuid), name='Beta')
        member = ProjectExternalUser.objects.create(
            email='member@example.com',
            username='member',
            project_uuid=str(real_project.uuid),
            customer_id=customer.id,
            activated=False,
        )
        for data in (
            {'email': member.email},
            {'email': member.email, 'customer_id': customer.id},
            {'email': member.email, 'customer_id': another_customer.id},
        ):
            request = factory.post(
                f'/api/v1/portal/{real_project.uuid}/external-invitations/',
                data=data,
                format='json',
            )
            request.user = project_creator

            response = PortalExternalInvitationsView.as_view()(request, project_uuid=str(real_project.uuid))

            assert response.status_code == 409

        assert not PortalExternalInvitation.objects.filter(
            email=member.email,
            project_uuid=str(real_project.uuid),
        ).exists()

    def test_invitation_does_not_send_email_when_external_user_creation_fails(
        self, factory, project_creator, real_project
    ):
        email = 'new-user@example.com'
        request = factory.post(
            f'/api/v1/portal/{real_project.uuid}/external-invitations/',
            data={'email': email},
            format='json',
        )
        request.user = project_creator

        with patch('seahub.portal.apis.IS_EMAIL_CONFIGURED', True), \
                patch.object(ProjectExternalUser.objects, 'create', side_effect=Exception('boom')), \
                patch.object(PortalExternalInvitation, 'get_link', return_value='https://portal.test/invite'), \
                patch('seahub.portal.apis.send_html_email_with_dj_template') as send_mail:
            response = PortalExternalInvitationsView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 500
        send_mail.assert_not_called()
        assert not PortalExternalInvitation.objects.filter(
            email=email,
            project_uuid=str(real_project.uuid),
        ).exists()

    def test_failed_invitation_email_cleans_up_new_external_user(
        self, factory, project_creator, real_project
    ):
        email = 'new-user@example.com'
        request = factory.post(
            f'/api/v1/portal/{real_project.uuid}/external-invitations/',
            data={'email': email},
            format='json',
        )
        request.user = project_creator

        with patch('seahub.portal.apis.IS_EMAIL_CONFIGURED', True), \
                patch.object(PortalExternalInvitation, 'get_link', return_value='https://portal.test/invite'), \
                patch('seahub.portal.apis.send_html_email_with_dj_template', return_value=False):
            response = PortalExternalInvitationsView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 500
        assert not ProjectExternalUser.objects.filter(
            email=email,
            project_uuid=str(real_project.uuid),
        ).exists()
        assert not PortalExternalInvitation.objects.filter(
            email=email,
            project_uuid=str(real_project.uuid),
        ).exists()

    def test_invitation_acceptance_rolls_back_on_user_update_failure(self, factory, project_creator, real_project):
        customer = PortalCustomer.objects.create(project_uuid=str(real_project.uuid), name='Acme')
        member = ProjectExternalUser.objects.create(
            email='member@example.com',
            username='member',
            project_uuid=str(real_project.uuid),
            activated=False,
        )
        invitation = PortalExternalInvitation.objects.add(
            inviter=project_creator.username,
            email=member.email,
            project_uuid=str(real_project.uuid),
            customer_id=customer.id,
        )
        request = factory.get(f'/external/accept/{invitation.token}/')
        request.user = _external_request_user()

        with patch.object(ProjectExternalUser, 'save', side_effect=Exception('boom')), \
                patch('seahub.portal.views.render_error', return_value=Mock(status_code=400)):
            response = portal_external_invitation_accept_view(request, invitation.token, str(real_project.uuid))

        assert response.status_code == 400
        member.refresh_from_db()
        invitation.refresh_from_db()
        assert member.customer_id is None
        assert member.activated is False
        assert invitation.accepted_at is None

    def test_external_user_delete_removes_user_and_pending_invitations(self, factory, project_creator, real_project):
        customer = PortalCustomer.objects.create(project_uuid=str(real_project.uuid), name='Acme')
        member = ProjectExternalUser.objects.create(
            email='member@example.com',
            username='member',
            project_uuid=str(real_project.uuid),
            customer_id=customer.id,
            activated=True,
        )
        invitation = PortalExternalInvitation.objects.add(
            inviter=project_creator.username,
            email=member.email,
            project_uuid=str(real_project.uuid),
        )
        request = factory.delete(
            f'/api/v1/portal/{real_project.uuid}/external-users/',
            data={'email': member.email},
            format='json',
        )
        request.user = project_creator

        response = PortalExternalUsersView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 200
        assert not ProjectExternalUser.objects.filter(pk=member.pk).exists()
        assert not PortalExternalInvitation.objects.filter(pk=invitation.pk).exists()

        login_request = factory.post(
            f'/api/v1/portal/{real_project.uuid}/external-login/send-code/',
            data={'email': member.email},
            format='json',
        )
        with patch('seahub.portal.apis.send_html_email_with_dj_template') as send_mail:
            login_response = PortalExternalLoginSendCodeView.as_view()(
                login_request, project_uuid=str(real_project.uuid)
            )

        assert login_response.status_code == 200
        send_mail.assert_not_called()

    def test_external_users_list_includes_inactive_customer_members(self, factory, project_creator, real_project):
        customer = PortalCustomer.objects.create(project_uuid=str(real_project.uuid), name='Acme')
        ProjectExternalUser.objects.create(
            email='inactive@example.com',
            username='inactive-user',
            project_uuid=str(real_project.uuid),
            customer_id=customer.id,
            activated=False,
        )
        request = factory.get(f'/api/v1/portal/{real_project.uuid}/external-users/')
        request.user = project_creator

        response = PortalExternalUsersView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 200
        assert response.data['users'] == [{
            'username': 'inactive-user',
            'email': 'inactive@example.com',
            'activated': False,
            'customer_id': customer.id,
            'customer_name': 'Acme',
        }]


@pytest.mark.django_db
class TestPortalCustomerIssueAccess:

    @pytest.fixture(autouse=True)
    def enable_portal_mode(self, settings, real_project):
        settings.IS_PORTAL_MODE = True

    def _create_external_member(self, project, customer, username='external-user'):
        return ProjectExternalUser.objects.create(
            email=f'{username}@example.com',
            username=username,
            project_uuid=str(project.uuid),
            customer_id=customer.id,
            activated=True,
        )

    def test_external_issue_creation_uses_server_customer(self, factory, real_project):
        customer = PortalCustomer.objects.create(
            project_uuid=str(real_project.uuid),
            name='Acme',
        )
        member = self._create_external_member(real_project, customer)
        request = factory.post(
            f'/api/v1/portal/{real_project.uuid}/issues/',
            data={'title': 'Need help', 'content': json.dumps({'text': 'Details'})},
            format='multipart',
        )
        request.user = _external_request_user()
        _set_external_session(request, real_project.uuid, member.username)
        seadb_api = Mock()
        seadb_api.get_base_metadata.return_value = {'tables': []}
        seadb_api.insert_rows.return_value = {'pks': [1]}

        with patch('seahub.portal.apis.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.portal.apis.check_ticket_creation_interval', return_value=True), \
                patch('seahub.portal.apis.send_portal_issue_update_msg'):
            response = PortalIssuesView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 201
        inserted_row = seadb_api.insert_rows.call_args[0][2][0]
        assert inserted_row['customer_id'] == customer.id

    def test_team_issues_forces_customer_filter(self, factory, real_project):
        customer = PortalCustomer.objects.create(
            project_uuid=str(real_project.uuid),
            name='Acme',
        )
        member = self._create_external_member(real_project, customer)
        request = factory.post(
            f'/api/v1/portal/{real_project.uuid}/team-issues/',
            data={'view_id': 'open', 'config': json.dumps({'basic_filters': []})},
            format='multipart',
        )
        request.user = _external_request_user()
        _set_external_session(request, real_project.uuid, member.username)

        def list_issues(_seadb, _project_uuid, view_config, _username, _start, _limit):
            assert {
                'column_name': 'customer_id',
                'filter_predicate': 'equal',
                'filter_term': customer.id,
            } in view_config['basic_filters']
            return [{'_pk': 1}], []

        with patch('seahub.portal.apis.list_portal_issues_view_records', side_effect=list_issues):
            response = PortalTeamIssuesView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 200
        assert response.data['records'] == [{'_pk': 1}]

    def test_my_issues_forces_customer_filter(self, factory, real_project):
        customer = PortalCustomer.objects.create(project_uuid=str(real_project.uuid), name='Acme')
        member = self._create_external_member(real_project, customer)
        request = factory.post(
            f'/api/v1/portal/{real_project.uuid}/my-issues/',
            data={'view_id': 'open', 'config': json.dumps({'basic_filters': []})},
            format='multipart',
        )
        request.user = _external_request_user()
        _set_external_session(request, real_project.uuid, member.username)

        def list_issues(_seadb, _project_uuid, _username, _state, _start, _limit, view_config):
            assert {
                'column_name': 'customer_id',
                'filter_predicate': 'equal',
                'filter_term': customer.id,
            } in view_config['basic_filters']
            return [{'_pk': 1}], []

        with patch('seahub.portal.apis.list_my_portal_issues', side_effect=list_issues):
            response = PortalMyIssuesView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 200
        assert response.data['records'] == [{'_pk': 1}]

    def test_team_issues_rejects_internal_user(self, factory, project_creator, real_project):
        request = factory.post(
            f'/api/v1/portal/{real_project.uuid}/team-issues/', data={}, format='multipart'
        )
        request.user = project_creator

        with patch('seahub.portal.apis.list_portal_issues_view_records') as list_issues:
            response = PortalTeamIssuesView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 403
        list_issues.assert_not_called()

    def test_cross_customer_issue_detail_is_hidden(self, factory, real_project):
        customer_a = PortalCustomer.objects.create(
            project_uuid=str(real_project.uuid), name='Acme'
        )
        customer_b = PortalCustomer.objects.create(
            project_uuid=str(real_project.uuid), name='Beta'
        )
        member = self._create_external_member(real_project, customer_a)
        request = factory.get(f'/api/v1/portal/{real_project.uuid}/issues/10/')
        request.user = _external_request_user()
        _set_external_session(request, real_project.uuid, member.username)

        with patch('seahub.portal.apis.get_portal_issue', return_value=({'_pk': 10, 'customer_id': customer_b.id}, [])), \
                patch('seahub.portal.apis.list_portal_issue_comments_records') as detail_query:
            response = PortalIssueView.as_view()(request, project_uuid=str(real_project.uuid), issue_id=10)

        assert response.status_code == 404
        detail_query.assert_not_called()

    def test_same_customer_member_can_comment(self, factory, real_project):
        customer = PortalCustomer.objects.create(
            project_uuid=str(real_project.uuid), name='Acme'
        )
        member = self._create_external_member(real_project, customer, username='commenter')
        request = factory.post(
            f'/api/v1/portal/{real_project.uuid}/issues/10/comments/',
            data={'content': json.dumps({'text': 'We see this too'})},
            format='multipart',
        )
        request.user = _external_request_user()
        _set_external_session(request, real_project.uuid, member.username)
        seadb_api = Mock()
        seadb_api.insert_rows.return_value = {'pks': [20]}
        seadb_api.query_rows.return_value = {'results': [{'count': 1}]}

        with patch('seahub.portal.apis.SeaDBAPI', return_value=seadb_api), \
                patch('seahub.portal.apis.get_portal_issue', return_value=({'_pk': 10, 'customer_id': customer.id}, [])), \
                patch('seahub.portal.apis.check_portal_issue_comment_creation_interval', return_value=True):
            response = PortalIssueCommentsView.as_view()(
                request, project_uuid=str(real_project.uuid), issue_id=10
            )

        assert response.status_code == 201
        inserted_comment = seadb_api.insert_rows.call_args[0][2][0]
        assert inserted_comment['creator'] == member.username

    def test_external_creator_cannot_delete_own_issue(self, factory, real_project):
        customer = PortalCustomer.objects.create(
            project_uuid=str(real_project.uuid), name='Acme'
        )
        member = self._create_external_member(real_project, customer, username='issue-owner')
        request = factory.delete(f'/api/v1/portal/{real_project.uuid}/issues/10/')
        request.user = _external_request_user()
        _set_external_session(request, real_project.uuid, member.username)
        response = PortalIssueView.as_view()(
            request, project_uuid=str(real_project.uuid), issue_id=10
        )

        assert response.status_code == 403

    def test_disabled_customer_loses_issue_permission(self, factory, real_project):
        customer = PortalCustomer.objects.create(
            project_uuid=str(real_project.uuid),
            name='Acme',
            status=PortalCustomer.STATUS_DISABLED,
        )
        member = self._create_external_member(real_project, customer)
        request = factory.post(f'/api/v1/portal/{real_project.uuid}/team-issues/', data={}, format='multipart')
        request.user = _external_request_user()
        _set_external_session(request, real_project.uuid, member.username)

        response = PortalTeamIssuesView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 403

    def test_removed_member_loses_issue_permission(self, factory, real_project):
        customer = PortalCustomer.objects.create(project_uuid=str(real_project.uuid), name='Acme')
        member = self._create_external_member(real_project, customer)
        member.customer_id = None
        member.save(update_fields=['customer_id'])
        request = factory.post(f'/api/v1/portal/{real_project.uuid}/team-issues/', data={}, format='multipart')
        request.user = _external_request_user()
        _set_external_session(request, real_project.uuid, member.username)

        response = PortalTeamIssuesView.as_view()(request, project_uuid=str(real_project.uuid))

        assert response.status_code == 403

    def test_unassigned_external_user_cannot_access_issue_detail_route(self, factory, real_project):
        member = ProjectExternalUser.objects.create(
            email='unassigned@example.com',
            username='unassigned-user',
            project_uuid=str(real_project.uuid),
            activated=True,
        )
        request = factory.get(f'/api/v1/portal/{real_project.uuid}/issues/10/')
        request.user = _external_request_user()
        _set_external_session(request, real_project.uuid, member.username)

        with patch('seahub.portal.apis.get_portal_issue') as get_issue:
            response = PortalIssueView.as_view()(
                request,
                project_uuid=str(real_project.uuid),
                issue_id=10,
            )

        assert response.status_code == 403
        get_issue.assert_not_called()

    def test_cross_customer_attachment_is_hidden(self, factory, real_project):
        customer_a = PortalCustomer.objects.create(
            project_uuid=str(real_project.uuid), name='Acme'
        )
        customer_b = PortalCustomer.objects.create(
            project_uuid=str(real_project.uuid), name='Beta'
        )
        member = self._create_external_member(real_project, customer_a)
        request = factory.get(
            f'/file/portal/{real_project.uuid}/portal/portal-issues/10/private.png'
        )
        request.user = _external_request_user()
        _set_external_session(request, real_project.uuid, member.username)

        with patch('seahub.portal.files.get_portal_issue', return_value=({'_pk': 10, 'customer_id': customer_b.id}, [])), \
                patch('seahub.portal.files.get_project_file_head_from_s3') as file_head:
            response = PortalFileView.as_view()(
                request,
                project_uuid=str(real_project.uuid),
                file_path='portal/portal-issues/10/private.png',
            )

        assert response.status_code == 404
        file_head.assert_not_called()


def test_customer_id_is_not_returned_as_a_visible_issue_column():
    seadb_api = Mock()
    seadb_api.query_rows.return_value = {
        'results': [{'_pk': 1, 'title': 'Need help'}],
    }
    columns = [
        {'name': '_pk'},
        {'name': 'title'},
        {'name': 'state'},
        {'name': 'customer_id'},
    ]

    with patch('seahub.seadb_models.utils.get_seadb_table_columns', return_value=columns), \
            patch('seahub.seadb_models.utils.view_data_2_sql', return_value='SELECT ...') as view_data_2_sql_mock:
        records, visible_columns = list_my_portal_issues(
            seadb_api, 'project-uuid', 'external-user', 'open', 0, 100, {}
        )

    assert records == [{'_pk': 1, 'title': 'Need help'}]
    assert [column['name'] for column in visible_columns] == ['_pk', 'title', 'state']
    display_columns = view_data_2_sql_mock.call_args.args[1]
    assert [column['name'] for column in display_columns] == ['_pk', 'title', 'state', 'customer_id']
    result_columns = view_data_2_sql_mock.call_args.args[-1]
    assert [column['name'] for column in result_columns] == ['_pk', 'title', 'state']


def test_portal_issue_query_uses_customer_id_without_returning_it():
    columns = [
        {'name': '_pk', 'type': 'int64'},
        {'name': 'customer_id', 'type': 'int64'},
    ]
    sql = view_data_2_sql(
        'portal_issues',
        columns,
        {'basic_filters': [{'column_name': 'customer_id', 'filter_predicate': 'equal', 'filter_term': 7}]},
        '',
        0,
        100,
        [columns[0]],
    )

    assert 'SELECT `_pk` FROM `portal_issues`' in sql
    assert '`customer_id` = 7' in sql


@pytest.mark.django_db
def test_customer_id_cannot_be_changed_by_bulk_issue_update(factory, project_creator, real_project):
    request = factory.put(
        f'/api/v1/portal/{real_project.uuid}/issues/',
        data={'issues_data': [{'row_id': 10, 'row': {'title': 'Updated', 'customer_id': 99}}]},
        format='json',
    )
    request.user = project_creator
    seadb_api = Mock()
    seadb_api.query_rows.return_value = {'results': [{'_pk': 10, 'title': 'Original'}]}

    with patch('seahub.portal.apis.SeaDBAPI', return_value=seadb_api), \
            patch('seahub.portal.apis.send_portal_issue_update_msg'):
        response = PortalIssuesView.as_view()(request, project_uuid=str(real_project.uuid))

    assert response.status_code == 200
    updated_row = seadb_api.update_rows.call_args[0][2][0]['row']
    assert updated_row['title'] == 'Updated'
    assert 'customer_id' not in updated_row
