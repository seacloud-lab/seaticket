from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from seahub.base.accounts import User
from seahub.constants import TEAM_FREE
from seahub.organizations.models import OrgSettings, Organization
from seahub.organizations.utils import gen_org_url_prefix
from seahub.profile.models import Profile
from seahub.project.models import Workspaces


class Command(BaseCommand):
    help = 'Create the first SeaTicket team and its team administrator.'

    def add_arguments(self, parser):
        parser.add_argument('--team-name')
        parser.add_argument('--admin-email')
        parser.add_argument('--admin-password')

    def handle(self, *args, **options):
        team_name = (options['team_name'] or os.environ.get('INIT_SEATICKET_TEAM_NAME', '')).strip()
        admin_email = (options['admin_email'] or os.environ.get('INIT_SEATICKET_TEAM_ADMIN_EMAIL', '')).strip().lower()
        admin_password = options['admin_password'] or os.environ.get('INIT_SEATICKET_TEAM_ADMIN_PASSWORD', '')

        if not team_name or not admin_email or not admin_password:
            raise CommandError('Team name, administrator email, and password must not be empty.')

        if Organization.objects.exists():
            self.stdout.write('SeaTicket team already exists; skipping first team initialization.')
            return

        if Profile.objects.filter(contact_email=admin_email).exists():
            raise CommandError('The first team administrator email already belongs to an existing user.')

        url_prefix = gen_org_url_prefix(max_trial=20)
        if not url_prefix:
            raise CommandError('Unable to generate a unique team URL prefix.')

        with transaction.atomic():
            user = User.objects.create_user(
                admin_email, admin_password, is_staff=False, is_active=True
            )
            organization = Organization.objects.create_org(team_name, url_prefix, user.username)
            OrgSettings.objects.add_or_update(organization, TEAM_FREE)
            Workspaces.objects.create_workspace(user.username, organization.org_id)

        self.stdout.write(
            self.style.SUCCESS(
                'Created first SeaTicket team "%s" with administrator %s.' % (team_name, admin_email)
            )
        )
import os
