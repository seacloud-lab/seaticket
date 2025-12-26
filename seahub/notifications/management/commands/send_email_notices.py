# encoding: utf-8
import datetime
import logging
import json
import re

from django.core.management.base import BaseCommand
from django.utils.html import escape
from django.utils import translation
from django.utils import timezone
from django.utils.translation import gettext as _

from seahub.avatar.templatetags.avatar_tags import avatar
from seahub.notifications.signal_handler import MSG_TYPE_ADD_USER_TO_GROUP, MSG_TYPE_TICKET_ASSIGNEE_ADDED, MSG_TYPE_TICKET_COMMENTED
from seahub.notifications.models import UserNotification, ProjectNotification
from seahub.utils import send_html_email, get_site_scheme_and_netloc
from seahub.avatar.util import get_default_avatar_url
from seahub.base.accounts import User
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.profile.models import Profile
from seahub.constants import HASH_URLS
from seahub.utils import get_site_name
from seahub.options.models import UserOptions, KEY_COLLABORATE_EMAIL_INTERVAL, \
    KEY_COLLABORATE_LAST_EMAILED_TIME, COLLABORATE_EMAIL_INTERVAL_DEFAULT
from seahub.utils.auth import VIRTUAL_ID_EMAIL_DOMAIN

# Get an instance of a logger
logger = logging.getLogger('seahub_email_sender')

class Command(BaseCommand):
    help = 'Send Email notifications to user if he/she has an unread notices every period of seconds .'
    label = "notifications_send_notices"

    def handle(self, *args, **options):
        logger.debug('Start sending user notices...')
        self.do_action()
        logger.debug('Finish sending user notices.\n')

    def get_avatar(self, username):
        img_tag = avatar(username, 128)
        pattern = r'src="(.*)"'
        repl = r'src="%s\1"' % get_site_scheme_and_netloc()
        return re.sub(pattern, repl, img_tag)

    def get_avatar_src(self, username):
        avatar_img = self.get_avatar(username)
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

    def _format_add_user_to_group_msg(self, notice):
        d = json.loads(notice.detail) if notice.detail else {}

        group_name = d.get('group_name') or ''
        group_staff_name = d.get('group_staff_name') or ''
        group_staff_email = d.get('group_staff_email') or ''

        staff_display = escape(group_staff_name or email2nickname(group_staff_email) or group_staff_email)
        group_display = escape(group_name)

        return _('User %(user)s has added you to group %(group_name)s.') % {
            'user': staff_display,
            'group_name': group_display,
        }

    def _format_ticket_assignee_added_msg(self, notice):
        d = json.loads(notice.detail) if notice.detail else {}

        ticket_id = d.get('ticket_id')
        ticket_title = d.get('ticket_title') or ''
        from_user_name = d.get('from_user_name') or ''
        workspace_id = d.get('workspace_id')
        project_name = d.get('project_name') or ''

        ticket_url = ''
        if ticket_id is not None and workspace_id is not None and project_name:
            ticket_url = '%s/workspace/%s/project/%s/tickets/%s/' % (
                get_site_scheme_and_netloc(), workspace_id, project_name, ticket_id)

        user_display = escape(from_user_name)
        title_display = escape(ticket_title)
        if ticket_url:
            return _('%(user)s assigned you a ticket: <a href="%(ticket_url)s">%(title)s</a>.') % {
                'user': user_display,
                'ticket_url': ticket_url,
                'title': title_display,
            }
        return _('%(user)s assigned you a ticket: %(title)s.') % {
            'user': user_display,
            'title': title_display,
        }

    def _format_ticket_commented_msg(self, notice):
        d = json.loads(notice.detail) if notice.detail else {}

        ticket_id = d.get('ticket_id')
        ticket_title = d.get('ticket_title') or ''
        from_user_name = d.get('from_user_name') or ''
        workspace_id = d.get('workspace_id')
        project_name = d.get('project_name') or ''
        comment_content = d.get('comment_content') or ''

        ticket_url = ''
        if ticket_id is not None and workspace_id is not None and project_name:
            ticket_url = '%s/workspace/%s/project/%s/tickets/%s/' % (
                get_site_scheme_and_netloc(), workspace_id, project_name, ticket_id)

        user_display = escape(from_user_name)
        title_display = escape(ticket_title)
        comment_display = escape(comment_content)
        if ticket_url:
            base_msg = _('%(user)s commented on ticket <a href="%(ticket_url)s">%(title)s</a>.') % {
                'user': user_display,
                'ticket_url': ticket_url,
                'title': title_display,
            }
        else:
            base_msg = _('%(user)s commented on ticket %(title)s.') % {
                'user': user_display,
                'title': title_display,
            }
        if comment_display:
            return '%s <br /> comment: %s' % (base_msg, comment_display)
        return base_msg

    def format_notice_item(self, notice):
        msg = ''
        avatar_src = self.get_default_avatar_src()

        if isinstance(notice, UserNotification):
            if notice.msg_type == MSG_TYPE_ADD_USER_TO_GROUP:
                msg = self._format_add_user_to_group_msg(notice)
                try:
                    d = json.loads(notice.detail) if notice.detail else {}
                    staff_email = d.get('group_staff_email')
                    if staff_email:
                        avatar_src = self.get_avatar_src(staff_email)
                except Exception:
                    pass
            else:
                msg = escape(str(notice.detail or ''))

        elif isinstance(notice, ProjectNotification):
            if notice.msg_type == MSG_TYPE_TICKET_ASSIGNEE_ADDED:
                msg = self._format_ticket_assignee_added_msg(notice)
            elif notice.msg_type == MSG_TYPE_TICKET_COMMENTED:
                msg = self._format_ticket_commented_msg(notice)
            else:
                msg = escape(str(notice.detail or ''))

            try:
                d = json.loads(notice.detail) if notice.detail else {}
                from_user_id = d.get('from_user_id')
                if from_user_id:
                    avatar_src = self.get_avatar_src(from_user_id)
            except Exception:
                pass
        else:
            msg = escape(str(getattr(notice, 'detail', '') or ''))

        item = NoticeItem()
        item.msg = msg
        item.avatar_src = avatar_src
        item.timestamp = notice.timestamp
        return item

    def get_user_language(self, username):
        return Profile.objects.get_user_language(username)

    def get_user_intervals_and_notices(self):
        """
        filter users who have collaborate-notices in last longest interval
        And right now, the longest interval is COLLABORATE_EMAIL_INTERVAL_DEFAULT
        """

        last_longest_interval_time = timezone.now() - datetime.timedelta(
            seconds=COLLABORATE_EMAIL_INTERVAL_DEFAULT)

        all_unseen_notices = UserNotification.objects.filter(
            seen=False, timestamp__gt=last_longest_interval_time).order_by('-timestamp')
        all_unseen_project_notices = ProjectNotification.objects.filter(
            seen=False, timestamp__gt=last_longest_interval_time).order_by('-timestamp')

        results = {}
        for notice in all_unseen_notices:
            if notice.to_user not in results:
                results[notice.to_user] = {'notices': [notice],
                                           'interval': COLLABORATE_EMAIL_INTERVAL_DEFAULT}
            else:
                results[notice.to_user]['notices'].append(notice)

        for project_notice in all_unseen_project_notices:
            if project_notice.to_user not in results:
                results[project_notice.to_user] = {'notices': [project_notice],
                                                  'interval': COLLABORATE_EMAIL_INTERVAL_DEFAULT}
            else:
                results[project_notice.to_user]['notices'].append(project_notice)

        user_options = UserOptions.objects.filter(
            email__in=results.keys(), option_key=KEY_COLLABORATE_EMAIL_INTERVAL)
        for option in user_options:
            email, interval = option.email, option.option_val
            try:
                interval = int(interval)
            except ValueError:
                logger.warning('user: %s, %s invalid, val: %s', email, KEY_COLLABORATE_EMAIL_INTERVAL, interval)
                interval = COLLABORATE_EMAIL_INTERVAL_DEFAULT
            if interval <= 0:
                del results[email]
            else:
                results[email]['interval'] = interval

        return [(key, value['interval'],
                 value['notices']) for key, value in results.items()]

    def do_action(self):

        user_interval_notices = self.get_user_intervals_and_notices()
        last_emailed_list = UserOptions.objects.filter(option_key=KEY_COLLABORATE_LAST_EMAILED_TIME).values_list('email', 'option_val')
        user_last_emailed_time_dict = {}
        for le in last_emailed_list:
            try:
                dt = datetime.datetime.strptime(le[1], "%Y-%m-%d %H:%M:%S")
                if timezone.is_naive(dt):
                    dt = timezone.make_aware(dt, timezone.utc)
                user_last_emailed_time_dict[le[0]] = dt
            except Exception:
                continue

        # check if to_user active
        user_active_dict = {}
        for (to_user, interval_val, notices) in user_interval_notices:

            if to_user in user_active_dict:
                continue
            else:
                try:
                    to_user_obj = User.objects.get(email=to_user)
                except User.DoesNotExist:
                    user_active_dict[to_user] = False
                    continue

                user_active_dict[to_user] = to_user_obj.is_active

        # save current language
        cur_language = translation.get_language()
        for (to_user, interval_val, notices) in user_interval_notices:

            if not user_active_dict[to_user]:
                continue

            contact_email = Profile.objects.get_contact_email_by_user(to_user)
            if not contact_email or VIRTUAL_ID_EMAIL_DOMAIN in contact_email:
                continue

            # get last_emailed_time if any, defaults to today 00:00:00.0
            last_emailed_time = user_last_emailed_time_dict.get(to_user, None)
            now = timezone.now().replace(microsecond=0)
            if not last_emailed_time:
                last_emailed_time = now.replace(hour=0, minute=0, second=0, microsecond=0)
            else:
                if (now - last_emailed_time).total_seconds() < interval_val:
                    continue

            def _notice_is_newer(n):
                ts = n.timestamp
                if timezone.is_naive(ts):
                    ts = timezone.make_aware(ts, timezone.utc)
                return ts > last_emailed_time

            user_notices = list(filter(_notice_is_newer, notices))
            if not user_notices:
                continue

            # get and active user language
            user_language = self.get_user_language(to_user)
            translation.activate(user_language)
            logger.info('Set language code to %s for user: %s' % (
                user_language, to_user))
            self.stdout.write('[%s] [INFO] Set language code to %s for user: %s' % (
                str(datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')), user_language, to_user))

            # format mail content and send
            notices = list(map(self.format_notice_item, user_notices))

            user_name = email2nickname(to_user)
            c = {
                'to_user': contact_email,
                'notice_count': len(notices),
                'notices': notices,
                'user_name': user_name,
                }

            try:
                send_html_email(_('New notice on %s') % get_site_name(),
                                'notifications/notice_email.html', c,
                                None, [contact_email])
                # set new last_emailed_time
                UserOptions.objects.set_collaborate_last_emailed_time(to_user, now)
                logger.info('Successfully sent email to %s' % contact_email)
                self.stdout.write('[%s] [INFO] Successfully sent email to %s' % (str(datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')), contact_email))
            except Exception as e:
                logger.error('Failed to send email to %s, error detail: %s' % (contact_email, e))
                self.stderr.write('[%s] [ERROR] Failed to send email to %s, error detail: %s' % (str(datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')), contact_email, e))

            # restore current language
            translation.activate(cur_language)


class NoticeItem(object):
    pass
