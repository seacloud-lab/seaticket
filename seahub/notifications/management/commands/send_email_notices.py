# Copyright (c) 2012-2016 Seafile Ltd.
# encoding: utf-8
from datetime import datetime
import logging
import re

from django.core.management.base import BaseCommand
from django.utils import translation
from django.utils.translation import gettext as _

from seahub.dtable.models import DTables, DTableExternalApps
from seahub.utils import send_html_email, get_site_scheme_and_netloc
from seahub.avatar.templatetags.avatar_tags import avatar
from seahub.avatar.util import get_default_avatar_url
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.profile.models import Profile
from seahub.utils import get_site_name
from seahub.notifications.utils import format_dtable_notice, get_users_detail, \
    get_and_update_last_check, get_unseen_notices, get_unseen_notices_in_dtable, \
    get_unseen_notices_in_app, get_app_url, format_app_notice
from seahub.utils.timeutils import utc_to_local

# Get an instance of a logger
logger = logging.getLogger(__name__)


class DtableNoticeItem(object):
    pass


class CommandLogMixin(object):
    def println(self, msg):
        self.stdout.write('[%s] %s\n' % (str(datetime.now()), msg))

    def log_error(self, msg):
        logger.error(msg)
        self.println(msg)

    def log_info(self, msg):
        logger.info(msg)
        self.println(msg)

    def log_debug(self, msg):
        logger.debug(msg)
        self.println(msg)


#######################################


class Command(BaseCommand, CommandLogMixin):
    help = 'Send Email notifications to user if he/she has an unread notices every period of time.'
    label = "send_email_notices"
    dtable_label = "send_email_dtable_notices"
    app_label = "send_email_app_notices"

    def handle(self, *args, **options):
        self.log_debug('Start sending user email notices...')
        self.do_action()
        self.log_debug('Finish sending user email notices.\n')

    def get_avatar(self, username, default_size=32):
        img_tag = avatar(username, default_size)
        pattern = r'src="(.*)"'
        repl = r'src="%s\1"' % get_site_scheme_and_netloc()
        return re.sub(pattern, repl, img_tag)

    def get_avatar_src(self, username, default_size=32):
        avatar_img = self.get_avatar(username, default_size)
        m = re.search('<img src="(.*?)".*', avatar_img)
        if m:
            return m.group(1)
        else:
            return ''

    def get_default_avatar(self, default_size=32):
        # user default avatar
        img_tag = """<img src="%s" width="%s" height="%s" class="avatar" alt="" />""" % \
                (get_default_avatar_url(), default_size, default_size)
        pattern = r'src="(.*)"'
        repl = r'src="%s\1"' % get_site_scheme_and_netloc()
        return re.sub(pattern, repl, img_tag)

    def get_default_avatar_src(self, default_size=32):
        avatar_img = self.get_default_avatar(default_size)
        m = re.search('<img src="(.*?)".*', avatar_img)
        if m:
            return m.group(1)
        else:
            return ''

    def get_user_language(self, username):
        return Profile.objects.get_user_language(username)

    def do_action(self):  # todo: complete send-notices-email code, make it works
        # start

        # 1. get all unseen notifications
        now = datetime.now()
        # get previous time that command last runs
        last_check = get_and_update_last_check(self.label, now)
        self.log_debug('Last check time is %s, update to %s' % (last_check, now))

        notices_map, notices_queryset = get_unseen_notices(last_check)
        self.log_debug('Found %d notices' % notices_queryset.count())


        # 2. get all unseen notifications in a dtable
        dtable_now = datetime.utcnow()
        # get previous time that command last runs
        dtable_last_check = get_and_update_last_check(self.dtable_label, dtable_now)
        self.log_debug('DTable last check time is UTC %s, update to UTC %s' % (dtable_last_check, dtable_now))

        dtable_notices_map, dtable_notices_list = get_unseen_notices_in_dtable(dtable_last_check)
        self.log_debug('Found %d dtable notices' % len(dtable_notices_list))

        # get all unseen notifications in app
        app_now = datetime.now()
        # get previous time that command last runs
        app_last_check = get_and_update_last_check(self.app_label, app_now)
        self.log_debug('App last check time is UTC %s, update to UTC %s' % (app_last_check, app_now))

        app_notices_map, app_notices_list = get_unseen_notices_in_app(app_last_check)
        self.log_debug('Found %d app notices' % len(app_notices_list))

        if not notices_map and not dtable_notices_map and not app_notices_map:
            return

        # 3. get users who who has contact email
        user_list = list(notices_map.keys() | dtable_notices_map.keys() | app_notices_map.keys())
        user_map = get_users_detail(user_list, self.log_debug)
        self.log_debug('Found %d users to send email' % len(list(user_map.keys())))
        if not user_map:
            return

        avatar_src = self.get_default_avatar_src()

        # 4. send notices to users
        for to_user in user_map:
            nickname = email2nickname(to_user)
            contact_email = user_map[to_user].get('contact_email')
            notices = notices_map.get(to_user, [])
            dtable_notices = dtable_notices_map.get(to_user, [])
            app_notices = app_notices_map.get(to_user, [])
            if not notices and not dtable_notices and not app_notices:
                continue

            # save current language
            cur_language = translation.get_language()
            # get and active user language
            user_language = self.get_user_language(to_user)
            translation.activate(user_language)
            self.log_debug('Set language code to %s for user: %s, %s' % (user_language, nickname, contact_email))

            if notices:
                formatted_notices = []
                for notice in notices:
                    msg = notice.format_msg(include_detail_link=True)
                    if not msg:
                        continue
                    notice.msg = msg
                    notice.avatar_src = avatar_src
                    formatted_notices.append(notice)

                if not formatted_notices:
                    continue

                self.log_debug('Send email notice to user: %s, %s' % (nickname, contact_email))
                c = {
                    'to_user': contact_email,
                    'name': nickname,
                    'num': len(formatted_notices),
                    'notices': formatted_notices,
                    }

                try:
                    send_html_email(_('New notice on %s') % get_site_name(),
                                    'notifications/notice_email.html', c,
                                    None, [contact_email])

                    self.log_debug('Successfully sent email notice to %s' % contact_email)
                except Exception as e:
                    self.log_error('Failed to send email notice to %s, error detail: %s' % (contact_email, e))

            if dtable_notices:
                formatted_notices = []
                dtable_uuids = set([notice[2] for notice in dtable_notices])
                dtable_queryset = DTables.objects.filter(uuid__in=dtable_uuids)
                for notice in dtable_notices:
                    dtable = dtable_queryset.filter(uuid=notice[2]).first()
                    if not dtable:
                        continue
                    msg = format_dtable_notice(notice, dtable, include_detail_link=True)
                    if not msg:
                        continue
                    item = DtableNoticeItem()
                    item.msg = msg
                    item.avatar_src = avatar_src
                    item.timestamp = utc_to_local(notice[4])
                    formatted_notices.append(item)

                if not formatted_notices:
                    continue

                self.log_debug('Send email dtable notice to user: %s, %s' % (nickname, contact_email))
                c = {
                    'to_user': contact_email,
                    'name': nickname,
                    'num': len(formatted_notices),
                    'notices': formatted_notices,
                }

                try:
                    send_html_email(_('New table notifications on %s') % get_site_name(),
                                    'notifications/dtable_notice_email.html', c,
                                    None, [contact_email])

                    self.log_debug('Successfully sent email dtable notice to %s' % contact_email)
                except Exception as e:
                    self.log_error('Failed to send email dtable notice to %s, error detail: %s' % (contact_email, e))

            if app_notices:
                formatted_notices = []
                app_ids = set([notice.app.id for notice in app_notices])
                app_queryset = DTableExternalApps.objects.filter(id__in=app_ids)
                for notice in app_notices:
                    app = app_queryset.filter(id=notice.app.id).first()
                    if not app:
                        continue
                    msg = format_app_notice(notice, app, include_detail_link=True)
                    if not msg:
                        continue
                    item = DtableNoticeItem()
                    item.msg = msg
                    item.avatar_src = avatar_src
                    item.timestamp = notice.created_at
                    formatted_notices.append(item)

                if not formatted_notices:
                    continue

                self.log_debug('Send email app notice to user: %s, %s' % (nickname, contact_email))
                c = {
                    'to_user': contact_email,
                    'name': nickname,
                    'num': len(formatted_notices),
                    'notices': formatted_notices,
                }

                try:
                    send_html_email(_('New app notifications on %s') % get_site_name(),
                                    'notifications/dtable_notice_email.html', c,
                                    None, [contact_email])

                    self.log_debug('Successfully sent email app notice to %s' % contact_email)
                except Exception as e:
                    self.log_error('Failed to send email app notice to %s, error detail: %s' % (contact_email, e))

            # restore current language
            translation.activate(cur_language)
