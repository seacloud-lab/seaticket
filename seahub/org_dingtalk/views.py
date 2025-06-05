import uuid
import json
import requests
import logging
import urllib.parse

from django.shortcuts import render
from django.http import HttpResponseRedirect
from django.http.response import HttpResponse, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt
from django.utils.translation import gettext as _
from django.urls import reverse

from seaserv import ccnet_api

from seahub import auth, settings
from seahub.organizations.decorators import org_staff_required, org_user_required
from seahub.auth.decorators import login_required
from seahub.utils import render_error, get_site_scheme_and_netloc
from seahub.org_dingtalk.settings import ORG_DINGTALK_TOKEN,\
    ORG_DINGTALK_ENCODING_AES_KEY, ORG_DINGTALK_SUITE_KEY, \
    ORG_DINGTALK_AUTHORIZATION_URL, ORG_DINGTALK_GET_USER_INFO_URL, \
    ORG_DINGTALK_PROVIDER, REMEMBER_ME, ORG_DINGTALK_USER_INFO_AUTO_UPDATE
from seahub.org_dingtalk.utils import set_suite_ticket, add_corp, \
    org_dingtalk_check, handler_org_dingtalk_api_response, \
    update_corp_info, get_user_access_token,  update_dingtalk_user_info, \
    get_api_user, get_logon_free_api_user, logger
from seahub.organizations.models import OrgCorpAuth, OrgMemberQuota
from seahub.auth.models import SocialAuthUser
from seahub.base.accounts import User
from seahub.profile.models import Profile
from seahub.api2.utils import get_api_token
from seahub.organizations.settings import ORG_MEMBER_QUOTA_ENABLED
from seahub.organizations.utils import gen_org_url_prefix
from seahub.invitations.utils import record_registration_logs, record_org_registration_logs
from seahub.utils.auth import VIRTUAL_ID_EMAIL_DOMAIN

redirect_to = settings.LOGIN_REDIRECT_URL


@csrf_exempt
def sync_http_view(request):
    """
    应用授权
    https://open.dingtalk.com/document/isvapp-server/application-authorization
    接收回调
    https://open.dingtalk.com/document/isv/configure-synchttp-push
    https://open.dingtalk.com/document/isv/data-format
    """
    from seahub.org_dingtalk.DingCallbackCrypto3 import DingCallbackCrypto3
    ding_crypto = DingCallbackCrypto3(
        ORG_DINGTALK_TOKEN, ORG_DINGTALK_ENCODING_AES_KEY, ORG_DINGTALK_SUITE_KEY)

    # 接收指令回调
    if request.method == 'POST':
        msg_signature = request.GET.get('signature') or request.GET.get('msg_signature')
        timestamp = request.GET.get('timestamp')
        nonce = request.GET.get('nonce')
        logger.info('sync-http msg_signature: %s, timestamp: %s, nonce: %s, request.body: %s' % (
            msg_signature, timestamp, nonce, request.body))
        if not msg_signature or not timestamp or not nonce or not request.body:
            return HttpResponseBadRequest('Bad Request')
        try:
            encrypt_msg = json.loads(request.body).get('encrypt')
            decrypt_msg = ding_crypto.getDecryptMsg(msg_signature, timestamp, nonce, encrypt_msg)
        except Exception as e:
            logger.exception(e)
            return HttpResponseBadRequest('Bad Request')

        logger.info('sync-http decrypt_msg: %s' % str(decrypt_msg))
        event_json = json.loads(decrypt_msg)
        event_type = event_json.get('EventType')

        # check_url
        if event_type in ('check_url', 'check_create_suite_url', 'check_update_suite_url'):
            pass

        # SYNC_HTTP_PUSH_MEDIUM
        elif event_type == 'SYNC_HTTP_PUSH_MEDIUM':
            pass

        # SYNC_HTTP_PUSH_HIGH
        elif event_type == 'SYNC_HTTP_PUSH_HIGH':
            for bizData in event_json.get('bizData'):
                try:
                    corp_id = bizData.get('corp_id')
                    org_corp = OrgCorpAuth.objects.get_by_corp_id(corp_id)
                    biz_type = bizData.get('biz_type')
                    biz_data = json.loads(bizData.get('biz_data'))
                    sync_action = biz_data.get('syncAction')
                    logger.info('sync-http corp_id: %s, biz_type: %s, sync_action: %s' % (corp_id, biz_type, sync_action))
                    if biz_type == 2:
                        suite_ticket = biz_data.get('suiteTicket')
                        set_suite_ticket(suite_ticket)
                    if biz_type == 4:
                        # bind or update
                        if sync_action in ('org_suite_auth', 'org_suite_change'):
                            if not org_corp:
                                add_corp(biz_data)
                            else:
                                update_corp_info(org_corp, biz_data)
                        # delete corp
                        elif sync_action == 'org_suite_relieve':
                            OrgCorpAuth.objects.filter(corp_id=corp_id).delete()
                            SocialAuthUser.objects.filter(
                                provider=ORG_DINGTALK_PROVIDER, uid__contains=corp_id).delete()
                    if biz_type == 7:
                        # reset corp
                        if sync_action in ('org_micro_app_stop', 'org_micro_app_remove'):
                            OrgCorpAuth.objects.filter(corp_id=corp_id).update(org_id=None)
                            SocialAuthUser.objects.filter(
                                provider=ORG_DINGTALK_PROVIDER, uid__contains=corp_id).delete()
                        # bind
                        elif sync_action == 'org_micro_app_restore':
                            if not org_corp:
                                add_corp({'auth_corp_info': {
                                    'corpid': corp_id,
                                    'corp_name': '',
                                }})
                        elif sync_action == 'org_micro_app_scope_update':
                            pass
                    if biz_type == 16:
                        # delete corp
                        if sync_action == 'org_remove':
                            OrgCorpAuth.objects.filter(corp_id=corp_id).delete()
                            SocialAuthUser.objects.filter(
                                provider=ORG_DINGTALK_PROVIDER, uid__contains=corp_id).delete()
                except Exception as e:
                    logger.exception(e)

    # finally
    return HttpResponse(str(ding_crypto.getEncryptedMap('success')))


@login_required
@org_staff_required
def org_dingtalk_bind(request):
    """ get user_access_token & corp_id, then bind

    https://open.dingtalk.com/document/isvapp-server/dingtalk-retrieve-user-information
    """
    if not org_dingtalk_check():
        return render_error(request, _('Feature is not enabled.'))

    org_id = request.user.org.org_id
    exists_org_corp = OrgCorpAuth.objects.get_by_org_id(org_id)
    if exists_org_corp and exists_org_corp.corp_id:
        return render_error(request, '企业已经绑定 SeaTable 团队')

    state = str(uuid.uuid4())
    logger.info('org bind state: ' + state)
    redirect_uri = get_site_scheme_and_netloc() + reverse('org_dingtalk_bind_callback')

    data = {
        'redirect_uri': redirect_uri,
        'response_type': 'code',
        'client_id': ORG_DINGTALK_SUITE_KEY,
        'scope': 'openid corpid',
        'state': state,
        'prompt': 'consent',
    }

    authorization_url = ORG_DINGTALK_AUTHORIZATION_URL + '?' + urllib.parse.urlencode(data)

    return HttpResponseRedirect(authorization_url)


@login_required
@org_staff_required
def org_dingtalk_bind_callback(request):
    if not org_dingtalk_check():
        return render_error(request, _('Feature is not enabled.'))

    code = request.GET.get('authCode', None)
    state = request.GET.get('state', None)

    logger.info('org bind callback state: %s, method: %s, auth_code: %s' % (
        state, request.method, code))

    # get corp_id
    user_access_token, corp_id = get_user_access_token(code)
    if not corp_id:
        logger.warning('can not get dingtalk corp_id, state: %s' % state)
        return render_error(request, '绑定出错，请尝试重启浏览器')

    exists_org_corp = OrgCorpAuth.objects.get_by_corp_id(corp_id)
    if not exists_org_corp:
        return render_error(request, '企业未授权开通 SeaTable 应用')
    if exists_org_corp and exists_org_corp.org_id:
        return render_error(request, '此钉钉已被绑定')

    # bind
    org_id = request.user.org.org_id
    exists_org_corp.org_id = org_id
    exists_org_corp.save(update_fields=['org_id'])

    return HttpResponseRedirect(reverse('org_settings'))


def org_dingtalk_oauth_login(request):
    """https://open.dingtalk.com/document/isvapp-server/obtain-identity-credentials
    """
    if not org_dingtalk_check():
        return render_error(request, _('Feature is not enabled.'))

    if request.user.is_authenticated:
        return HttpResponseRedirect(request.GET.get(auth.REDIRECT_FIELD_NAME, redirect_to))

    state = str(uuid.uuid4())
    logger.info('user login state: ' + state)
    request.session['org_dingtalk_oauth_redirect'] = request.GET.get(
        auth.REDIRECT_FIELD_NAME, redirect_to)
    redirect_uri = get_site_scheme_and_netloc() + reverse('org_dingtalk_oauth_callback')

    data = {
        'redirect_uri': redirect_uri,
        'response_type': 'code',
        'client_id': ORG_DINGTALK_SUITE_KEY,
        'scope': 'openid corpid',
        'state': state,
        'prompt': 'consent',
    }

    authorization_url = ORG_DINGTALK_AUTHORIZATION_URL + '?' + urllib.parse.urlencode(data)

    return HttpResponseRedirect(authorization_url)


def org_dingtalk_oauth_logon_free(request):
    """https://open.dingtalk.com/document/isvapp-client/logon-free-process
    """
    user_agent = request.META.get('HTTP_USER_AGENT', '').lower()
    if 'dingtalk' not in user_agent:
        return render_error(request, '请在钉钉客户端打开链接')
    return render(request, 'dingtalk_logon_free.html')


def org_dingtalk_oauth_callback(request):
    """https://open.dingtalk.com/document/isvapp-server/dingtalk-retrieve-user-information
    """
    if not org_dingtalk_check():
        return render_error(request, _('Feature is not enabled.'))

    code = request.GET.get('authCode', None)
    state = request.GET.get('state', None)
    is_logon_free = request.GET.get('logonFree', None)
    corp_id = request.GET.get('corpId', None)

    logger.info('user login callback state: %s, method: %s, auth_code: %s, is_logon_free: %s, corp_id: %s' % (
        state, request.method, code, is_logon_free, corp_id))

    org_dingtalk_oauth_redirect = request.session.get(
        'org_dingtalk_oauth_redirect', redirect_to)
    # clear session
    try:
        del request.session['org_dingtalk_oauth_redirect']
    except Exception as e:
        logger.warning(e)

    source = request.COOKIES.get('REGISTRATION_SOURCE', 'dingtalk')
    invitation_token = request.COOKIES.get('INVITATION_TOKEN', '')

    # get api user
    # logon free
    if is_logon_free == 'true':
        org_corp = OrgCorpAuth.objects.get_by_corp_id(corp_id)
        if not org_corp:
            return render_error(request, '企业未授权开通 SeaTable 应用')

        api_response_dic = get_logon_free_api_user(code, corp_id)
        if not api_response_dic:
            logger.warning('can not get dingtalk user info, state: %s' % state)
            return render_error(request, '登录出错，请尝试重启钉钉')
    # qrcode
    else:
        user_access_token, corp_id = get_user_access_token(code)
        if not user_access_token or not corp_id:
            logger.warning('can not get dingtalk user_access_token or corp_id, state: %s' % state)
            return render_error(request, '登录出错，请尝试重启钉钉或浏览器')

        org_corp = OrgCorpAuth.objects.get_by_corp_id(corp_id)
        if not org_corp:
            return render_error(request, '企业未授权开通 SeaTable 应用')

        api_response_dic = get_api_user(user_access_token)
        if not api_response_dic:
            logger.warning('can not get dingtalk user info, state: %s' % state)
            return render_error(request, '登录出错，请尝试重启钉钉或浏览器')

    # unionId
    if not api_response_dic.get('unionId', None):
        logger.warning('can not get unionId in dingtalk user info response, state: %s' % state)
        return render_error(request, '登录出错，请尝试重启钉钉或浏览器')

    # main
    user_id = api_response_dic.get('unionId')
    uid = corp_id + '_' + user_id
    org_id = org_corp.org_id
    if not org_id:
        # auto create org
        # org_admin
        org_admin = User.objects.create_oauth_user(is_active=True)

        # new_org
        url_prefix = gen_org_url_prefix(3)
        org_id = ccnet_api.create_org(org_corp.corp_name, url_prefix, org_admin.username)
        new_org = ccnet_api.get_org_by_id(org_id)

        # bind corp
        org_corp.org_id = org_id
        org_corp.save(update_fields=['org_id'])

        # profile
        extra_data = json.dumps(api_response_dic)
        SocialAuthUser.objects.add(
            org_admin.username, ORG_DINGTALK_PROVIDER, uid, extra_data)
        api_response_dic['username'] = org_admin.username
        update_dingtalk_user_info(api_response_dic)

        try:
            record_org_registration_logs(new_org, source)
            record_registration_logs(org_admin, source, invitation_token)
        except Exception as e:
            logger.warning('Failed to record registration log, error: %s' % e)

    # check org
    org = ccnet_api.get_org_by_id(org_id)
    if not org:
        return render_error(request, 'Organization %s not found.' % org_id)

    org_dingtalk_user = SocialAuthUser.objects.get_by_provider_and_uid(
        ORG_DINGTALK_PROVIDER, uid)
    if org_dingtalk_user:
        username = org_dingtalk_user.username
        is_new_user = False
    else:
        username = None
        is_new_user = True

    # check org member quota
    if is_new_user and ORG_MEMBER_QUOTA_ENABLED:
        org_members = ccnet_api.get_org_users_by_url_prefix(org.url_prefix, -1, -1)
        org_active_members = len([m for m in org_members if m.is_active])
        org_members_quota = OrgMemberQuota.objects.get_quota(org_id)
        if org_members_quota is not None and org_active_members >= org_members_quota:
            return render_error(request, '用户数已超')

    try:
        user = auth.authenticate(oauth_username=username)
    except User.DoesNotExist:
        user = None
    except Exception as e:
        logger.warning(e)
        return render_error(request, _('Internal Server Error'))

    if not user:
        return render_error(
            request, _('Error, new user registration is not allowed, please contact administrator.'))

    # bind
    if is_new_user:
        ccnet_api.add_org_user(org_id, user.username, int(False))
        extra_data = json.dumps(api_response_dic)
        SocialAuthUser.objects.add(
            user.username, ORG_DINGTALK_PROVIDER, uid, extra_data)

        try:
            record_registration_logs(user, source, invitation_token)
        except Exception as e:
            logger.warning('Failed to record registration log, error: %s' % e)

    if is_new_user or ORG_DINGTALK_USER_INFO_AUTO_UPDATE:
        api_response_dic['username'] = user.username
        update_dingtalk_user_info(api_response_dic)

    if not user.is_active:
        return render_error(
            request, '您钉钉关联的账号在团队 %s 中，现在是非激活状态，请联系团队管理员激活。' % org.org_name)

    # User is valid.  Set request.user and persist user in the session
    # by logging the user in.
    request.user = user
    request.session['remember_me'] = REMEMBER_ME
    auth.login(request, user)

    # generate auth token for Seafile client
    api_token = get_api_token(request)

    # redirect user to page
    response = HttpResponseRedirect(org_dingtalk_oauth_redirect)
    if source:
        response.delete_cookie('REGISTRATION_SOURCE')
    if invitation_token:
        response.delete_cookie('INVITATION_TOKEN')
    response.set_cookie('seahub_auth', user.username + '@' + api_token.key)
    return response


@login_required
@org_user_required
def org_dingtalk_oauth_connect(request):
    if not org_dingtalk_check():
        return render_error(request, _('Feature is not enabled.'))

    state = str(uuid.uuid4())
    logger.info('user bind state: ' + state)
    redirect_uri = get_site_scheme_and_netloc() + reverse('org_dingtalk_oauth_connect_callback')

    data = {
        'redirect_uri': redirect_uri,
        'response_type': 'code',
        'client_id': ORG_DINGTALK_SUITE_KEY,
        'scope': 'openid corpid',
        'state': state,
        'prompt': 'consent',
    }

    authorization_url = ORG_DINGTALK_AUTHORIZATION_URL + '?' + urllib.parse.urlencode(data)

    return HttpResponseRedirect(authorization_url)


@login_required
@org_user_required
def org_dingtalk_oauth_connect_callback(request):
    if not org_dingtalk_check():
        return render_error(request, _('Feature is not enabled.'))

    code = request.GET.get('authCode', None)
    state = request.GET.get('state', None)
    logger.info('user bind callback state: %s, method: %s, auth_code: %s' % (
        state, request.method, code))

    # get api user, corp_id
    user_access_token, corp_id = get_user_access_token(code)
    if not user_access_token or not corp_id:
        logger.warning('can not get dingtalk user_access_token or corp_id, state: %s' % state)
        return render_error(request, '绑定出错，请尝试重启钉钉或浏览器')

    org_corp = OrgCorpAuth.objects.get_by_corp_id(corp_id)
    if not org_corp:
        return render_error(request, '企业未授权开通 SeaTable 应用')

    api_response_dic = get_api_user(user_access_token)
    if not api_response_dic:
        logger.warning('can not get dingtalk user info, state: %s' % state)
        return render_error(request, '绑定出错，请尝试重启钉钉或浏览器')

    if not api_response_dic.get('unionId', None):
        logger.warning('can not get unionId in dingtalk user info response, state: %s' % state)
        return render_error(request, '绑定出错，请尝试重启钉钉或浏览器')

    # main
    user_id = api_response_dic.get('unionId')
    uid = corp_id + '_' + user_id
    org_id = org_corp.org_id
    if org_id != request.user.org.org_id:
        return render_error(request, '企业与 SeaTable 团队不匹配')
    org = ccnet_api.get_org_by_id(org_id)
    if not org:
        return render_error(request, 'Organization %s not found.' % org_id)

    uid = corp_id + '_' + user_id
    email = request.user.username

    dingtalk_user = SocialAuthUser.objects.get_by_provider_and_uid(ORG_DINGTALK_PROVIDER, uid)
    if dingtalk_user:
        logger.warning('dingtalk account already exists %s' % user_id)
        return render_error(request, '出错了，此钉钉账号已被绑定')

    extra_data = json.dumps(api_response_dic)
    SocialAuthUser.objects.add(email, ORG_DINGTALK_PROVIDER, uid, extra_data)

    # redirect user to page
    response = HttpResponseRedirect(get_site_scheme_and_netloc() + reverse('edit_profile'))
    return response


@login_required
@org_user_required
def org_dingtalk_oauth_disconnect(request):
    if not org_dingtalk_check():
        return render_error(request, _('Feature is not enabled.'))

    username = request.user.username
    if username[-(len(VIRTUAL_ID_EMAIL_DOMAIN)):] == VIRTUAL_ID_EMAIL_DOMAIN:
        profile = Profile.objects.get_profile_by_user(username)
        if not profile or not (profile.contact_email or profile.phone):
            return render_error(request, '出错了，当前账号不能解绑钉钉，请绑定手机号或邮箱后再试')

    SocialAuthUser.objects.delete_by_username_and_provider(username, ORG_DINGTALK_PROVIDER)

    # redirect user to page
    response = HttpResponseRedirect(request.GET.get(auth.REDIRECT_FIELD_NAME, redirect_to))
    return response
