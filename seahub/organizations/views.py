# Copyright (c) 2012-2016 Seafile Ltd.
# encoding: utf-8
import re
import time
import logging
import json
from urllib.parse import urlparse
from constance import config

from rest_framework.decorators import api_view, throttle_classes
from django.conf import settings
from django.contrib import messages
from django.urls import reverse
from django.http import HttpResponse, Http404, HttpResponseRedirect
from django.shortcuts import render
from django.utils.crypto import get_random_string
from django.utils.translation import gettext_lazy as _
from django.views.decorators.csrf import csrf_protect

import seaserv
from seaserv import seafile_api, get_group, get_group_members, ccnet_api

from seahub.auth import login, REDIRECT_FIELD_NAME
from seahub.auth.decorators import login_required, login_required_ajax
from seahub.base.decorators import require_POST
from seahub.base.accounts import User
from seahub.base.models import UserLastLogin
from seahub.constants import DEFAULT_USER, ORG_DEFAULT
from seahub.forms import AddUserForm
from seahub.group.views import remove_group_common
from seahub.profile.models import Profile
from seahub.profile.utils import convert_contact_emails
from seahub.utils import is_valid_username, IS_EMAIL_CONFIGURED, get_service_url, string2list,\
    render_error, check_slide_captcha_verified_time
from seahub.utils.file_size import get_file_size_unit
from seahub.utils.auth import get_login_bg_image_path
from seahub.views.sysadmin import email_user_on_activation, populate_user_info, \
        send_user_add_mail, send_user_reset_email
from seahub.organizations.signals import org_created
from seahub.organizations.decorators import org_staff_required
from seahub.organizations.forms import OrgRegistrationForm, SmsOrgRegistrationForm
from seahub.organizations.settings import ORG_AUTO_URL_PREFIX, ORG_MEMBER_QUOTA_ENABLED, ENABLE_ORG_LOGO
from seahub.organizations.utils import get_or_create_invitation_link, \
    transfer_user_to_org, get_org_corp_bind_type, can_org_use_saml
from seahub.organizations.models import OrgSettings
from seahub.subscription.utils import subscription_check
from seahub.org_work_weixin.utils import org_work_weixin_check
from seahub.org_dingtalk.utils import org_dingtalk_check
from seahub.invitations.utils import record_registration_logs, record_org_registration_logs
from seahub.utils.two_factor_auth import has_two_factor_auth
from seahub.profile.models import Profile
from seahub.utils.ip import get_remote_ip
from seahub.utils.user_permissions import get_user_role
from seahub.api2.throttling import OrgRegisterRateThrottle
from seahub.settings import ENABLE_SLIDE_CAPTCHA, ENABLE_MULTI_SAML

SESSION_KEY_SMS_ORG_REGISTRATION_PHONE = 'sms-org-registration-phone'
SESSION_KEY_SMS_ORG_REGISTRATION_LOCK_TIME = 'sms-org-registration-lock-time'
SMS_ORG_REGISTRATION_SMS_TYPE = 'sms-org-registration'

# Get an instance of a logger
logger = logging.getLogger(__name__)


# ccnet rpc wrapper
def create_org(org_name, url_prefix, creator):
    return ccnet_api.create_org(org_name, url_prefix, creator)


def count_orgs():
    return ccnet_api.count_orgs()


def get_org_by_url_prefix(url_prefix):
    return ccnet_api.get_org_by_url_prefix(url_prefix)


def set_org_user(org_id, username, is_staff=False):
    return ccnet_api.add_org_user(org_id, username, int(is_staff))


def unset_org_user(org_id, username):
    return ccnet_api.remove_org_user(org_id, username)


def org_user_exists(org_id, username):
    return ccnet_api.org_user_exists(org_id, username)


def get_org_groups(org_id, start, limit):
    return ccnet_api.get_org_groups(org_id, start, limit)


def get_org_id_by_group(group_id):
    return ccnet_api.get_org_id_by_group(group_id)


def remove_org_group(org_id, group_id, username):
    remove_group_common(group_id, username)
    ccnet_api.remove_org_group(org_id, group_id)


def is_org_staff(org_id, username):
    return ccnet_api.is_org_staff(org_id, username)


def set_org_staff(org_id, username):
    return ccnet_api.set_org_staff(org_id, username)


def unset_org_staff(org_id, username):
    return ccnet_api.unset_org_staff(org_id, username)


# seafile rpc wrapper
def get_org_user_self_usage(org_id, username):
    """

    Arguments:
    - `org_id`:
    - `username`:
    """
    return seafile_api.get_org_user_quota_usage(org_id, username)


def get_org_user_quota(org_id, username):
    return seafile_api.get_org_user_quota(org_id, username)


def get_org_quota(org_id):
    return seafile_api.get_org_quota(org_id)


def is_org_repo(org_id, repo_id):
    return True if seafile_api.get_org_id_by_repo_id(
        repo_id) == org_id else False


# views
@login_required_ajax
def org_add(request):
    """Handle ajax request to add org, and create org owner.

    Arguments:
    - `request`:
    """
    if not request.user.is_staff or request.method != 'POST':
        raise Http404

    content_type = 'application/json; charset=utf-8'

    url_prefix = gen_org_url_prefix(3)
    post_data = request.POST.copy()
    post_data['url_prefix'] = url_prefix
    form = OrgRegistrationForm(post_data)
    if form.is_valid():
        email = form.cleaned_data['email']
        password = form.cleaned_data['password1']
        org_name = form.cleaned_data['org_name']
        url_prefix = form.cleaned_data['url_prefix']

        try:
            new_user = User.objects.create_user(email, password,
                                                is_staff=False, is_active=True)
        except User.DoesNotExist as e:
            logger.error(e)
            err_msg = 'Fail to create organization owner %s.' % email
            return HttpResponse(json.dumps({'error': err_msg}),
                                status=403, content_type=content_type)
        create_org(org_name, url_prefix, new_user.username)

        return HttpResponse(json.dumps({'success': True}),
                            content_type=content_type)
    else:
        try:
            err_msg = list(form.errors.values())[0][0]
        except IndexError:
            err_msg = list(form.errors.values())[0]
        return HttpResponse(json.dumps({'error': str(err_msg)}),
                            status=400, content_type=content_type)


def gen_org_url_prefix(max_trial=None):
    """Generate organization url prefix automatically.
    If ``max_trial`` is large than 0, then re-try that times if failed.

    Arguments:
    - `max_trial`:

    Returns:
        Url prefix if succed, otherwise, ``None``.
    """
    def _gen_prefix():
        url_prefix = 'org-' + get_random_string(
            6, allowed_chars='abcdefghijklmnopqrstuvwxyz0123456789')
        if get_org_by_url_prefix(url_prefix) is not None:
            logger.info("org url prefix, %s is duplicated" % url_prefix)
            return None
        else:
            return url_prefix

    try:
        max_trial = int(max_trial)
    except (TypeError, ValueError):
        max_trial = 0

    while max_trial >= 0:
        ret = _gen_prefix()
        if ret is not None:
            return ret
        else:
            max_trial -= 1

    logger.warning("Failed to generate org url prefix, retry: %d" % max_trial)
    return None


@api_view(['GET', 'POST'])
@throttle_classes([OrgRegisterRateThrottle])
def org_register(request, redirect_field_name=REDIRECT_FIELD_NAME):
    """Allow a new user to register an organization account. A new
    organization will be created associate with that user.

    Arguments:
    - `request`:
    """

    if settings.USE_PHONE_REGISTRATION_BY_DEFAULT:
        raise Http404

    login_bg_image_path = get_login_bg_image_path()
    redirect_to = request.GET.get(redirect_field_name)

    if request.method == 'POST':
        form = OrgRegistrationForm(request.POST)

        if ORG_AUTO_URL_PREFIX:
            # generate url prefix automatically
            url_prefix = gen_org_url_prefix(3)
            if url_prefix is None:
                messages.error(request, "Failed to create organization account, please try again later.")
                return render(request, 'organizations/org_register.html', {
                    'form': form,
                    'login_bg_image_path': login_bg_image_path,
                    'org_auto_url_prefix': ORG_AUTO_URL_PREFIX,
                })

        if form.is_valid():
            name = form.cleaned_data['name']
            email = form.cleaned_data['email']
            password = form.cleaned_data['password1']
            org_name = form.cleaned_data['org_name']

            new_user = User.objects.create_user(email, password,
                                                is_staff=False, is_active=True)
            create_org(org_name, url_prefix, new_user.username)
            new_org = get_org_by_url_prefix(url_prefix)
            org_created.send(sender=None, org=new_org)
            OrgSettings.objects.add_or_update(new_org, ORG_DEFAULT)

            # record the org's register IP to dtable_web.log
            remote_address = request.META.get('REMOTE_ADDR', '')
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR', '')
            if x_forwarded_for:
                remote_address = x_forwarded_for.split(',')[0]
            logger.warning('Org %s register IP is: %s' % (org_name, remote_address))

            if name:
                Profile.objects.add_or_update(new_user.username, name)

            # login the user
            new_user.backend = settings.AUTHENTICATION_BACKENDS[0]
            login(request, new_user)

            if not redirect_to:
                response = HttpResponseRedirect(reverse('dtable'))
            else:
                response = HttpResponseRedirect(redirect_to)

            source = request.COOKIES.get('REGISTRATION_SOURCE', '')
            invitation_token = request.COOKIES.get('INVITATION_TOKEN', '')
            try:
                record_org_registration_logs(new_org, source)
                record_registration_logs(new_user, source, invitation_token)
            except Exception as e:
                logger.warning('Failed to record registration log, error: %s' % e)

            response.delete_cookie('REGISTRATION_SOURCE')
            response.delete_cookie('INVITATION_TOKEN')
            return response
    else:
        form = OrgRegistrationForm()

    service_url = get_service_url()
    up = urlparse(service_url)
    service_url_scheme = up.scheme
    service_url_remaining = up.netloc + up.path

    return render(request, 'organizations/org_register.html', {
        'form': form,
        'login_bg_image_path': login_bg_image_path,
        'service_url_scheme': service_url_scheme,
        'service_url_remaining': service_url_remaining,
        'org_auto_url_prefix': ORG_AUTO_URL_PREFIX,
        'redirect_to': redirect_to or reverse('dtable'),
    })


def clear_sms_org_registration_session(request):
    for key in (SESSION_KEY_SMS_ORG_REGISTRATION_PHONE,
                SESSION_KEY_SMS_ORG_REGISTRATION_LOCK_TIME):
        request.session.pop(key, '')
    return


def render_sms_org_registration_error(request, redirect_to, error_msg, send_button_disabled, phone):
    from seahub.auth import REDIRECT_FIELD_NAME
    service_url = get_service_url()
    up = urlparse(service_url)
    service_url_scheme = up.scheme
    service_url_remaining = up.netloc + up.path
    return render(request, 'organizations/sms_org_register.html', {
        'ENABLE_SLIDE_CAPTCHA': ENABLE_SLIDE_CAPTCHA,
        'form': SmsOrgRegistrationForm(),
        REDIRECT_FIELD_NAME: redirect_to or reverse('dtable'),
        'redirect_to': redirect_to or reverse('dtable'),
        'login_bg_image_path': get_login_bg_image_path(),
        'error_msg': error_msg,
        'send_button_disabled': send_button_disabled,
        'phone': phone,
        'service_url_scheme': service_url_scheme,
        'service_url_remaining': service_url_remaining,
        'org_auto_url_prefix': ORG_AUTO_URL_PREFIX,
        'redirect_to': redirect_to or reverse('dtable'),
    })


def render_sms_org_registration_json_error(error_msg):
    return HttpResponse(json.dumps({'error': error_msg}), content_type='application/json')

@csrf_protect
@api_view(['GET', 'POST'])
@throttle_classes([OrgRegisterRateThrottle])
def sms_org_register(request, redirect_field_name=REDIRECT_FIELD_NAME):
    from seahub.auth.utils import get_send_sms_attempts, increase_send_sms_attempts, clear_send_sms_attempts
    from seahub.utils.verify import get_random_code, set_sms_verify_code_cache, check_phone, verify_sms_code

    if not settings.USE_PHONE_REGISTRATION_BY_DEFAULT:
        raise Http404

    login_bg_image_path = get_login_bg_image_path()
    redirect_to = request.GET.get(redirect_field_name)

    phone = ''
    error_msg = ''
    send_button_disabled = ''
    form = SmsOrgRegistrationForm()

    ip = get_remote_ip(request)
    # send sms attempts
    if get_send_sms_attempts(ip=ip) >= settings.SEND_SMS_ATTEMPT_LIMIT:
        phone = request.session.get(SESSION_KEY_SMS_ORG_REGISTRATION_PHONE, '')
        error_msg = '发送验证码过于频繁，请 %s 分钟后再试' % (settings.SEND_SMS_ATTEMPT_TIMEOUT // 60)
        return render_sms_org_registration_error(request, redirect_to, error_msg, send_button_disabled, phone)

    if request.method == 'POST':
        phone = request.POST.get('phone', '')
        sms_code = request.POST.get('sms_code', '')
        if not phone and not sms_code:
            error_msg = '手机号或验证码不能为空'
            return render_sms_org_registration_error(request, redirect_to, error_msg, send_button_disabled, phone)

        if ORG_AUTO_URL_PREFIX:
            # generate url prefix automatically
            url_prefix = gen_org_url_prefix(3)
            if url_prefix is None:
                messages.error(request, "Failed to create organization account, please try again later.")
                return render(request, 'organizations/sms_org_register.html', {
                    'ENABLE_SLIDE_CAPTCHA': ENABLE_SLIDE_CAPTCHA,
                    'form': form,
                    'login_bg_image_path': login_bg_image_path,
                    'org_auto_url_prefix': ORG_AUTO_URL_PREFIX,
                })

        # send sms code
        if phone and not sms_code:
            lock_time = request.session.get(SESSION_KEY_SMS_ORG_REGISTRATION_LOCK_TIME, 0)
            if int(time.time()) < lock_time:
                error_msg = '请 %s 秒后再次发送验证码' % (lock_time - int(time.time()))
                send_button_disabled = 'disabled'
                return render_sms_org_registration_json_error(error_msg)

            if not check_phone(phone):
                error_msg = '手机号格式错误'
                return render_sms_org_registration_json_error(error_msg)

            exists = Profile.objects.get_username_by_phone(phone)
            if exists:
                error_msg = '手机号已注册'
                return render_sms_org_registration_json_error(error_msg)

            if ENABLE_SLIDE_CAPTCHA:
                if not check_slide_captcha_verified_time(request):
                    error_msg = '滑动验证失败'
                    return render_sms_org_registration_json_error(error_msg)

            # same as dtable-web/seahub/api2/endpoints/verify.py
            try:
                from seahub.utils.sms_clients import AliyunSmsClient

                # gen new code
                code = get_random_code()
                # send sms
                AliyunSmsClient().send_verify_code(phone, code)

                # cache the code
                set_sms_verify_code_cache(phone, SMS_ORG_REGISTRATION_SMS_TYPE, code)

                send_button_disabled = 'disabled'
                request.session[SESSION_KEY_SMS_ORG_REGISTRATION_PHONE] = phone
                request.session[SESSION_KEY_SMS_ORG_REGISTRATION_LOCK_TIME] = int(time.time()) + 60
                increase_send_sms_attempts(phone, ip)
                return HttpResponse(json.dumps({'success': True}), content_type='application/json')

            except Exception as e:
                logger.error('phone: %s send verify code: %s error: %s', phone, code, e)
                error_msg = _('Internal Server Error')
                return render_sms_org_registration_json_error(error_msg)
        # registration
        else:
            phone = request.session.get(SESSION_KEY_SMS_ORG_REGISTRATION_PHONE)
            if not phone:
                error_msg = '请先发送短信'
                return render_sms_org_registration_error(request, redirect_to, error_msg, send_button_disabled, phone)
            if not check_phone(phone):
                error_msg = '手机号格式错误'
                return render_sms_org_registration_error(request, redirect_to, error_msg, send_button_disabled, phone)

            exists = Profile.objects.get_username_by_phone(phone)
            if exists:
                error_msg = '手机号已注册'
                return render_sms_org_registration_error(request, redirect_to, error_msg, send_button_disabled, phone)

            # same as dtable-web/seahub/api2/endpoints/profile.py
            verify_success = verify_sms_code(phone, SMS_ORG_REGISTRATION_SMS_TYPE, sms_code)

            if not verify_success:
                error_msg = '验证码不正确'
                return render_sms_org_registration_error(request, redirect_to, error_msg, send_button_disabled, phone)

            form = SmsOrgRegistrationForm(request.POST)
            if form.is_valid():
                name = form.cleaned_data['name']
                email = ''  # set email empty string
                password = form.cleaned_data['password1']
                org_name = form.cleaned_data['org_name']

                for prefix in settings.REJECT_REGISTRATION_ORG_PREFIX:
                    if name.lower().startswith(prefix.lower()):
                        return render_error(request, 'invalid parameters')
                    if org_name.lower().startswith(prefix.lower()):
                        return render_error(request, 'invalid parameters')

                for re_str in settings.REJECT_REGISTRATION_ORG_RE_STR:
                    if re.search(re_str, name.lower()):
                        return render_error(request, 'invalid parameters')
                    if re.search(re_str, org_name.lower()):
                        return render_error(request, 'invalid parameters')

                new_user = User.objects.create_user(
                    email, password, is_staff=False, is_active=True)
                # bind phone
                Profile.objects.add_or_update(new_user.username, nickname=name, phone=phone)

                create_org(org_name, url_prefix, new_user.username)
                new_org = get_org_by_url_prefix(url_prefix)
                org_created.send(sender=None, org=new_org)
                OrgSettings.objects.add_or_update(new_org, ORG_DEFAULT)

                # record the org's register IP to dtable_web.log
                remote_address = request.META.get('REMOTE_ADDR', '')
                x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR', '')
                if x_forwarded_for:
                    remote_address = x_forwarded_for.split(',')[0]
                logger.warning('Org %s register IP is: %s' % (org_name, remote_address))

                # login the user
                new_user.backend = settings.AUTHENTICATION_BACKENDS[0]
                login(request, new_user)

                # clear
                clear_sms_org_registration_session(request)
                clear_send_sms_attempts(phone, ip)

                if not redirect_to:
                    response = HttpResponseRedirect(reverse('dtable'))
                else:
                    response = HttpResponseRedirect(redirect_to)

                source = request.COOKIES.get('REGISTRATION_SOURCE', '')
                invitation_token = request.COOKIES.get('INVITATION_TOKEN', '')
                try:
                    record_org_registration_logs(new_org, source)
                    record_registration_logs(new_user, source, invitation_token)
                except Exception as e:
                    logger.warning('Failed to record registration log, error: %s' % e)

                response.delete_cookie('REGISTRATION_SOURCE')
                response.delete_cookie('INVITATION_TOKEN')
                return response
    else:
        phone = request.session.get(SESSION_KEY_SMS_ORG_REGISTRATION_PHONE, '')

    service_url = get_service_url()
    up = urlparse(service_url)
    service_url_scheme = up.scheme
    service_url_remaining = up.netloc + up.path
    strong_pwd_required = config.USER_STRONG_PASSWORD_REQUIRED

    return render(request, 'organizations/sms_org_register.html', {
        'ENABLE_SLIDE_CAPTCHA': ENABLE_SLIDE_CAPTCHA,
        'form': form,
        'login_bg_image_path': login_bg_image_path,
        'service_url_scheme': service_url_scheme,
        'service_url_remaining': service_url_remaining,
        'org_auto_url_prefix': ORG_AUTO_URL_PREFIX,
        'redirect_to': redirect_to or reverse('dtable'),
        redirect_field_name: redirect_to or reverse('dtable'),
        'error_msg': error_msg,
        'send_button_disabled': send_button_disabled,
        'phone': phone,
        'strong_pwd_required': strong_pwd_required,
    })


@login_required
def org_transfer(request, **kwargs):
    """ transfer user self to org
    """
    user = request.user
    username = user.username
    org_id = request.session.get('org_transfer_org_id', None)
    redirect_to = request.session.get('org_transfer_redirect', settings.LOGIN_REDIRECT_URL)

    # clear session
    try:
        del request.session['org_transfer_org_id']
        del request.session['org_transfer_redirect']
    except Exception as e:
        logger.warning(e)

    # check
    if ccnet_api.get_orgs_by_user(username):
        return render_error(request, '您的账号已经加入过 SeaTable 团队')

    if not org_id:
        return render_error(request, 'org_id invalid.')

    org = ccnet_api.get_org_by_id(org_id)
    if not org:
        return render_error(request, 'Organization %s not found.' % org_id)

    # main
    transfer_status = transfer_user_to_org(username, org_id)
    if not transfer_status:
        return render_error(request, _('Internal Server Error'))

    return HttpResponseRedirect(redirect_to)


@login_required
@org_staff_required
def react_fake_view(request, **kwargs):
    group_id = kwargs.get('group_id', '')
    org = request.user.org
    invitation_link = get_or_create_invitation_link(org.org_id)
    enable_org_logo = ENABLE_ORG_LOGO and request.user.permissions.can_use_advanced_customization()
    can_use_saml = can_org_use_saml(org)

    # Whether use new page
    return render(request, "organizations/org_admin_react.html", {
        'org_id': org.org_id,
        'org_name': org.org_name,
        'org_member_quota_enabled': ORG_MEMBER_QUOTA_ENABLED,
        'enable_multi_saml': ENABLE_MULTI_SAML,
        'can_use_saml': can_use_saml,
        'group_id': group_id,
        'invitation_link': invitation_link if invitation_link else '',
        'display_two_factor_auth': getattr(config, 'ENABLE_TWO_FACTOR_AUTH', False),
        'enable_org_department': settings.ENABLE_ORG_DEPARTMENT,
        'enable_org_logo': enable_org_logo,
        'enable_org_admin_invite_via_email': settings.ENABLE_ORG_ADMIN_INVITE_VIA_EMAIL,
        'enable_subscription': subscription_check(),
        'enable_slide_captcha': settings.ENABLE_SLIDE_CAPTCHA,
        'enable_org_work_weixin': org_work_weixin_check(),
        'enable_org_dingtalk': org_dingtalk_check(),
        'org_corp_bind_type': get_org_corp_bind_type(org.org_id),
        'two_factor_auth_enabled': has_two_factor_auth(),
        'trash_clean_expire_days': settings.TRASH_CLEAN_AFTER_DAYS,
        'disable_addressbook_v1': settings.DISABLE_ADDRESSBOOK_V1,
        'enable_addressbook_v2': settings.ENABLE_ADDRESSBOOK_V2
        })


@login_required
@org_staff_required
def react_fake_department_view(request, **kwargs):
    if not settings.ENABLE_ORG_DEPARTMENT:
        return render_error(request, _('Feature is not enabled.'))
    return react_fake_view(request, **kwargs)
