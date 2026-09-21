import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from seahub.base.accounts import User
from seahub.auth.models import EmailUser
from seahub.organizations.models import OrgSettings, OrgUser, Organization
from seahub.profile.models import Profile
from seahub.project.models import Workspaces


@pytest.mark.django_db
def test_init_first_team_creates_team_administrator_and_workspace():
    call_command(
        'init_first_team',
        team_name='Support Team',
        admin_email='admin@example.com',
        admin_password='secret',
    )

    organization = Organization.objects.get(org_name='Support Team')
    profile = Profile.objects.get(contact_email='admin@example.com')
    user = EmailUser.objects.get(email=profile.user)

    assert user.is_staff is False
    assert user.is_active is True
    assert OrgUser.objects.get(org_id=organization.org_id, email=user.email).is_staff is True
    assert OrgSettings.objects.get(org_id=organization.org_id).role == 'free'
    assert Workspaces.objects.get(owner=user.email).org_id == organization.org_id


@pytest.mark.django_db
def test_init_first_team_is_idempotent():
    call_command(
        'init_first_team',
        team_name='Original Team',
        admin_email='admin@example.com',
        admin_password='secret',
    )
    call_command(
        'init_first_team',
        team_name='Replacement Team',
        admin_email='other@example.com',
        admin_password='other-secret',
    )

    assert Organization.objects.count() == 1
    assert Organization.objects.get().org_name == 'Original Team'
    assert Profile.objects.filter(contact_email='other@example.com').exists() is False


@pytest.mark.django_db
def test_init_first_team_rejects_existing_administrator_email():
    User.objects.create_user('admin@example.com', 'secret', is_staff=False, is_active=True)

    with pytest.raises(CommandError, match='already belongs to an existing user'):
        call_command(
            'init_first_team',
            team_name='Support Team',
            admin_email='admin@example.com',
            admin_password='secret',
        )

    assert Organization.objects.count() == 0
