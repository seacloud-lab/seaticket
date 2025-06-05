# Copyright (c) 2012-2016 Seafile Ltd.
# encoding: utf-8
from datetime import datetime
import logging
import json

from django.core.management.base import BaseCommand
from django.core.cache import cache
from django.db import connection
from django.utils import translation
from django.utils.translation import gettext as _

from seahub.base.templatetags.seahub_tags import email2nickname, email2contact_email
from seahub.dtable.models import DTables, DTableShare, DTableGroupShare
from seahub.group.utils import get_user_groups
from seahub.options.models import (
    UserOptions, KEY_DTABLE_UPDATES_EMAIL_INTERVAL,
    KEY_DTABLE_UPDATES_LAST_EMAILED_TIME
)
from seahub.profile.models import Profile
from seahub.utils import get_site_name, send_html_email
from seahub.settings import DTABLE_WEB_SERVICE_URL
from seahub.constants import PERMISSION_PREFIX

from seaserv import ccnet_api

# Get an instance of a logger
logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Send Email notifications to user if he/she has '
    'dtable updates notices every period of seconds .'
    label = "notifications_send_dtable_updates"

    def handle(self, *args, **options):
        logger.debug('Start sending dtable updates emails...')
        self.stdout.write('[%s] Start sending dtable updates emails...' % str(datetime.now()))
        self.do_action()
        logger.debug('Finish sending dtable updates emails.\n')
        self.stdout.write('[%s] Finish sending dtable updates emails.\n\n' % str(datetime.now()))

    def get_user_language(self, username):
        return Profile.objects.get_user_language(username)

    def do_action(self):
        emails = []
        user_dtable_updates_email_intervals = []
        for ele in UserOptions.objects.filter(
                option_key=KEY_DTABLE_UPDATES_EMAIL_INTERVAL):
            try:
                user_dtable_updates_email_intervals.append(
                    (ele.email, int(ele.option_val))
                )
                emails.append(ele.email)
            except Exception as e:
                logger.error(e)
                self.stderr.write('[%s]: %s' % (str(datetime.now()), e))
                continue

        user_last_emailed_time_dict = {}
        for ele in UserOptions.objects.filter(
                option_key=KEY_DTABLE_UPDATES_LAST_EMAILED_TIME).filter(
                    email__in=emails):
            try:
                user_last_emailed_time_dict[ele.email] = datetime.strptime(
                    ele.option_val, "%Y-%m-%d %H:%M:%S")
            except Exception as e:
                logger.error(e)
                self.stderr.write('[%s]: %s' % (str(datetime.now()), e))
                continue

        for (username, interval_val) in user_dtable_updates_email_intervals:
            if not username:
                continue
            # save current language
            cur_language = translation.get_language()

            # get and active user language
            user_language = self.get_user_language(username)
            translation.activate(user_language)
            logger.debug('Set language code to %s for user: %s' % (
                user_language, username))

            # get last_emailed_time if any, defaults to today 00:00:00.0
            last_emailed_time = user_last_emailed_time_dict.get(username, None)
            now = datetime.utcnow().replace(microsecond=0)
            if not last_emailed_time:
                last_emailed_time = datetime.utcnow().replace(hour=0).replace(
                                    minute=0).replace(second=0).replace(microsecond=0)
            else:
                if (now - last_emailed_time).total_seconds() < interval_val:
                    translation.activate(cur_language)
                    continue

            # find all the user's tables and groups' tables
            uuid_list = cache.get('activities_%s' % username)
            if not uuid_list:
                groups = get_user_groups(username, return_ancestors=True)
                owner_list = [username] + ['%s@seafile_group' % group.id for group in groups]
                group_id_list = [group.id for group in groups]

                dtable_list = list(DTables.objects.filter(
                    workspace__owner__in=owner_list, deleted=False).select_related('workspace'))
                shared_to_user_tables = DTableShare.objects.filter(
                    to_user=username, dtable__deleted=False).select_related('dtable')
                shared_to_group_tables = DTableGroupShare.objects.filter(
                    group_id__in=group_id_list, dtable__deleted=False).select_related('dtable')

                uuid_list = [table.uuid.hex for table in dtable_list]
                uuid_list.extend([table.dtable.uuid.hex for table in shared_to_user_tables
                                  if PERMISSION_PREFIX not in table.permission])
                uuid_list.extend([table.dtable.uuid.hex for table in shared_to_group_tables
                                  if PERMISSION_PREFIX not in table.permission])
                cache.set('activities_%s' % username, uuid_list, 24 * 60 * 60)
            if not uuid_list:
                translation.activate(cur_language)
                continue

            # query activities
            sql = """SELECT dtable_uuid,
                     COUNT(CASE WHEN (op_type='insert_row') THEN 1 END) AS insert_row,
                     COUNT(CASE WHEN (op_type='modify_row') THEN 1 END) AS modify_row,
                     COUNT(CASE WHEN (op_type='delete_row') THEN 1 END) AS delete_row
                     FROM activities WHERE op_time > %s AND dtable_uuid IN %s
                     GROUP BY dtable_uuid ORDER BY op_time DESC"""

            with connection.cursor() as cursor:
                cursor.execute(sql, (last_emailed_time, uuid_list))
                col_names = [desc[0] for desc in cursor.description]
                results = cursor.fetchall()

            # dtable uuid map
            dtables_uuid_map = dict()
            dtables_uuid_list = list()
            for result in results:
                activity_dict = dict(zip(col_names, result))
                if activity_dict['dtable_uuid'] not in dtables_uuid_list:
                    dtables_uuid_list.append(activity_dict['dtable_uuid'])

            if not dtables_uuid_list:
                translation.activate(cur_language)
                continue

            dtables = DTables.objects.filter(uuid__in=dtables_uuid_list, deleted=False)
            for dtable in dtables:
                dtables_uuid_map[dtable.uuid.hex] = {
                    "name": dtable.name, "icon": dtable.icon,
                    "color": dtable.color, "workspace_id": dtable.workspace_id}

            activities = []
            for result in results:
                try:
                    activity_dict = dict(zip(col_names, result))
                    dtable = dtables_uuid_map.get(activity_dict['dtable_uuid'], "")
                    if not dtable:
                        continue
                    activity = dict(dtable_uuid=activity_dict['dtable_uuid'])
                    activity['dtable_name'] = dtable['name'] if dtable['name'] else ''
                    activity['dtable_icon'] = dtable['icon'] if dtable['icon'] else 'icon-worksheet'
                    activity['dtable_color'] = dtable['color'] if dtable['color'] else '#ED7109'
                    activity['insert_row'] = int(activity_dict['insert_row'])
                    activity['modify_row'] = int(activity_dict['modify_row'])
                    activity['delete_row'] = int(activity_dict['delete_row'])

                    activities.append(activity)
                    if len(activities) >= 100:
                        break
                except json.JSONDecodeError:
                    logger.warning('data format error')
                except Exception as e:
                    logger.error(e)

            if not activities:
                translation.activate(cur_language)
                continue

            c = {
                'name': email2nickname(username),
                'num': len(activities),
                'updates': activities,
                'activities_url': DTABLE_WEB_SERVICE_URL.rstrip('/') + '/activities/',
            }

            contact_email = email2contact_email(username)
            try:
                send_html_email(_('New table updates on %s') % get_site_name(),
                                'notifications/dtable_updates_email.html', c,
                                None, [contact_email])
            except Exception as e:
                logger.error('Failed to send email to %s, error detail: %s' %
                             (contact_email, e))
                self.stderr.write('[%s] Failed to send email to %s, error '
                                  'detail: %s' % (str(datetime.now()), contact_email, e))

            # last emailed time
            try:
                now = datetime.utcnow().replace(microsecond=0)
                UserOptions.objects.set_dtable_updates_last_emailed_time(
                    username, now)
            except Exception as e:
                logger.error(e)

            # reset lang
            translation.activate(cur_language)
