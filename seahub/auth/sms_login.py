import re
import time
import json
import logging
from datetime import datetime

from django.urls import reverse
from django.http import HttpResponseRedirect, HttpResponse
from django.views.decorators.csrf import csrf_protect, csrf_exempt
from django.utils.translation import gettext as _
from django.views.decorators.cache import never_cache
from django.contrib.sites.shortcuts import get_current_site
from django.shortcuts import redirect
from django.shortcuts import render

from constance import config

from seahub.base.accounts import User
from seahub.profile.models import Profile
from seahub.utils.auth import get_login_bg_image_path
from seahub.utils import get_site_name, render_error
from seahub.settings import ENABLE_SMS_LOGIN, LOGIN_REDIRECT_URL, \
    LOGIN_ATTEMPT_TIMEOUT, SEND_SMS_ATTEMPT_LIMIT, SEND_SMS_ATTEMPT_TIMEOUT
from seahub.utils.ip import get_remote_ip
from seahub.api2.utils import get_api_token

# Get an instance of a logger
logger = logging.getLogger(__name__)

SESSION_KEY_SMS_LOGIN_PHONE = 'sms-login-phone'
SESSION_KEY_SMS_LOGIN_REDIRECT_URL = 'sms-login-redirect-url'
SESSION_KEY_SMS_LOGIN_LOCK_TIME = 'sms-login-lock-time'
SMS_LOGIN_SMS_TYPE = 'sms-login'


def check_phone(phone):
    if not phone:
        return
    phone = phone.strip()
    if re.match(r'^1[3456789]\d{9}$', phone):
        return phone


def clear_sms_login_session(request):
    for key in (SESSION_KEY_SMS_LOGIN_PHONE,
                SESSION_KEY_SMS_LOGIN_REDIRECT_URL,
                SESSION_KEY_SMS_LOGIN_LOCK_TIME):
        request.session.pop(key, '')
    return


def render_sms_login_error(request, redirect_to, error_msg, send_button_disabled, phone, is_android=False):
    if is_android:  # android
        return HttpResponse(json.dumps({'error': error_msg}), content_type='application/json')

    from seahub.auth import REDIRECT_FIELD_NAME
    return render(request, 'registration/sms_login.html', {
        REDIRECT_FIELD_NAME: redirect_to,
        'site': get_current_site(request),
        'site_name': get_site_name(),
        'login_bg_image_path': get_login_bg_image_path(),
        'error_msg': error_msg,
        'send_button_disabled': send_button_disabled,
        'phone': phone,
    })


@csrf_exempt
@never_cache
def sms_login(request):
    """sms two factor auth"""
    if not ENABLE_SMS_LOGIN:
        return render_error(request, _('Feature is not enabled.'))

    from seahub.auth import REDIRECT_FIELD_NAME, get_backends
    from seahub.auth import login as auth_login
    from seahub.auth.utils import get_login_failed_attempts, incr_login_failed_attempts, clear_login_failed_attempts , \
        get_send_sms_attempts, increase_send_sms_attempts, clear_send_sms_attempts
    redirect_field_name = REDIRECT_FIELD_NAME
    redirect_to = request.GET.get(
        redirect_field_name, request.session.get(SESSION_KEY_SMS_LOGIN_REDIRECT_URL))
    if request.user.is_authenticated:
        if redirect_to:
            return HttpResponseRedirect(redirect_to)
        else:
            return HttpResponseRedirect(reverse('dtable'))
    redirect_to = redirect_to or LOGIN_REDIRECT_URL

    phone = ''
    error_msg = ''
    send_button_disabled = ''

    is_android = request.GET.get('from_android', None)  # android

    # login failed attempts
    ip = get_remote_ip(request)
    if get_login_failed_attempts(ip=ip) >= config.LOGIN_ATTEMPT_LIMIT:
        phone = request.session.get(SESSION_KEY_SMS_LOGIN_PHONE, '')
        error_msg = '验证码错误次数过多，请 %s 分钟后再试' % (LOGIN_ATTEMPT_TIMEOUT // 60)
        return render_sms_login_error(request, redirect_to, error_msg, send_button_disabled, phone, is_android)

    # send sms attempts
    if get_send_sms_attempts(ip=ip) >= SEND_SMS_ATTEMPT_LIMIT:
        phone = request.session.get(SESSION_KEY_SMS_LOGIN_PHONE, '')
        error_msg = '发送验证码过于频繁，请 %s 分钟后再试' % (SEND_SMS_ATTEMPT_TIMEOUT // 60)
        return render_sms_login_error(request, redirect_to, error_msg, send_button_disabled, phone, is_android)

    if request.method == "POST":
        sms_code = request.POST.get('sms_code', '').strip()
        send_sms_code = request.POST.get('send_sms_code', '')

        # send_sms_code
        if send_sms_code and not sms_code:
            lock_time = request.session.get(SESSION_KEY_SMS_LOGIN_LOCK_TIME, 0)
            if int(time.time()) < lock_time:
                error_msg = '请 %s 秒后再次发送验证码' % (lock_time - int(time.time()))
                send_button_disabled = 'disabled'
                return render_sms_login_error(request, redirect_to, error_msg, send_button_disabled, phone, is_android)

            phone = send_sms_code
            if not check_phone(phone):
                error_msg = '手机号格式错误'
                return render_sms_login_error(request, redirect_to, error_msg, send_button_disabled, phone, is_android)

            username = Profile.objects.get_username_by_phone(phone)
            try:
                user = User.objects.get(email=username)
            except User.DoesNotExist:
                user = None
            except Exception as e:
                logger.warning(e)
                return render_error(request, _('Internal Server Error'))
            if not user or not user.is_active:
                error_msg = _('User %s not found or inactive.') % phone
                return render_sms_login_error(request, redirect_to, error_msg, send_button_disabled, phone, is_android)

            # same as dtable-web/seahub/api2/endpoints/verify.py
            try:
                from seahub.utils.verify import get_random_code, set_sms_verify_code_cache
                from seahub.utils.sms_clients import AliyunSmsClient

                # gen new code
                code = get_random_code()
                # send sms
                AliyunSmsClient().send_verify_code(phone, code)

                # cache the code
                set_sms_verify_code_cache(phone, SMS_LOGIN_SMS_TYPE, code)

                send_button_disabled = 'disabled'
                request.session[SESSION_KEY_SMS_LOGIN_PHONE] = phone
                request.session[SESSION_KEY_SMS_LOGIN_LOCK_TIME] = int(time.time()) + 60
                increase_send_sms_attempts(phone, ip)
            except Exception as e:
                logger.error('phone: %s send verify code: %s error: %s', phone, code, e)
                error_msg = _('Internal Server Error')
                return render_sms_login_error(request, redirect_to, error_msg, send_button_disabled, phone, is_android)
            if is_android:  # android
                return HttpResponse(json.dumps({'success': True}), content_type='application/json')

        # verify code
        elif sms_code:
            phone = request.session.get(SESSION_KEY_SMS_LOGIN_PHONE)
            if is_android:
                phone = request.POST.get('send_sms_code', '')
            if not phone:
                error_msg = '请先发送短信'
                return render_sms_login_error(request, redirect_to, error_msg, send_button_disabled, phone, is_android)
            if not check_phone(phone):
                error_msg = '手机号格式错误'
                return render_sms_login_error(request, redirect_to, error_msg, send_button_disabled, phone, is_android)

            username = Profile.objects.get_username_by_phone(phone)
            try:
                user = User.objects.get(email=username)
            except User.DoesNotExist:
                user = None
            except Exception as e:
                logger.warning(e)
                return render_error(request, _('Internal Server Error'))
            if not user or not user.is_active:
                error_msg = _('User %s not found or inactive.') % phone
                return render_sms_login_error(request, redirect_to, error_msg, send_button_disabled, phone, is_android)

            # same as dtable-web/seahub/api2/endpoints/profile.py
            from seahub.utils.verify import verify_sms_code
            verify_success = verify_sms_code(phone, SMS_LOGIN_SMS_TYPE, sms_code)

            if not verify_success:
                failed_attempt = incr_login_failed_attempts(username=username, ip=ip)
                if failed_attempt >= config.LOGIN_ATTEMPT_LIMIT:
                    if bool(config.FREEZE_USER_ON_LOGIN_FAILED) is True:
                        user.freeze_user(notify_admins=True)
                        error_msg = _('This account has been frozen due to too many failed login attempts.')
                        return render_error(request, error_msg)
                    else:
                        error_msg = '验证码错误次数过多，请 %s 分钟后再试' % (LOGIN_ATTEMPT_TIMEOUT // 60)
                        return render_sms_login_error(request, redirect_to, error_msg, send_button_disabled, phone, is_android)
                else:
                    error_msg = '验证码不正确'
                    return render_sms_login_error(request, redirect_to, error_msg, send_button_disabled, phone, is_android)

            # success
            clear_sms_login_session(request)
            clear_login_failed_attempts(request, username)
            clear_send_sms_attempts(phone, ip)

            for backend in get_backends():
                user.backend = "%s.%s" % (backend.__module__, backend.__class__.__name__)
            auth_login(request, user)

            if is_android:  # android
                api_token = get_api_token(request)
                return HttpResponse(json.dumps({'token': api_token.key}), content_type='application/json')

            request.session['remember_me'] = True
            return HttpResponseRedirect(redirect_to)
        else:
            error_msg = '手机号或验证码不能为空'
            return render_sms_login_error(request, redirect_to, error_msg, send_button_disabled, phone, is_android)

    else:
        ### GET
        phone = request.session.get(SESSION_KEY_SMS_LOGIN_PHONE, '')

    response = render(request, 'registration/sms_login.html', {
        redirect_field_name: redirect_to,
        'site': get_current_site(request),
        'site_name': get_site_name(),
        'login_bg_image_path': get_login_bg_image_path(),
        'error_msg': error_msg,
        'send_button_disabled': send_button_disabled,
        'phone': phone,
    })

    return response
