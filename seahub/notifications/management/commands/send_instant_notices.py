# Copyright (c) 2012-2019 Seafile Ltd.
# encoding: utf-8
from datetime import datetime, timedelta
import logging
import re
import requests
import json

from django.core.management.base import BaseCommand
from django.urls import reverse
from django.utils import translation
from django.utils.translation import gettext as _

from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.dtable.models import DTables, DTableExternalApps
from seahub.utils import get_site_scheme_and_netloc, get_site_name
from seahub.weixin.utils import weixin_notifications_check, \
    get_mp_weixin_access_token
from seahub.weixin.settings import WEIXIN_PROVIDER
from seahub.work_weixin.utils import work_weixin_notifications_check, \
    get_work_weixin_access_token
from seahub.work_weixin.settings import WORK_WEIXIN_PROVIDER
from seahub.dingtalk.settings import DINGTALK_PROVIDER
from seahub.dingtalk.utils import dingtalk_get_access_token, dingtalk_check
from seahub.notifications.utils import get_social_auth_users_detail, remove_a_element, \
    send_weixin_msg, send_work_weixin_msg, send_org_work_weixin_msg, send_org_dingtalk_msg, format_dtable_notice, \
    get_and_update_last_check, get_unseen_notices, get_unseen_notices_in_dtable, get_dtable_row_url_by_notice, \
    get_dtable_row_url, send_dingtalk_msg, get_unseen_notices_in_app, get_app_url, format_app_notice
from seahub.org_work_weixin.settings import ORG_WORK_WEIXIN_PROVIDER
from seahub.org_work_weixin.utils import org_work_weixin_check
from seahub.org_work_weixin.utils import get_corp_access_token as get_org_work_weixin_corp_access_token
from seahub.org_dingtalk.settings import ORG_DINGTALK_PROVIDER
from seahub.org_dingtalk.utils import org_dingtalk_check
from seahub.org_dingtalk.utils import get_corp_access_token as get_org_dingtalk_corp_access_token
try:
    from seahub.settings import MULTI_TENANCY
except ImportError:
    MULTI_TENANCY = False

# Get an instance of a logger
logger = logging.getLogger(__name__)

# weixin
# https://developers.weixin.qq.com/doc/offiaccount/Message_Management/Template_Message_Interface.html﻿ 
# work weixin
# https://work.weixin.qq.com/api/doc#90000/90135/90236/


class CommandLogMixin(object):
    def println(self, msg):
        self.stdout.write('[%s] %s\n' % (str(datetime.now()), msg))

    def log_error(self, msg):
        logger.error(msg)
        self.println(msg)

    def log_warning(self, msg):
        logger.warning(msg)
        self.println(msg)

    def log_info(self, msg):
        logger.info(msg)
        self.println(msg)

    def log_debug(self, msg):
        logger.debug(msg)
        self.println(msg)


#######################################


class Command(BaseCommand, CommandLogMixin):
    """ Send instant notifications by weixin or work-weixin.
    """

    help = 'Send instant notices to user if he/she has unseen notices every period of minutes.'
    label = "send_instant_notices"
    dtable_label = "send_instant_dtable_notices"
    app_label = "send_instant_app_notices"

    def handle(self, *args, **options):
        self.log_debug('Start sending instanct notices...')
        self.do_action()
        self.log_debug('Finish sending instanct notices.\n')

    def do_action(self):
        # check before start
        enable_weixin_notice = False
        enable_work_weixin_notice = False
        enable_dingtalk_notice = False
        enable_org_work_weixin_notice = False
        enable_org_dingtalk_notice = False

        if weixin_notifications_check() and get_mp_weixin_access_token():
            enable_weixin_notice = True
            self.log_debug('Start sending weixin notifications')

        if work_weixin_notifications_check() and get_work_weixin_access_token():
            enable_work_weixin_notice = True
            self.log_debug('Start sending work weixin notifications')

        if dingtalk_check():
            enable_dingtalk_notice = True
            self.log_debug('Start sending dingtalk notifications')

        if org_work_weixin_check() and MULTI_TENANCY:
            enable_org_work_weixin_notice = True
            self.log_debug('Start sending org work weixin notifications')

        if org_dingtalk_check() and MULTI_TENANCY:
            enable_org_dingtalk_notice = True
            self.log_debug('Start sending org dingtalk notifications')

        if not enable_weixin_notice \
                and not enable_work_weixin_notice \
                and not enable_dingtalk_notice \
                and not enable_org_work_weixin_notice \
                and not enable_org_dingtalk_notice:
            self.log_error(
                'Weixin and Work-Weixin and Dingtalk and Org-Work-Weixin and Org-Dingtalk notifications settings all check failed')
            return

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

        # 3. get users who are connected mp-weixin or work-weixin
        user_list = list(notices_map.keys() | dtable_notices_map.keys() | app_notices_map.keys())
        user_map = get_social_auth_users_detail(
            self.log_debug, user_list, enable_weixin_notice, enable_work_weixin_notice, enable_dingtalk_notice, enable_org_work_weixin_notice, enable_org_dingtalk_notice)
        self.log_debug('Found %d users with social auth' % len(list(user_map.keys())))
        if not user_map:
            return

        # save current language
        cur_language = translation.get_language()
        # active zh-cn
        translation.activate('zh-cn')
        self.log_debug('the language is set to zh-cn')

        detail_url = get_site_scheme_and_netloc().rstrip('/') + reverse('user_notification_list')
        site_name = get_site_name()
        dtable_notice_timedelta = timedelta(hours=8)

        # 4. send notices to users
        for to_user in user_map:
            nickname = email2nickname(to_user)
            notices = notices_map.get(to_user, [])
            dtable_notices = dtable_notices_map.get(to_user, [])
            app_notices = app_notices_map.get(to_user, [])
            if not notices and not dtable_notices and not app_notices:
                continue
            weixin_openid = user_map[to_user].get(WEIXIN_PROVIDER)
            work_weixin_uid = user_map[to_user].get(WORK_WEIXIN_PROVIDER)
            dingtalk_uid = user_map[to_user].get(DINGTALK_PROVIDER)
            org_work_weixin_uid = user_map[to_user].get(ORG_WORK_WEIXIN_PROVIDER)
            org_dingtalk_uid = user_map[to_user].get(ORG_DINGTALK_PROVIDER)
            org_work_weixin_corp_id = user_map[to_user].get('org_work_weixin_corp_id')
            org_work_weixin_agent_id = user_map[to_user].get('org_work_weixin_agent_id')
            org_dingtalk_corp_id = user_map[to_user].get('org_dingtalk_corp_id')
            org_dingtalk_agent_id = user_map[to_user].get('org_dingtalk_agent_id')
            permanent_code = user_map[to_user].get('permanent_code')

            if notices:
                title = _(
                    "\n"
                    "You've got %(num)s new notices on %(site_name)s:\n"
                ) % {'num': 1, 'site_name': site_name, }
                for notice in notices:
                    send_notice_success = False
                    msg = notice.format_msg()
                    if not msg:
                        continue
                    if notice.msg_type == 'submit_form':
                        # Link to the specific row if form submitted
                        detail = json.loads(notice.detail)
                        dtable_id = detail.get('dtable_id')
                        dtable = DTables.objects.filter(id=dtable_id).first()
                        table_id = detail.get('table_id', '')
                        row_id = detail.get('row_id', '')
                        detail_url = get_dtable_row_url(dtable, tid=table_id, row_id=row_id) if dtable else detail_url

                    if not send_notice_success and enable_org_work_weixin_notice and org_work_weixin_uid:
                        access_token = get_org_work_weixin_corp_access_token(org_work_weixin_corp_id, permanent_code)
                        content = remove_a_element(msg)
                        self.log_debug(
                            'Send work weixin notice to user: %s, %s, msg: %s' % (nickname, to_user, content))
                        api_response_dic = send_org_work_weixin_msg(
                            org_work_weixin_agent_id, org_work_weixin_uid, access_token, title, content, detail_url)
                        if not api_response_dic:
                            self.log_warning('Can not get %s org work weixin notifications API response' % nickname)
                        else:
                            # success
                            self.log_debug(api_response_dic)
                            send_notice_success = True

                    if not send_notice_success and enable_org_dingtalk_notice and org_dingtalk_uid:
                        access_token = get_org_dingtalk_corp_access_token(org_dingtalk_corp_id)
                        content = remove_a_element(msg)
                        self.log_debug(
                            'Send dingtalk notice to user: %s, %s, msg: %s' % (nickname, to_user, content))
                        api_response_dic = send_org_dingtalk_msg(
                            org_dingtalk_agent_id, org_dingtalk_uid, access_token, title, content, detail_url)
                        if not api_response_dic:
                            self.log_warning('Can not get %s org dingtalk notifications API response' % nickname)
                        else:
                            # success
                            self.log_debug(api_response_dic)
                            send_notice_success = True

                    if not send_notice_success and enable_work_weixin_notice and work_weixin_uid:
                        access_token = get_work_weixin_access_token()
                        content = remove_a_element(msg)
                        self.log_debug(
                            'Send work weixin notice to user: %s, %s, msg: %s' % (nickname, to_user, content))
                        api_response_dic = send_work_weixin_msg(
                            work_weixin_uid, access_token, title, content, detail_url)
                        if not api_response_dic:
                            self.log_warning('Can not get %s work weixin notifications API response' % nickname)
                        else:
                            # success
                            self.log_debug(api_response_dic)
                            send_notice_success = True

                    if not send_notice_success and enable_dingtalk_notice and dingtalk_uid:
                        access_token = dingtalk_get_access_token()
                        content = remove_a_element(msg)
                        self.log_debug(
                            'Send dingtalk notice to user: %s, %s, msg: %s' % (nickname, to_user, content))
                        api_response_dic = send_dingtalk_msg(
                            dingtalk_uid, access_token, title, content, detail_url)
                        if not api_response_dic:
                            self.log_warning('Can not get %s dingtalk notifications API response' % nickname)
                        else:
                            # success
                            self.log_debug(api_response_dic)
                            send_notice_success = True

                    if not send_notice_success and enable_weixin_notice and weixin_openid:
                        access_token = get_mp_weixin_access_token()
                        content = remove_a_element(msg)
                        notice_time = notices[-1].timestamp.strftime('%Y-%m-%d %H:%M')
                        self.log_debug('Send weixin notice to user: %s, %s, msg: %s' % (nickname, to_user, content))
                        api_response_dic = send_weixin_msg(
                            weixin_openid, access_token, title, content, notice_time, detail_url)
                        if not api_response_dic:
                            self.log_warning('Can not get %s weixin notifications API response' % nickname)
                        else:
                            # success
                            self.log_debug(api_response_dic)
                            send_notice_success = True

                    # failed
                    if not send_notice_success:
                        self.log_warning('Failed to send notices to %s, %s' % (nickname, to_user))

            if dtable_notices:
                title = _(
                    "\n"
                    "You've got %(num)s new notices on %(site_name)s:\n"
                ) % {'num': 1, 'site_name': site_name, }
                dtable_uuids = set([notice[2] for notice in dtable_notices])
                dtable_queryset = DTables.objects.filter(uuid__in=dtable_uuids)
                for notice in dtable_notices:
                    send_dtable_notice_success = False
                    dtable = dtable_queryset.filter(uuid=notice[2]).first()
                    if not dtable:
                        continue
                    dtable_detail_url = get_dtable_row_url_by_notice(notice, dtable)
                    msg = format_dtable_notice(notice, dtable)
                    if not msg:
                        continue

                    if not send_dtable_notice_success and enable_org_work_weixin_notice and org_work_weixin_uid:
                        access_token = get_org_work_weixin_corp_access_token(org_work_weixin_corp_id, permanent_code)
                        content = remove_a_element(msg)
                        self.log_debug(
                            'Send work weixin dtable notice to user: %s, %s, msg: %s' % (nickname, to_user, content))
                        api_response_dic = send_org_work_weixin_msg(
                            org_work_weixin_agent_id, org_work_weixin_uid, access_token, title, content, dtable_detail_url)
                        if not api_response_dic:
                            self.log_warning('Can not get %s org work weixin notifications API response' % nickname)
                        else:
                            # success
                            self.log_debug(api_response_dic)
                            send_dtable_notice_success = True

                    if not send_dtable_notice_success and enable_org_dingtalk_notice and org_dingtalk_uid:
                        access_token = get_org_dingtalk_corp_access_token(org_dingtalk_corp_id)
                        content = remove_a_element(msg)
                        self.log_debug(
                            'Send dingtalk dtable notice to user: %s, %s, msg: %s' % (nickname, to_user, content))
                        api_response_dic = send_org_dingtalk_msg(
                            org_dingtalk_agent_id, org_dingtalk_uid, access_token, title, content, dtable_detail_url)
                        if not api_response_dic:
                            self.log_warning('Can not get %s org dingtalk notifications API response' % nickname)
                        else:
                            # success
                            self.log_debug(api_response_dic)
                            send_dtable_notice_success = True

                    if not send_dtable_notice_success and enable_work_weixin_notice and work_weixin_uid:
                        access_token = get_work_weixin_access_token()
                        content = remove_a_element(msg)
                        self.log_debug(
                            'Send work weixin dtable notice to user: %s, %s, msg: %s' % (nickname, to_user, content))
                        api_response_dic = send_work_weixin_msg(
                            work_weixin_uid, access_token, title, content, dtable_detail_url)
                        if not api_response_dic:
                            self.log_warning('Can not get %s work weixin notifications API response' % nickname)
                        else:
                            # success
                            self.log_debug(api_response_dic)
                            send_dtable_notice_success = True

                    if not send_dtable_notice_success and enable_dingtalk_notice and dingtalk_uid:
                        access_token = dingtalk_get_access_token()
                        content = remove_a_element(msg)
                        self.log_debug(
                            'Send dingtalk dtable notice to user: %s, %s, msg: %s' % (nickname, to_user, content))
                        api_response_dic = send_dingtalk_msg(
                            dingtalk_uid, access_token, title, content, dtable_detail_url)
                        if not api_response_dic:
                            self.log_warning('Can not get %s dingtalk notifications API response' % nickname)
                        else:
                            # success
                            self.log_debug(api_response_dic)
                            send_dtable_notice_success = True

                    if not send_dtable_notice_success and enable_weixin_notice and weixin_openid:
                        access_token = get_mp_weixin_access_token()
                        content = remove_a_element(msg)
                        notice_time = (dtable_notices[-1][4] + dtable_notice_timedelta).strftime('%Y-%m-%d %H:%M')
                        self.log_debug(
                            'Send weixin dtable notice to user: %s, %s, msg: %s' % (nickname, to_user, content))
                        api_response_dic = send_weixin_msg(
                            weixin_openid, access_token, title, content, notice_time, dtable_detail_url)
                        if not api_response_dic:
                            self.log_warning('Can not get %s weixin notifications API response' % nickname)
                        else:
                            # success
                            self.log_debug(api_response_dic)
                            send_dtable_notice_success = True

                    # failed
                    if not send_dtable_notice_success:
                        self.log_warning('Failed to send dtable notices to %s, %s' % (nickname, to_user))

            if app_notices:
                title = _(
                    "\n"
                    "You've got %(num)s new notices on %(site_name)s:\n"
                ) % {'num': 1, 'site_name': site_name, }
                app_ids = set([notice.app.id for notice in app_notices])
                app_queryset = DTableExternalApps.objects.filter(id__in=app_ids)
                for notice in app_notices:
                    send_app_notice_success = False
                    app = app_queryset.filter(id=notice.app.id).first()
                    if not app:
                        continue
                    app_detail_url = get_app_url(app)
                    msg = format_app_notice(notice, app)
                    if not msg:
                        continue

                    if not send_app_notice_success and enable_org_work_weixin_notice and org_work_weixin_uid:
                        access_token = get_org_work_weixin_corp_access_token(org_work_weixin_corp_id, permanent_code)
                        content = remove_a_element(msg)
                        self.log_debug(
                            'Send work weixin app notice to user: %s, %s, msg: %s' % (nickname, to_user, content))
                        api_response_dic = send_org_work_weixin_msg(
                            org_work_weixin_agent_id, org_work_weixin_uid, access_token, title, content, app_detail_url)
                        if not api_response_dic:
                            self.log_warning('Can not get %s org work weixin notifications API response' % nickname)
                        else:
                            # success
                            self.log_debug(api_response_dic)
                            send_app_notice_success = True

                    if not send_app_notice_success and enable_org_dingtalk_notice and org_dingtalk_uid:
                        access_token = get_org_dingtalk_corp_access_token(org_dingtalk_corp_id)
                        content = remove_a_element(msg)
                        self.log_debug(
                            'Send dingtalk app notice to user: %s, %s, msg: %s' % (nickname, to_user, content))
                        api_response_dic = send_org_dingtalk_msg(
                            org_dingtalk_agent_id, org_dingtalk_uid, access_token, title, content, app_detail_url)
                        if not api_response_dic:
                            self.log_warning('Can not get %s org dingtalk notifications API response' % nickname)
                        else:
                            # success
                            self.log_debug(api_response_dic)
                            send_app_notice_success = True

                    if not send_app_notice_success and enable_work_weixin_notice and work_weixin_uid:
                        access_token = get_work_weixin_access_token()
                        content = remove_a_element(msg)
                        self.log_debug(
                            'Send work weixin app notice to user: %s, %s, msg: %s' % (nickname, to_user, content))
                        api_response_dic = send_work_weixin_msg(
                            work_weixin_uid, access_token, title, content, app_detail_url)
                        if not api_response_dic:
                            self.log_warning('Can not get %s work weixin notifications API response' % nickname)
                        else:
                            # success
                            self.log_debug(api_response_dic)
                            send_app_notice_success = True

                    if not send_app_notice_success and enable_dingtalk_notice and dingtalk_uid:
                        access_token = dingtalk_get_access_token()
                        content = remove_a_element(msg)
                        self.log_debug(
                            'Send dingtalk app notice to user: %s, %s, msg: %s' % (nickname, to_user, content))
                        api_response_dic = send_dingtalk_msg(
                            dingtalk_uid, access_token, title, content, app_detail_url)
                        if not api_response_dic:
                            self.log_warning('Can not get %s dingtalk notifications API response' % nickname)
                        else:
                            # success
                            self.log_debug(api_response_dic)
                            send_app_notice_success = True

                    if not send_app_notice_success and enable_weixin_notice and weixin_openid:
                        access_token = get_mp_weixin_access_token()
                        content = remove_a_element(msg)
                        notice_time = (app_notices[-1][4]).strftime('%Y-%m-%d %H:%M')
                        self.log_debug(
                            'Send weixin app notice to user: %s, %s, msg: %s' % (nickname, to_user, content))
                        api_response_dic = send_weixin_msg(
                            weixin_openid, access_token, title, content, notice_time, app_detail_url)
                        if not api_response_dic:
                            self.log_warning('Can not get %s weixin notifications API response' % nickname)
                        else:
                            # success
                            self.log_debug(api_response_dic)
                            send_app_notice_success = True

                    # failed
                    if not send_app_notice_success:
                        self.log_warning('Failed to send app notices to %s, %s' % (nickname, to_user))

        # reset language
        translation.activate(cur_language)
        self.log_debug('reset language success')
