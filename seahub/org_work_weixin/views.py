import uuid
import json
import requests
import logging
import xml.etree.cElementTree as ET
import urllib.parse

from django.http import HttpResponseRedirect
from django.http.response import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.translation import gettext as _
from django.urls import reverse

from seahub import auth, settings
from seahub.organizations.decorators import org_staff_required, org_user_required
from seahub.auth.decorators import login_required
from seahub.utils import render_error, get_site_scheme_and_netloc
from seahub.org_work_weixin.utils import get_wxcpt, org_work_weixin_pay
from seahub.org_work_weixin.settings import SUCCESS_MSG, ORG_WORK_WEIXIN_SUITE_ID, \
    ORG_WORK_WEIXIN_CORP_INSTALL_URL, ORG_WORK_WEIXIN_AUTHORIZATION_URL, \
    ORG_WORK_WEIXIN_GET_USER_INFO_URL, ORG_WORK_WEIXIN_PROVIDER, REMEMBER_ME, \
    ORG_WORK_WEIXIN_MOBILE_AUTHORIZATION_URL, ORG_WORK_WEIXIN_CORP_ID, \
    ORG_WORK_WEIXIN_GET_MOBILE_USER_INFO_URL, ORG_WORK_WEIXIN_AUTH_SCOPE, \
    ORG_WORK_WEIXIN_GET_MOBILE_USER_DETAIL_URL, ORG_WORK_WEIXIN_USER_INFO_AUTO_UPDATE, \
    ORG_WORK_WEIXIN_REGISTER_URL
from seahub.org_work_weixin.utils import set_suite_ticket, get_permanent_code, \
    add_corp, org_work_weixin_check, get_pre_auth_code, get_suite_access_token, \
    handler_org_work_weixin_api_response, get_provider_access_token, update_corp_info, logger, \
    get_register_code, update_org_work_weixin_user_info
from seahub.organizations.models import OrgCorpAuth, OrgMemberQuota
from seahub.auth.models import SocialAuthUser
from seahub.base.accounts import User
from seahub.profile.models import Profile
from seahub.utils.auth import VIRTUAL_ID_EMAIL_DOMAIN
from seahub.api2.utils import get_api_token
from seahub.organizations.settings import ORG_MEMBER_QUOTA_ENABLED
from seahub.organizations.utils import gen_org_url_prefix
from seahub.invitations.utils import record_registration_logs, record_org_registration_logs

redirect_to = settings.LOGIN_REDIRECT_URL


@csrf_exempt
def receive_msg_view(request):
    """
    接收消息
    https://work.weixin.qq.com/api/doc/90000/90135/90238
    """
    wxcpt = get_wxcpt(request.method)

    # 验证URL有效性
    if request.method == 'GET':
        msg_signature = request.GET.get('msg_signature')
        timestamp = request.GET.get('timestamp')
        nonce = request.GET.get('nonce')
        echostr = request.GET.get('echostr')

        ret, xml_data = wxcpt.VerifyURL(
            msg_signature, timestamp, nonce, echostr)

        if ret != 0:
            logger.warning('wxcpt.VerifyURL %s error.' % ret)
            return HttpResponse(SUCCESS_MSG)

        return HttpResponse(xml_data)

    # 接收消息
    elif request.method == 'POST':
        return HttpResponse(SUCCESS_MSG)

    else:
        return HttpResponse(SUCCESS_MSG)


@csrf_exempt
def receive_suite_view(request):
    """
    接收指令回调
    https://work.weixin.qq.com/api/doc/90001/90143/90628
    """
    wxcpt = get_wxcpt(request.method)

    # 验证URL有效性
    if request.method == 'GET':
        msg_signature = request.GET.get('msg_signature')
        timestamp = request.GET.get('timestamp')
        nonce = request.GET.get('nonce')
        echostr = request.GET.get('echostr')

        ret, xml_data = wxcpt.VerifyURL(
            msg_signature, timestamp, nonce, echostr)

        if ret != 0:
            logger.warning('wxcpt.VerifyURL %s error.' % ret)
            return HttpResponse(SUCCESS_MSG)

        return HttpResponse(xml_data)

    # 接收指令回调
    if request.method == 'POST':
        msg_signature = request.GET.get('msg_signature')
        timestamp = request.GET.get('timestamp')
        nonce = request.GET.get('nonce')

        data = request.body

        ret, xml_data = wxcpt.DecryptMsg(
            data, msg_signature, timestamp, nonce)

        if ret != 0:
            logger.warning('wxcpt.DecryptMsg %s error.' % ret)
            return HttpResponse(SUCCESS_MSG)

        xml_tree = ET.fromstring(xml_data)
        suite_id = xml_tree.find('SuiteId').text
        info_type = xml_tree.find('InfoType').text
        time_stamp = xml_tree.find('TimeStamp').text

        # suite_ticket
        if info_type == 'suite_ticket':
            suite_ticket = xml_tree.find('SuiteTicket').text
            logger.info('org work weixin suite_ticket: ' + suite_ticket)
            set_suite_ticket(suite_ticket)

        # create_auth from work weixin app market
        elif info_type == 'create_auth':
            auth_code = xml_tree.find('AuthCode').text
            logger.info('org work weixin auth_code: ' + auth_code)
            corp_info = get_permanent_code(auth_code)
            org_corp = add_corp(corp_info, None)

        # change_auth
        elif info_type == 'change_auth':
            auth_corp_id = xml_tree.find('AuthCorpId').text
            org_corp = update_corp_info(auth_corp_id)

        # cancel_auth
        elif info_type == 'cancel_auth':
            auth_corp_id = xml_tree.find('AuthCorpId').text
            OrgCorpAuth.objects.filter(corp_id=auth_corp_id).delete()
            SocialAuthUser.objects.filter(
                provider=ORG_WORK_WEIXIN_PROVIDER, uid__contains=auth_corp_id).delete()

        # register_corp
        elif info_type == 'register_corp':
            register_code = xml_tree.find('RegisterCode').text
            auth_corp_id = xml_tree.find('AuthCorpId').text
            logger.info('org work weixin RegisterCode: ' + register_code + ', AuthCorpId: ' + auth_corp_id)

        # pay for app success
        elif info_type == 'pay_for_app_success':
            paid_corp_id = xml_tree.find('PaidCorpId').text
            order_id = xml_tree.find('OrderId').text
            logger.info('org work weixin pay_for_app_success PaidCorpId: ' + paid_corp_id + ', OrderId: ' + order_id)
            org_work_weixin_pay(info_type, order_id, paid_corp_id)

        # refund
        elif info_type == 'refund':
            paid_corp_id = xml_tree.find('PaidCorpId').text
            order_id = xml_tree.find('OrderId').text
            logger.info('org work weixin refund PaidCorpId: ' + paid_corp_id + ', OrderId: ' + order_id)
            org_work_weixin_pay(info_type, order_id, paid_corp_id)

        return HttpResponse(SUCCESS_MSG)

    else:
        return HttpResponse(SUCCESS_MSG)


@login_required
@org_staff_required
def org_work_weixin_bind(request):
    """https://work.weixin.qq.com/api/doc/90001/90143/90597
    """
    if not org_work_weixin_check():
        return render_error(request, _('Feature is not enabled.'))

    org_id = request.user.org.org_id
    exists_org_corp = OrgCorpAuth.objects.get_by_org_id(org_id)
    if exists_org_corp and exists_org_corp.corp_id:
        return render_error(request, '企业已经绑定 SeaTable 团队')

    state = str(uuid.uuid4())
    logger.info('org bind state: ' + state)

    pre_auth_code = get_pre_auth_code()
    data = {
        'suite_id': ORG_WORK_WEIXIN_SUITE_ID,
        'pre_auth_code': pre_auth_code,
        'redirect_uri': get_site_scheme_and_netloc() + reverse('org_work_weixin_bind_callback'),
        'state': state,
    }
    bind_url = ORG_WORK_WEIXIN_CORP_INSTALL_URL + \
        '?' + urllib.parse.urlencode(data)

    return HttpResponseRedirect(bind_url)


@login_required
@org_staff_required
def org_work_weixin_bind_callback(request):
    if not org_work_weixin_check():
        return render_error(request, _('Feature is not enabled.'))

    auth_code = request.GET.get('auth_code', None)
    state = request.GET.get('state', None)

    user_agent = request.META.get('HTTP_USER_AGENT', '').lower()
    is_mobile = 'micromessenger' in user_agent
    logger.info('org bind callback state: %s, method: %s, is_mobile: %s, auth_code: %s' % (
        state, request.method, is_mobile, auth_code))

    # get corp info
    org_id = request.user.org.org_id
    corp_info = get_permanent_code(auth_code)
    if not corp_info:
        logger.warning(
            'can not get corp_info from work weixin request')
        return render_error(request, '绑定出错，请尝试重启浏览器')

    org_corp = add_corp(corp_info, org_id)

    return HttpResponseRedirect(reverse('org_settings'))


def org_work_weixin_oauth_login(request):
    """QR: https://work.weixin.qq.com/api/doc/90001/90143/91124
    Moblie: https://work.weixin.qq.com/api/doc/90001/90143/91120
    """
    if not org_work_weixin_check():
        return render_error(request, _('Feature is not enabled.'))

    if request.user.is_authenticated:
        return HttpResponseRedirect(request.GET.get(auth.REDIRECT_FIELD_NAME, redirect_to))

    state = str(uuid.uuid4())
    logger.info('user login state: ' + state)

    request.session['org_work_weixin_oauth_redirect'] = request.GET.get(
        auth.REDIRECT_FIELD_NAME, redirect_to)
    redirect_uri = get_site_scheme_and_netloc() + reverse('org_work_weixin_oauth_callback')

    user_agent = request.META.get('HTTP_USER_AGENT', '').lower()
    if 'mobile' in user_agent and 'micromessenger' not in user_agent:
        return render_error(request, '请在企业微信客户端打开链接')

    # work weixin client
    if 'micromessenger' in user_agent:
        data = {
            'appid': ORG_WORK_WEIXIN_SUITE_ID,
            'response_type': 'code',
            'redirect_uri': redirect_uri,
            'scope': ORG_WORK_WEIXIN_AUTH_SCOPE,
            'state': state,
        }
        url = ORG_WORK_WEIXIN_MOBILE_AUTHORIZATION_URL
    # QR
    else:
        data = {
            'appid': ORG_WORK_WEIXIN_CORP_ID,
            'redirect_uri': redirect_uri,
            'state': state,
            'usertype': 'member',
        }
        url = ORG_WORK_WEIXIN_AUTHORIZATION_URL

    authorization_url = url + '?' + \
        urllib.parse.urlencode(data) + '#wechat_redirect'

    return HttpResponseRedirect(authorization_url)


def org_work_weixin_oauth_callback(request):
    if not org_work_weixin_check():
        return render_error(request, _('Feature is not enabled.'))

    user_agent = request.META.get('HTTP_USER_AGENT', '').lower()
    # work weixin client
    if 'micromessenger' in user_agent:
        code = request.GET.get('code', None)
    # QR
    else:
        code = request.GET.get('auth_code', None)

    state = request.GET.get('state', None)

    org_work_weixin_oauth_redirect = request.session.get(
        'org_work_weixin_oauth_redirect', redirect_to)
    # clear session
    try:
        del request.session['org_work_weixin_oauth_redirect']
    except Exception as e:
        logger.warning(e)

    source = request.COOKIES.get('REGISTRATION_SOURCE', 'work-weixin')
    invitation_token = request.COOKIES.get('INVITATION_TOKEN', '')

    is_mobile = 'micromessenger' in user_agent
    logger.info('user login callback state: %s, method: %s, is_mobile: %s, auth_code: %s' % (
        state, request.method, is_mobile, code))

    # get api user
    # work weixin client
    if 'micromessenger' in user_agent:
        suite_access_token = get_suite_access_token()
        if not suite_access_token:
            logger.warning('can not get work weixin suite_access_token, state: %s' % state)
            return render_error(request, _('Internal Server Error'))
        # https://work.weixin.qq.com/api/doc/90001/90143/91121
        data = {
            'suite_access_token': suite_access_token,
            'code': code,
        }
        api_response = requests.get(ORG_WORK_WEIXIN_GET_MOBILE_USER_INFO_URL, params=data)
        api_response_dic = handler_org_work_weixin_api_response(api_response)
        if not api_response_dic:
            logger.warning('can not get mobile work weixin user info, state: %s' % state)
            return render_error(request, '登录出错，请尝试重启企业微信或浏览器')
        # avatar
        # https://work.weixin.qq.com/api/doc/90001/90143/91122
        if ORG_WORK_WEIXIN_AUTH_SCOPE == 'snsapi_privateinfo' and api_response_dic.get('user_ticket'):
            try:
                detail_data = {
                    'user_ticket': api_response_dic.get('user_ticket'),
                }
                datail_url = ORG_WORK_WEIXIN_GET_MOBILE_USER_DETAIL_URL + '?suite_access_token=' + suite_access_token
                datail_api_response = requests.post(datail_url, json=detail_data)
                datail_api_response_dic = handler_org_work_weixin_api_response(datail_api_response)
                api_response_dic.update(datail_api_response_dic)
            except Exception as e:
                logger.warning(e)
    # QR
    else:
        provider_access_token = get_provider_access_token()
        if not provider_access_token:
            logger.warning('can not get work weixin provider_access_token, state: %s' % state)
            return render_error(request, _('Internal Server Error'))
        # https://work.weixin.qq.com/api/doc/90001/90143/91125
        data = {
            'auth_code': code,
        }
        url = ORG_WORK_WEIXIN_GET_USER_INFO_URL + '?access_token=' + provider_access_token
        api_response = requests.post(url, json=data)
        api_response_dic = handler_org_work_weixin_api_response(api_response)
        if not api_response_dic:
            logger.warning('can not get work weixin user info, state: %s' % state)
            return render_error(request, '登录出错，请尝试重启企业微信或浏览器')
        api_response_dic['UserId'] = api_response_dic.get('user_info', {}).get('userid')
        api_response_dic['avatar'] = api_response_dic.get('user_info', {}).get('avatar')
        api_response_dic['CorpId'] = api_response_dic.get('corp_info', {}).get('corpid')

    if not api_response_dic.get('UserId', None):
        logger.warning('can not get UserId in work weixin user info response, state: %s' % state)
        return render_error(request, '登录出错，请尝试重启企业微信或浏览器')

    # main
    user_id = api_response_dic.get('UserId')
    corp_id = api_response_dic.get('CorpId')
    uid = corp_id + '_' + user_id
    org_corp = OrgCorpAuth.objects.get_by_corp_id(corp_id)
    if not org_corp:
        return render_error(request, '企业未授权开通 SeaTable 应用')

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
            org_admin.username, ORG_WORK_WEIXIN_PROVIDER, uid, extra_data)
        api_response_dic['username'] = org_admin.username
        update_org_work_weixin_user_info(api_response_dic)

        try:
            record_org_registration_logs(new_org, source)
            record_registration_logs(org_admin, source, invitation_token)
        except Exception as e:
            logger.warning('Failed to record registration log, error: %s' % e)

    # check org
    org = ccnet_api.get_org_by_id(org_id)
    if not org:
        return render_error(request, 'Organization %s not found.' % org_id)

    org_work_weixin_user = SocialAuthUser.objects.get_by_provider_and_uid(
        ORG_WORK_WEIXIN_PROVIDER, uid)
    if org_work_weixin_user:
        username = org_work_weixin_user.username
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
            user.username, ORG_WORK_WEIXIN_PROVIDER, uid, extra_data)

        try:
            record_registration_logs(user, source, invitation_token)
        except Exception as e:
            logger.warning('Failed to record registration log, error: %s' % e)

    if is_new_user or ORG_WORK_WEIXIN_USER_INFO_AUTO_UPDATE:
        api_response_dic['username'] = user.username
        update_org_work_weixin_user_info(api_response_dic)

    if not user.is_active:
        return render_error(
            request, '您企业微信关联的账号在团队 %s 中，现在是非激活状态，请联系团队管理员激活。' % org.org_name)

    # User is valid.  Set request.user and persist user in the session
    # by logging the user in.
    request.user = user
    request.session['remember_me'] = REMEMBER_ME
    auth.login(request, user)

    # generate auth token for Seafile client
    api_token = get_api_token(request)

    # redirect user to page
    response = HttpResponseRedirect(org_work_weixin_oauth_redirect)
    if source:
        response.delete_cookie('REGISTRATION_SOURCE')
    if invitation_token:
        response.delete_cookie('INVITATION_TOKEN')
    response.set_cookie('seahub_auth', user.username + '@' + api_token.key)
    return response


@login_required
@org_user_required
def org_work_weixin_oauth_connect(request):
    if not org_work_weixin_check():
        return render_error(request, _('Feature is not enabled.'))

    state = str(uuid.uuid4())
    logger.info('user bind state: ' + state)

    data = {
        'appid': ORG_WORK_WEIXIN_CORP_ID,
        'redirect_uri': get_site_scheme_and_netloc() + reverse('org_work_weixin_oauth_connect_callback'),
        'state': state,
        'usertype': 'member',
    }
    authorization_url = ORG_WORK_WEIXIN_AUTHORIZATION_URL + '?' + urllib.parse.urlencode(data) + '#wechat_redirect'

    return HttpResponseRedirect(authorization_url)


@login_required
@org_user_required
def org_work_weixin_oauth_connect_callback(request):
    if not org_work_weixin_check():
        return render_error(request, _('Feature is not enabled.'))

    code = request.GET.get('auth_code', None)
    state = request.GET.get('state', None)

    user_agent = request.META.get('HTTP_USER_AGENT', '').lower()
    is_mobile = 'micromessenger' in user_agent
    logger.info('user bind callback state: %s, method: %s, is_mobile: %s, auth_code: %s' % (
        state, request.method, is_mobile, code))

    # get api user
    provider_access_token = get_provider_access_token()
    if not provider_access_token:
        logger.warning('can not get work weixin provider_access_token, state: %s' % state)
        return render_error(request, _('Internal Server Error'))
    # https://work.weixin.qq.com/api/doc/90001/90143/91125
    data = {
        'auth_code': code,
    }
    url = ORG_WORK_WEIXIN_GET_USER_INFO_URL + '?access_token=' + provider_access_token
    api_response = requests.post(url, json=data)
    api_response_dic = handler_org_work_weixin_api_response(api_response)

    if not api_response_dic:
        logger.warning('can not get work weixin user info, state: %s' % state)
        return render_error(request, '绑定出错，请尝试重启企业微信或浏览器')

    # main
    user_id = api_response_dic.get('user_info', {}).get('userid')
    corp_id = api_response_dic.get('corp_info', {}).get('corpid')
    org_corp = OrgCorpAuth.objects.get_by_corp_id(corp_id)
    if not org_corp:
        return render_error(request, '企业未授权开通 SeaTable 应用')
    org_id = org_corp.org_id
    if org_id != request.user.org.org_id:
        return render_error(request, '企业与 SeaTable 团队不匹配')
    org = ccnet_api.get_org_by_id(org_id)
    if not org:
        return render_error(request, 'Organization %s not found.' % org_id)

    uid = corp_id + '_' + user_id
    email = request.user.username

    work_weixin_user = SocialAuthUser.objects.get_by_provider_and_uid(ORG_WORK_WEIXIN_PROVIDER, uid)
    if work_weixin_user:
        logger.warning('work weixin account already exists %s' % user_id)
        return render_error(request, '出错了，此企业微信账号已被绑定')

    extra_data = json.dumps(api_response_dic)
    SocialAuthUser.objects.add(email, ORG_WORK_WEIXIN_PROVIDER, uid, extra_data)

    # redirect user to page
    response = HttpResponseRedirect(get_site_scheme_and_netloc() + reverse('edit_profile'))
    return response


@login_required
@org_user_required
def org_work_weixin_oauth_disconnect(request):
    if not org_work_weixin_check():
        return render_error(request, _('Feature is not enabled.'))

    username = request.user.username
    if username[-(len(VIRTUAL_ID_EMAIL_DOMAIN)):] == VIRTUAL_ID_EMAIL_DOMAIN:
        profile = Profile.objects.get_profile_by_user(username)
        if not profile or not (profile.contact_email or profile.phone):
            return render_error(request, '出错了，当前账号不能解绑企业微信，请绑定手机号或邮箱后再试')

    SocialAuthUser.objects.delete_by_username_and_provider(username, ORG_WORK_WEIXIN_PROVIDER)

    # redirect user to page
    response = HttpResponseRedirect(request.GET.get(auth.REDIRECT_FIELD_NAME, redirect_to))
    return response


def org_work_weixin_install(request):
    """ push button from seatable.cn
        https://work.weixin.qq.com/api/doc/90001/90143/90597
    """
    if not org_work_weixin_check():
        return render_error(request, _('Feature is not enabled.'))

    if request.user.is_authenticated:
        return HttpResponseRedirect(request.GET.get(auth.REDIRECT_FIELD_NAME, redirect_to))

    state = str(uuid.uuid4())
    logger.info('install state: ' + state)

    pre_auth_code = get_pre_auth_code()
    data = {
        'suite_id': ORG_WORK_WEIXIN_SUITE_ID,
        'pre_auth_code': pre_auth_code,
        'redirect_uri': get_site_scheme_and_netloc() + reverse('org_work_weixin_install_callback'),
        'state': state,
    }
    bind_url = ORG_WORK_WEIXIN_CORP_INSTALL_URL + \
        '?' + urllib.parse.urlencode(data)

    return HttpResponseRedirect(bind_url)


def org_work_weixin_install_callback(request):
    if not org_work_weixin_check():
        return render_error(request, _('Feature is not enabled.'))

    auth_code = request.GET.get('auth_code', None)
    state = request.GET.get('state', None)

    user_agent = request.META.get('HTTP_USER_AGENT', '').lower()
    is_mobile = 'micromessenger' in user_agent
    logger.info('install callback state: %s, method: %s, is_mobile: %s, auth_code: %s' % (
        state, request.method, is_mobile, auth_code))

    # get corp info
    corp_info = get_permanent_code(auth_code)
    if not corp_info:
        logger.warning(
            'can not get corp_info from work weixin request')
        return render_error(request, '安装出错，请尝试重启浏览器')

    org_corp = add_corp(corp_info, None)

    return HttpResponseRedirect(redirect_to)


def org_work_weixin_register(request):
    """ push button from seatable.cn
        https://developer.work.weixin.qq.com/document/path/90805
    """
    if not org_work_weixin_check():
        return render_error(request, _('Feature is not enabled.'))

    if request.user.is_authenticated:
        return HttpResponseRedirect(request.GET.get(auth.REDIRECT_FIELD_NAME, redirect_to))

    register_code = get_register_code()
    logger.info('register code: %s' % register_code)
    register_url = ORG_WORK_WEIXIN_REGISTER_URL + '?register_code=' + register_code

    return HttpResponseRedirect(register_url)


def org_work_weixin_org_manage_callback(request):
    """ push button from wework_admin
    https://developer.work.weixin.qq.com/document/path/91157
    """
    if not org_work_weixin_check():
        return render_error(request, _('Feature is not enabled.'))

    if request.user.is_authenticated:
        return HttpResponseRedirect(reverse('org_manage'))

    code = request.GET.get('auth_code', None)

    # get api user
    provider_access_token = get_provider_access_token()
    if not provider_access_token:
        logger.warning('can not get work weixin provider_access_token')
        return render_error(request, _('Internal Server Error'))
    # https://work.weixin.qq.com/api/doc/90001/90143/91125
    data = {
        'auth_code': code,
    }
    url = ORG_WORK_WEIXIN_GET_USER_INFO_URL + '?access_token=' + provider_access_token
    api_response = requests.post(url, json=data)
    api_response_dic = handler_org_work_weixin_api_response(api_response)

    if not api_response_dic:
        logger.warning('can not get work weixin user info')
        return render_error(request, '登录出错，请尝试重启企业微信或浏览器')

    # main
    user_id = api_response_dic.get('user_info', {}).get('userid')
    corp_id = api_response_dic.get('corp_info', {}).get('corpid')
    org_corp = OrgCorpAuth.objects.get_by_corp_id(corp_id)
    if not org_corp:
        return render_error(request, '企业未授权开通 SeaTable 应用')

    org_id = org_corp.org_id
    # check org
    org = ccnet_api.get_org_by_id(org_id)
    if not org:
        return render_error(request, 'Organization %s not found.' % org_id)

    uid = corp_id + '_' + user_id
    work_weixin_user = SocialAuthUser.objects.get_by_provider_and_uid(ORG_WORK_WEIXIN_PROVIDER, uid)
    if work_weixin_user:
        username = work_weixin_user.username
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

    # auth
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
    if not user.is_active:
        return render_error(
            request, _('Your account is created successfully, please wait for administrator to activate your account.'))

    # bind
    if is_new_user:
        ccnet_api.add_org_user(org_id, user.username, int(True))  # auto set_org_staff
        extra_data = json.dumps(api_response_dic)
        SocialAuthUser.objects.add(
            user.username, ORG_WORK_WEIXIN_PROVIDER, uid, extra_data)

        try:
            record_registration_logs(user, 'work-weixin', '')
        except Exception as e:
            logger.warning('Failed to record registration log, error: %s' % e)

    if is_new_user or ORG_WORK_WEIXIN_USER_INFO_AUTO_UPDATE:
        api_response_dic['username'] = user.username
        api_response_dic['UserId'] = user_id
        api_response_dic['CorpId'] = corp_id
        update_org_work_weixin_user_info(api_response_dic)

    # auto set_org_staff
    if not ccnet_api.is_org_staff(org_id, user.username):
        ccnet_api.set_org_staff(org_id, user.username)

    # User is valid.  Set request.user and persist user in the session
    # by logging the user in.
    request.user = user
    request.session['remember_me'] = REMEMBER_ME
    auth.login(request, user)

    # generate auth token for Seafile client
    api_token = get_api_token(request)
    response = HttpResponseRedirect(reverse('org_manage'))
    response.set_cookie('seahub_auth', user.username + '@' + api_token.key)

    return response
