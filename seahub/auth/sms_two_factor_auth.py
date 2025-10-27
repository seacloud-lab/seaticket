import time
import logging
from datetime import datetime

from django.urls import reverse
from django.http import HttpResponseRedirect
from django.views.decorators.csrf import csrf_protect
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
from seahub.settings import ENABLE_SMS_TWO_FACTOR_AUTH, LOGIN_REDIRECT_URL

# Get an instance of a logger
logger = logging.getLogger(__name__)

SESSION_KEY_SMS_TWO_FACTOR_AUTH_USERNAME = 'sms-2fa-username'
SESSION_KEY_SMS_TWO_FACTOR_AUTH_REDIRECT_URL = 'sms-2fa-redirect-url'
SESSION_KEY_SMS_TWO_FACTOR_AUTH_LOCK_TIME = 'sms-2fa-lock-time'
SMS_TWO_FACTOR_AUTH_SMS_TYPE = 'sms-2fa'


def sms_two_factor_auth_enabled(user):
    if not ENABLE_SMS_TWO_FACTOR_AUTH:
        return False
    profile = Profile.objects.get_profile_by_user(user.username)
    if profile and profile.phone and profile.sms_2fa:
        return True
    return False


def handle_sms_two_factor_auth(request, user, redirect_to):
    request.session[SESSION_KEY_SMS_TWO_FACTOR_AUTH_USERNAME] = user.username
    request.session[SESSION_KEY_SMS_TWO_FACTOR_AUTH_REDIRECT_URL] = redirect_to
    request.session[SESSION_KEY_SMS_TWO_FACTOR_AUTH_LOCK_TIME] = 0
    return redirect(reverse('sms_two_factor_auth'))


def clear_sms_two_factor_session(request):
    for key in (SESSION_KEY_SMS_TWO_FACTOR_AUTH_USERNAME,
                SESSION_KEY_SMS_TWO_FACTOR_AUTH_REDIRECT_URL,
                SESSION_KEY_SMS_TWO_FACTOR_AUTH_LOCK_TIME):
        request.session.pop(key, '')
    return


@csrf_protect
@never_cache
def sms_two_factor_auth(request):
    """sms two factor auth"""
    if not ENABLE_SMS_TWO_FACTOR_AUTH:
        return render_error(request, _('Feature is not enabled.'))

    from seahub.auth import REDIRECT_FIELD_NAME, get_backends
    from seahub.auth import login as auth_login
    redirect_field_name = REDIRECT_FIELD_NAME
    redirect_to = request.GET.get(
        redirect_field_name, request.session.get(SESSION_KEY_SMS_TWO_FACTOR_AUTH_REDIRECT_URL))
    if request.user.is_authenticated:
        if redirect_to:
            return HttpResponseRedirect(redirect_to)
        else:
            return HttpResponseRedirect(reverse('projects_list'))
    redirect_to = redirect_to or LOGIN_REDIRECT_URL

    username = request.session.get(SESSION_KEY_SMS_TWO_FACTOR_AUTH_USERNAME)
    if not username:
        return render_error(request, '请重新登录。')
    try:
        user = User.objects.get(email=username)
    except User.DoesNotExist:
        user = None
    except Exception as e:
        logger.warning(e)
        return render_error(request, _('Internal Server Error'))
    if not user or not user.is_active:
        return render_error(request, _('User %s not found or inactive.') % username)

    profile = Profile.objects.get_profile_by_user(username)
    if not (profile and profile.phone and profile.sms_2fa):
        return render_error(request, '您未开通短信验证，请重新登录。')

    error_msg = ''
    send_button_disabled = ''
    phone = profile.phone

    if request.method == "POST":
        sms_code = request.POST.get('sms_code', '').strip()
        send_sms_code = request.POST.get('send_sms_code', '')
        # send_sms_code
        if send_sms_code:
            lock_time = request.session.get(SESSION_KEY_SMS_TWO_FACTOR_AUTH_LOCK_TIME, 0)
            if int(time.time()) < lock_time:
                error_msg = '请 %s 秒后再次发送验证码' % (lock_time - int(time.time()))
                send_button_disabled = 'disabled'
            else:
                # same as seaqa-web/seahub/api2/endpoints/verify.py     
                try:
                    from seahub.utils.verify import get_random_code, set_sms_verify_code_cache
                    from seahub.utils.sms_clients import AliyunSmsClient

                    # gen new code
                    code = get_random_code()
                    # send sms
                    AliyunSmsClient().send_verify_code(phone, code)

                    # cache the code
                    set_sms_verify_code_cache(phone, SMS_TWO_FACTOR_AUTH_SMS_TYPE, code)

                    send_button_disabled = 'disabled'
                    request.session[SESSION_KEY_SMS_TWO_FACTOR_AUTH_LOCK_TIME] = int(time.time()) + 60
                except Exception as e:
                    logger.error('phone: %s send verify code: %s error: %s', phone, code, e)
                    error_msg = _('Internal Server Error')
        # verify code
        elif sms_code:
            # same as seaqa-web/seahub/api2/endpoints/profile.py
            from seahub.utils.verify import verify_sms_code
            verify_success = verify_sms_code(phone, SMS_TWO_FACTOR_AUTH_SMS_TYPE, sms_code)
            # success
            if verify_success:
                clear_sms_two_factor_session(request)

                for backend in get_backends():
                    user.backend = "%s.%s" % (backend.__module__, backend.__class__.__name__)
                auth_login(request, user)
                request.session['remember_me'] = True

                return HttpResponseRedirect(redirect_to)
            else:
                # code is invalid
                error_msg = '验证码不正确'
        else:
            error_msg = '验证码不能为空'

    else:
        ### GET
        pass

    response = render(request, 'registration/sms_two_factor_auth.html', {
        redirect_field_name: redirect_to,
        'site': get_current_site(request),
        'site_name': get_site_name(),
        'login_bg_image_path': get_login_bg_image_path(),
        'error_msg': error_msg,
        'phone': phone[:3] + '****' + phone[-4:],
        'send_button_disabled': send_button_disabled,
    })

    return response
