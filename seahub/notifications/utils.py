# Copyright (c) 2012-2016 Seafile Ltd.
import os
import re
import json
import logging
import requests
from django.core.cache import cache
from django.urls import reverse
from django.utils.html import escape
from django.utils.translation import ngettext, gettext as _
from django.db import connection

from seaserv import ccnet_api, seafile_api

from seahub.notifications.models import UserNotification
from seahub.base.models import CommandsLastCheck
from seahub.dtable.models import DTables, Workspaces, DTableForms
from seahub.notifications.models import Notification
from seahub.notifications.settings import NOTIFICATION_CACHE_TIMEOUT
from seahub.avatar.templatetags.avatar_tags import api_avatar_url
from seahub.base.templatetags.seahub_tags import email2nickname, email2contact_email

from seahub.utils import send_html_email, get_site_scheme_and_netloc
from seahub.auth.models import SocialAuthUser
from seahub.options.models import UserOptions, KEY_DTABLE_COLLABORATE_EMAIL_INTERVAL
from seahub.profile.models import Profile
from seahub.weixin.utils import handler_weixin_api_response, get_mp_weixin_users_openid
from seahub.work_weixin.utils import handler_work_weixin_api_response
from seahub.dingtalk.settings import DINGTALK_MESSAGE_SEND_TO_CONVERSATION_URL, DINGTALK_AGENT_ID, DINGTALK_PROVIDER, DINGTALK_UID_PREFIX
from seahub.dingtalk.utils import handler_dingtalk_api_response, dingtalk_get_userid_by_unionid
from seahub.org_work_weixin.utils import handler_org_work_weixin_api_response
from seahub.weixin.settings import MP_WEIXIN_MESSAGE_TEMPLATE_ID, MINIPROGRAM_WEIXN_APP_ID, \
    WEIXIN_PROVIDER, WEIXIN_UID_PREFIX, MP_OPENID, MP_WEIXIN_NOTIFICATIONS_URL
from seahub.work_weixin.settings import WORK_WEIXIN_AGENT_ID, WORK_WEIXIN_PROVIDER, \
    WORK_WEIXIN_UID_PREFIX, WORK_WEIXIN_NOTIFICATIONS_URL
from seahub.org_work_weixin.settings import ORG_WORK_WEIXIN_PROVIDER
from seahub.org_dingtalk.settings import ORG_DINGTALK_PROVIDER, DINGTALK_NOTIFICATIONS_URL, ORG_DINGTALK_MESSAGE_TEMPLATE_ID
from seahub.org_dingtalk.utils import handler_org_dingtalk_api_response, unionid_to_userid
from seahub.organizations.models import OrgCorpAuth
from seahub.dtable_apps.workflow.models import DTableWorkflowTasks
from seahub.dtable_apps.workflow.utils import get_finish_task_message_from_config, get_name_from_config
from seahub.settings import DTABLE_WEB_SERVICE_URL
from seahub.dtable_apps.universal_app.models import DTableAppNotifications

logger = logging.getLogger(__name__)


def refresh_cache():
    """
    Function to be called when change primary notification.
    """
    cache.set('CUR_TOPINFO', Notification.objects.all().filter(primary=1),
              NOTIFICATION_CACHE_TIMEOUT)


def update_notice_detail(notices):
    for notice in notices:
        # if need to update this func, command-line's code perhaps
        # needs to be updated, work-weixin-send-notices, email-send-notices, etc...

        if notice.is_add_user_to_group_msg():
            try:
                d = json.loads(notice.detail)
                group_id = d['group_id']
                group = ccnet_api.get_group(group_id)
                if group is None:
                    notice.detail = None
                else:
                    group_staff_email = d.pop('group_staff')
                    url, is_default, date_uploaded = api_avatar_url(group_staff_email)
                    d['group_staff_name'] = email2nickname(group_staff_email)
                    d['group_staff_email'] = group_staff_email
                    d['group_staff_contact_email'] = email2contact_email(group_staff_email)
                    d['group_staff_avatar_url'] = url
                    d['group_name'] = group.group_name

                    notice.detail = d
            except Exception as e:
                logger.error(e)

        elif notice.is_share_dtable_to_user_msg():
            try:
                d = json.loads(notice.detail)
                table_id = d.pop('table_id')
                share_from = d.pop('share_user')
                dtable = DTables.objects.filter(id=table_id).first()
                if not dtable:
                    notice.detail = None
                    continue
                # resource check
                workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace_id)
                if not workspace:
                    notice.detail = None
                    continue
                repo_id = workspace.repo_id
                repo = seafile_api.get_repo(repo_id)
                if not repo:
                    notice.detail = None
                    continue
                if repo.status != 0:
                    notice.detail = None
                    continue
                d['dtable'] = {
                    'id': dtable.id,
                    'workspace_id': dtable.workspace_id,
                    'uuid': dtable.uuid,
                    'name': dtable.name,
                }
                url, is_default, date_uploaded = api_avatar_url(share_from)
                d['share_from'] = {
                    'share_from_user_name': email2nickname(share_from),
                    'share_from_user_email': share_from,
                    'share_from_user_avatar_url': url,
                }
                notice.detail = d
            except Exception as e:
                logger.error(e)

        elif notice.is_submit_form_msg():
            try:
                detail = json.loads(notice.detail)
                dtable_id = detail.pop('dtable_id')
                table_id = detail.pop('table_id')
                form_name = detail.pop('form_name')
                submit_user = detail.pop('submit_user')
                row_id = detail.pop('row_id', '')
                dtable = DTables.objects.filter(id=dtable_id).first()
                if not dtable:
                    notice.detail = None
                    continue
                # resource check
                workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace_id)
                if not workspace:
                    notice.detail = None
                    continue

                detail['form'] = {
                    'id': dtable.id,
                    'workspace_id': dtable.workspace_id,
                    'uuid': dtable.uuid,
                    'name': dtable.name,
                    'table_id': table_id,
                    'form_name': form_name,
                    'row_id': row_id
                }
                url, is_default, date_uploaded = api_avatar_url(submit_user)
                detail['submit_user'] = {
                    'submit_user_name': email2nickname(submit_user),
                    'submit_user_email': submit_user,
                    'submit_user_avatar_url': url,
                }
                notice.detail = detail
            except Exception as e:
                logger.error(e)

        elif notice.is_new_pending_workflow_task_msg():
            try:
                detail = json.loads(notice.detail)
                token = detail['token']
                task_id = detail['task_id']
                workflow_task = DTableWorkflowTasks.objects.get_task_by_token_id(token, task_id)
                if not workflow_task:
                    notice.detail = None
                    continue
                detail['workflow_task'] = workflow_task.to_dict()
                initiator = workflow_task.initiator
                url, __, __ = api_avatar_url(initiator)
                detail['initiator'] = {
                    'initiator_user_name': email2nickname(initiator),
                    'initiator_user_email': initiator,
                    'initiator_user_avatar_url': url
                }
                detail['workflow_name'] = get_name_from_config(workflow_task.dtable_workflow.workflow_config)
                notice.detail = detail
            except Exception as e:
                logger.error(e)

        elif notice.is_finish_workflow_task_msg():
            try:
                detail = json.loads(notice.detail)
                token = detail['token']
                task_id = detail['task_id']
                workflow_task = DTableWorkflowTasks.objects.get_task_by_token_id(token, task_id)
                if not workflow_task:
                    notice.detail = None
                    continue
                detail['workflow_task'] = workflow_task.to_dict()
                initiator = workflow_task.initiator
                url, __, __ = api_avatar_url(initiator)
                detail['initiator'] = {
                    'initiator_user_name': email2nickname(initiator),
                    'initiator_user_email': initiator,
                    'initiator_user_avatar_url': url
                }
                detail['workflow_name'] = get_name_from_config(workflow_task.dtable_workflow.workflow_config)
                notice.detail = detail
            except Exception as e:
                logger.error(e)

        elif notice.is_dismiss_workflow_task_msg():
            try:
                detail = json.loads(notice.detail)
                token = detail['token']
                task_id = detail['task_id']
                workflow_task = DTableWorkflowTasks.objects.get_task_by_token_id(token, task_id)
                if not workflow_task:
                    notice.detail = None
                    continue
                detail['workflow_task'] = workflow_task.to_dict()
                initiator = workflow_task.initiator
                url, __, __ = api_avatar_url(initiator)
                detail['initiator'] = {
                    'initiator_user_name': email2nickname(initiator),
                    'initiator_user_email': initiator,
                    'initiator_user_avatar_url': url
                }
                detail['workflow_name'] = get_name_from_config(workflow_task.dtable_workflow.workflow_config)
                notice.detail = detail
            except Exception as e:
                logger.error(e)

        elif notice.is_workflow_processing_expired_msg():
            try:
                detail = json.loads(notice.detail)
                token = detail['token']
                task_id = detail['task_id']
                workflow_task = DTableWorkflowTasks.objects.get_task_by_token_id(token, task_id)
                if not workflow_task:
                    notice.detail = None
                    continue
                detail['workflow_task'] = workflow_task.to_dict()
                initiator = workflow_task.initiator
                url, __, __ = api_avatar_url(initiator)
                detail['initiator'] = {
                    'initiator_user_name': email2nickname(initiator),
                    'initiator_user_email': initiator,
                    'initiator_user_avatar_url': url
                }
                detail['workflow_name'] = get_name_from_config(workflow_task.dtable_workflow.workflow_config)
                notice.detail = detail
            except Exception as e:
                logger.error(e)

        elif notice.is_license_expiring_msg():
            try:
                detail = json.loads(notice.detail)
                notice.detail = detail
            except Exception as e:
                logger.error(e)

        elif notice.is_saml_sso_error_msg():
            try:
                detail = json.loads(notice.detail)
                notice.detail = detail
            except Exception as e:
                logger.error(e)

    return notices


def get_and_update_last_check(label, now):
    obj = CommandsLastCheck.objects.get_by_command_type(command_type=label)

    if obj:
        last_check = obj.last_check
        obj.update_last_check(now)
    else:
        obj = CommandsLastCheck.objects.create(command_type=label, last_check=now)
        today = now.replace(hour=0).replace(minute=0).replace(second=0).replace(microsecond=0)
        last_check = today

    return last_check


def get_unseen_notices(last_check):
    unseen_notices = UserNotification.objects.filter(timestamp__gt=last_check, seen=False)

    notices_map = {}
    for notice in unseen_notices:
        if notice.to_user not in notices_map:
            notices_map[notice.to_user] = [notice]
        else:
            notices_map[notice.to_user].append(notice)
    return notices_map, unseen_notices


def get_unseen_notices_in_dtable(last_check):
    with connection.cursor() as cursor:
        cursor.execute("SELECT * FROM dtable_notifications WHERE created_at > %s"
                        "AND seen = FALSE", [last_check])
        rows = cursor.fetchall()

    notices_map = {}
    for row in rows:
        if row[1] not in notices_map:
            notices_map[row[1]] = [row]
        else:
            notices_map[row[1]].append(row)
    return notices_map, rows


def get_unseen_notices_in_app(last_check):
    unseen_notices = DTableAppNotifications.objects.filter(created_at__gt=last_check, seen=False)

    notices_map = {}
    for notice in unseen_notices:
        if notice.to_user not in notices_map:
            notices_map[notice.to_user] = [notice]
        else:
            notices_map[notice.to_user].append(notice)
    return notices_map, unseen_notices


def get_user_dtable_collaborate_email_interval(user_options_qs, email):
    '''
    Cases of handling collaborate email:
    1. no related user options --- send
    2. have related user options and the option value is not 0 -- send
    3. have related user options and the option value is 0 -- not send
    '''
    option = user_options_qs.filter(email=email).first()
    if option:
        try:
            dtable_collaborate_email_interval = int(option.option_val)
            return dtable_collaborate_email_interval
        except Exception as e:
            logger.error('Failed to convert string %s to int' % option.option_val)

    return 1


def get_users_detail(user_list, log_debug):
    user_map = {}
    user_options_qs = UserOptions.objects.filter(email__in=user_list, option_key=KEY_DTABLE_COLLABORATE_EMAIL_INTERVAL)
    profile_qs = Profile.objects.filter(user__in=user_list).exclude(contact_email=None).exclude(contact_email='')
    log_debug('Found %d users with contact email' % profile_qs.count())

    for item in profile_qs:
        if get_user_dtable_collaborate_email_interval(user_options_qs, item.user) > 0:
            user_map[item.user] = {'contact_email': item.contact_email}

    return user_map


def get_social_auth_users_detail(log_debug, user_list, enable_weixin_notice, enable_work_weixin_notice, enable_dingtalk_notice, enable_org_work_weixin_notice, enable_org_dingtalk_notice):
    user_map = {}
    users_openid = []
    provider_list = []

    if enable_org_work_weixin_notice:
        provider_list.append(ORG_WORK_WEIXIN_PROVIDER)
    if enable_work_weixin_notice:
        provider_list.append(WORK_WEIXIN_PROVIDER)
    if enable_dingtalk_notice:
        provider_list.append(DINGTALK_PROVIDER)
    if enable_weixin_notice:
        provider_list.append(WEIXIN_PROVIDER)
        users_openid = get_mp_weixin_users_openid()
    if enable_org_dingtalk_notice:
        provider_list.append(ORG_DINGTALK_PROVIDER)

    social_auth_qs = SocialAuthUser.objects.filter(username__in=user_list, provider__in=provider_list)
    for item in social_auth_qs:
        username = item.username
        nickname = email2nickname(username)
        if user_map.get(username) is None:
            user_map[username] = {}

        if item.provider == ORG_WORK_WEIXIN_PROVIDER and enable_org_work_weixin_notice:
            orgs = ccnet_api.get_orgs_by_user(username)
            if orgs:
                org = orgs[0]
                org_id = org.org_id
                org_corp = OrgCorpAuth.objects.get_by_org_id(org_id)
                if org_corp and org_corp.permanent_code:
                    corp_id = org_corp.corp_id
                    permanent_code = org_corp.permanent_code
                    extra_data = json.loads(org_corp.extra_data)
                    agent_id =  extra_data['auth_info']['agent'][0]['agentid']
                    user_map[username]['org_id'] = org_id
                    user_map[username]['org_work_weixin_corp_id'] = corp_id
                    user_map[username]['permanent_code'] = permanent_code
                    user_map[username]['org_work_weixin_agent_id'] = agent_id
                    user_map[username][ORG_WORK_WEIXIN_PROVIDER] = item.uid[len(corp_id) + 1:]
                else:
                    log_debug('Org work-weixin user: %s, %s, org_id: %s, has no org_corp' % (nickname, username, org_id))
            else:
                log_debug('Org work-weixin user: %s, %s, has no org' % (nickname, username))

        if item.provider == ORG_DINGTALK_PROVIDER and enable_org_dingtalk_notice:
            orgs = ccnet_api.get_orgs_by_user(username)
            if orgs:
                org = orgs[0]
                org_id = org.org_id
                org_corp = OrgCorpAuth.objects.get_by_org_id(org_id)
                if org_corp and not org_corp.permanent_code:  # dingtalk do not have permanent_code
                    corp_id = org_corp.corp_id
                    extra_data = json.loads(org_corp.extra_data)
                    agent_id = extra_data['auth_info']['agent'][0]['agentid']
                    user_map[username]['org_id'] = org_id
                    user_map[username]['org_dingtalk_corp_id'] = corp_id
                    user_map[username]['org_dingtalk_agent_id'] = agent_id
                    userid = unionid_to_userid(item.uid[len(corp_id) + 1:], corp_id)
                    user_map[username][ORG_DINGTALK_PROVIDER] = userid
                else:
                    log_debug('Org dingtalk user: %s, %s, org_id: %s, has no org_corp' % (nickname, username, org_id))
            else:
                log_debug('Org dingtalk user: %s, %s, has no org' % (nickname, username))

        elif item.provider == WORK_WEIXIN_PROVIDER and enable_work_weixin_notice:
            user_map[username][WORK_WEIXIN_PROVIDER] = item.uid[len(WORK_WEIXIN_UID_PREFIX):]

        elif item.provider == DINGTALK_PROVIDER and enable_dingtalk_notice:
            userid = dingtalk_get_userid_by_unionid(item.uid[len(DINGTALK_UID_PREFIX):])
            user_map[username][DINGTALK_PROVIDER] = userid

        elif item.provider == WEIXIN_PROVIDER and users_openid:
            if item.extra_data:
                openid = json.loads(item.extra_data).get(MP_OPENID)
                if openid in users_openid:
                    user_map[username][WEIXIN_PROVIDER] = openid
                else:
                    log_debug('Weixin user: %s, %s, did not follow Weixin Official Accounts' % (nickname, username))
            else:
                log_debug('Weixin user: %s, %s, has no openid' % (nickname, username))

        if user_map[username] == {}:
            del user_map[username]

    return user_map


def remove_a_element(s):
    """
    Replace <a ..>xx</a> to xx.
    """
    patt = '<a.*?>(.+?)</a>'

    def repl(matchobj):
        return matchobj.group(1)

    return re.sub(patt, repl, s)


def add_highlight_div(s):
    """
    wrap content with <div></div>.
    """
    return '<div class="highlight">' + s + '</div>'


def add_a_element(con, href='#', style=''):
    return '<a href="%s" style="%s">%s</a>' % (href, style, escape(con))


def get_dtable_url(dtable):
    path = reverse('dtable:dtable_file_view', args=[dtable.workspace.id, dtable.name])
    return get_site_scheme_and_netloc() + path


def get_dtable_row_url(dtable, tid='', vid='', row_id=''):
    base_path = get_dtable_url(dtable)
    if not tid:
        tid = '0000'
    if not vid:
        vid = '0000'
    dtable_row_url = "%s%s" % (base_path, "?tid=%s&vid=%s" % (tid, vid))
    if row_id:
        dtable_row_url = "%s%s" % (dtable_row_url, "&row-id=%s" % row_id)
    return dtable_row_url


def get_dtable_row_url_by_notice(dtable_notice, dtable):
    msg_type = dtable_notice[3]
    detail = json.loads(dtable_notice[5])
    table_id = detail.get('table_id', '')
    view_id = detail.get('view_id', '')
    if msg_type == 'notification_rules':
        row_id = detail['row_id_list'][0] if detail.get('row_id_list', '') else ''
    else:
        row_id = detail.get('row_id', '')
    return get_dtable_row_url(dtable, tid=table_id, vid=view_id, row_id=row_id)


def get_app_url(app):
    path = reverse('dtable:dtable_external_app_view', args=[app.app_uuid,])
    return get_site_scheme_and_netloc() + path


def format_dtable_notice(notice, dtable, include_detail_link=False):
    table_name = str(dtable.name)
    detail = json.loads(notice[5])
    notice_type = notice[3]

    if notice_type == 'row_comment':
        message = _("%(author)s added a new comment in base %(base_name)s") % {
            'author': escape(email2nickname(detail.get('author'))),
            'base_name': table_name,
        }
        message = '%s "%s"' % (message, detail.get('comment', ''))
        if include_detail_link:
            dtable_row_url = get_dtable_row_url(dtable, tid=detail.get('table_id', ''), vid=detail.get('view_id', ''), row_id=detail.get('row_id', ''))
            message = '%s %s' % (message, add_a_element(_('Details'), dtable_row_url))

    elif notice_type == 'notification_rules':
        message = _("Rule %(rule_name)s has been triggered") % {
            'rule_name': detail.get('rule_name', ''),
        }
        if detail.get('msg'):
            message = '%s "%s"' % (message, detail.get('msg', ''))
        row_id = detail['row_id_list'][0] if detail.get('row_id_list', '') else ''
        if include_detail_link:
            dtable_row_url = get_dtable_row_url(dtable, tid=detail.get('table_id', ''), vid=detail.get('view_id', ''), row_id=row_id)
            message = "%s %s" % (message, add_a_element(_('Details'), dtable_row_url))

    elif notice_type == 'selected_collaborator':
        message = _("You are added as a row collaborator in base %(table_name)s") % {
            'table_name': table_name,
        }
        if include_detail_link:
            dtable_row_url = get_dtable_row_url(dtable, tid=detail.get('table_id', ''), row_id=detail.get('row_id', ''))
            message = "%s %s" % (message, add_a_element(_('Details'), dtable_row_url))

    elif notice_type == 'workflows':
        message = _("Workflow %(workflow_name)s has been triggered") % {
            'workflow_name': detail.get('workflow_name', ''),
        }
        if detail.get('msg'):
            message = '%s "%s"' % (message, detail.get('msg', ''))

        if include_detail_link:
            message = "%s %s" % (message, add_a_element(_('Details'), "%s/workflows/" % DTABLE_WEB_SERVICE_URL.rstrip('/')))
        
    else:
        message = ''

    return message


def format_app_notice(notice, app, include_detail_link=False):
    detail = json.loads(notice.detail)
    notice_type = notice.msg_type

    if notice_type == 'row_comments':
        message = detail.get('comment', '')
        if include_detail_link:
            app_url = get_app_url(app)
            message = "%s %s" % (message, add_a_element(_('Details'), app_url))

    elif notice_type == 'notification_rules':
        message = detail.get('msg', '')
        if include_detail_link:
            app_url = get_app_url(app)
            message = "%s %s" % (message, add_a_element(_('Details'), app_url))

    else:
        message = ''

    return message


def send_weixin_msg(openid, access_token, title, content, notice_time, detail_url):
    """https://developers.weixin.qq.com/doc/offiaccount/Message_Management/Template_Message_Interface.html
    """
    notice_url = MP_WEIXIN_NOTIFICATIONS_URL + '?access_token=' + access_token
    data = {
        'touser': openid,
        'template_id': MP_WEIXIN_MESSAGE_TEMPLATE_ID,
        'url': detail_url,
        'data': {
            'first': {
                'value': title,
            },
            'keyword1': {
                'value': content,
            },
            'keyword2': {
                'value': notice_time,
            },
        }
    }
    if MINIPROGRAM_WEIXN_APP_ID:
        detail_url = detail_url[len(get_site_scheme_and_netloc()) + 1:]
        data['miniprogram'] = {
            'appid': MINIPROGRAM_WEIXN_APP_ID,
            'pagepath': 'pages/webpage/webpage?path=' + detail_url,
        }
        data['data']['remark'] = {
            'value': '点击消息进入小程序查看',
        }

    api_response = requests.post(notice_url, json=data)
    api_response_dic = handler_weixin_api_response(api_response)
    return api_response_dic


def send_work_weixin_msg(uid, access_token, title, content, detail_url):
    notice_url = WORK_WEIXIN_NOTIFICATIONS_URL + '?access_token=' + access_token
    data = {
        "touser": uid,
        "agentid": WORK_WEIXIN_AGENT_ID,
        'msgtype': 'textcard',
        'textcard': {
            'title': title,
            'description': content,
            'url': detail_url,
        },
    }
    api_response = requests.post(notice_url, json=data)
    api_response_dic = handler_work_weixin_api_response(api_response)
    return api_response_dic


def send_dingtalk_msg(user_id, access_token, title, content, detail_url):
    notice_url = DINGTALK_MESSAGE_SEND_TO_CONVERSATION_URL + '?access_token=' + access_token
    data = {
        "agent_id": DINGTALK_AGENT_ID,
        "userid_list": user_id,
        "msg": {
            "msgtype": "markdown",
            "markdown": {
                "title": title,
                "text": content,
            }
        }
    }
    api_response = requests.post(notice_url, json=data)
    api_response_dic = handler_dingtalk_api_response(api_response)
    return api_response_dic


def send_org_work_weixin_msg(agent_id, uid, access_token, title, content, detail_url):
    notice_url = WORK_WEIXIN_NOTIFICATIONS_URL + '?access_token=' + access_token
    data = {
        "touser": uid,
        "agentid": agent_id,
        'msgtype': 'textcard',
        'textcard': {
            'title': title,
            'description': content,
            'url': detail_url,
        },
    }
    api_response = requests.post(notice_url, json=data)
    api_response_dic = handler_org_work_weixin_api_response(api_response)
    return api_response_dic


def send_org_dingtalk_msg(agent_id, uid, access_token, title, content, detail_url):
    """
    https://open.dingtalk.com/document/isvapp-server/work-notification-templating-send-notification-interface
    """
    notice_url = DINGTALK_NOTIFICATIONS_URL + '?access_token=' + access_token
    data = {
        "agent_id": agent_id,
        'template_id': ORG_DINGTALK_MESSAGE_TEMPLATE_ID,
        "userid_list": uid,
        "data": {
            'content': content,
            'detail_url': detail_url,
        },
    }
    api_response = requests.post(notice_url, json=data)
    api_response_dic = handler_org_dingtalk_api_response(api_response)
    return api_response_dic
