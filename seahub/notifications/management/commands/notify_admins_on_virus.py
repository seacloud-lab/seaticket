# Copyright (c) 2012-2016 Seafile Ltd.
# encoding: utf-8
import logging

from django.core.management.base import BaseCommand
from django.utils import translation
from django.utils.translation import gettext as _
import seaserv

from seahub.profile.models import Profile
from seahub.utils.mail import send_html_email_with_dj_template
from seahub.utils import get_site_name

# Get an instance of a logger
logger = logging.getLogger(__name__)


class Command(BaseCommand):

    help = 'Send Email notifications to admins if there are virus files detected .'
    label = "notifications_notify_admins_on_virus"

    def get_user_language(self, username):
        return Profile.objects.get_user_language(username)

    def handle(self, *args, **options):

        self.email_admins()

    def email_admins(self):
        db_users = seaserv.get_emailusers('DB', -1, -1)

        admins = []
        for user in db_users:
            if user.is_staff:
                admins.append(user)

        profiles = list(Profile.objects.filter(user__in=[u.email for u in admins]))

        for u in admins:
            # save current language
            cur_language = translation.get_language()

            # get and active user language
            user_language = self.get_user_language(u.email)
            translation.activate(user_language)

            profile = next(filter(lambda profile: profile.user == u.email, profiles), None)

            if not profile or not profile.contact_email:
                continue

            send_html_email_with_dj_template(profile.contact_email,
                                             subject=_('Virus detected on %s') % get_site_name(),
                                             dj_template='notifications/notify_virus.html')

            # restore current language
            translation.activate(cur_language)
