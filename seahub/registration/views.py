"""
Views which allow users to create and activate accounts.

"""
import time
import json
import logging

from django.shortcuts import redirect
from django.shortcuts import render
from django.http import Http404, HttpResponse
from django.urls import reverse
from django.utils.translation import gettext as _
from django.views.decorators.csrf import csrf_exempt
from constance import config

from seahub import settings
from seahub.auth import REDIRECT_FIELD_NAME
from seahub.registration import get_backend
from seahub.utils.auth import get_login_bg_image_path
from seahub.utils import render_error
from seahub.profile.models import Profile
from seahub.registration.forms import SmsRegistrationForm
from seahub.utils.ip import get_remote_ip
from seahub.api2.utils import get_api_token
from seahub.organizations.models import Organization, OrgUser
from seahub.settings import USER_STRONG_PASSWORD_REQUIRED, USER_PASSWORD_MIN_LENGTH, \
    USER_PASSWORD_STRENGTH_LEVEL
SESSION_KEY_SMS_REGISTRATION_PHONE = 'sms-registration-phone'
SESSION_KEY_SMS_REGISTRATION_LOCK_TIME = 'sms-registration-lock-time'
SMS_REGISTRATION_SMS_TYPE = 'sms-registration'

logger = logging.getLogger(__name__)


def activate(request, backend,
             template_name='registration/activate.html',
             success_url=None, extra_context=None, **kwargs):
    """
    Activate a user's account.

    The actual activation of the account will be delegated to the
    backend specified by the ``backend`` keyword argument (see below);
    the backend's ``activate()`` method will be called, passing any
    keyword arguments captured from the URL, and will be assumed to
    return a ``User`` if activation was successful, or a value which
    evaluates to ``False`` in boolean context if not.

    Upon successful activation, the backend's
    ``post_activation_redirect()`` method will be called, passing the
    ``HttpRequest`` and the activated ``User`` to determine the URL to
    redirect the user to. To override this, pass the argument
    ``success_url`` (see below).

    On unsuccessful activation, will render the template
    ``registration/activate.html`` to display an error message; to
    override thise, pass the argument ``template_name`` (see below).

    **Arguments**

    ``backend``
        The dotted Python import path to the backend class to
        use. Required.

    ``extra_context``
        A dictionary of variables to add to the template context. Any
        callable object in this dictionary will be called to produce
        the end result which appears in the context. Optional.

    ``success_url``
        The name of a URL pattern to redirect to on successful
        acivation. This is optional; if not specified, this will be
        obtained by calling the backend's
        ``post_activation_redirect()`` method.

    ``template_name``
        A custom template to use. This is optional; if not specified,
        this will default to ``registration/activate.html``.

    ``**kwargs``
        Any keyword arguments captured from the URL, such as an
        activation key, which will be passed to the backend's
        ``activate()`` method.

    **Context:**

    The context will be populated from the keyword arguments captured
    in the URL, and any extra variables supplied in the
    ``extra_context`` argument (see above).

    **Template:**

    registration/activate.html or ``template_name`` keyword argument.

    """
    backend = get_backend(backend)
    account = backend.activate(request, **kwargs)

    if account:
        if success_url is None:
            to, args, kwargs = backend.post_activation_redirect(request, account)
            return redirect(to, *args, **kwargs)
        else:
            return redirect(success_url)

    if extra_context is None:
        extra_context = {}
    context = {}
    for key, value in list(extra_context.items()):
        context[key] = callable(value) and value() or value

    return render(request, template_name, **kwargs, context=context)


def register(request, backend, success_url=None, form_class=None,
             disallowed_url='registration_disallowed',
             template_name='registration/registration_form.html',
             extra_context=None, redirect_field_name=REDIRECT_FIELD_NAME):
    """
    Allow a new user to register an account.

    The actual registration of the account will be delegated to the
    backend specified by the ``backend`` keyword argument (see below);
    it will be used as follows:

    1. The backend's ``registration_allowed()`` method will be called,
       passing the ``HttpRequest``, to determine whether registration
       of an account is to be allowed; if not, a redirect is issued to
       the view corresponding to the named URL pattern
       ``registration_disallowed``. To override this, see the list of
       optional arguments for this view (below).

    2. The form to use for account registration will be obtained by
       calling the backend's ``get_form_class()`` method, passing the
       ``HttpRequest``. To override this, see the list of optional
       arguments for this view (below).

    3. If valid, the form's ``cleaned_data`` will be passed (as
       keyword arguments, and along with the ``HttpRequest``) to the
       backend's ``register()`` method, which should return the new
       ``User`` object.

    4. Upon successful registration, the backend's
       ``post_registration_redirect()`` method will be called, passing
       the ``HttpRequest`` and the new ``User``, to determine the URL
       to redirect the user to. To override this, see the list of
       optional arguments for this view (below).

    **Required arguments**

    None.

    **Optional arguments**

    ``backend``
        The dotted Python import path to the backend class to use.

    ``disallowed_url``
        URL to redirect to if registration is not permitted for the
        current ``HttpRequest``. Must be a value which can legally be
        passed to ``django.shortcuts.redirect``. If not supplied, this
        will be whatever URL corresponds to the named URL pattern
        ``registration_disallowed``.

    ``form_class``
        The form class to use for registration. If not supplied, this
        will be retrieved from the registration backend.

    ``extra_context``
        A dictionary of variables to add to the template context. Any
        callable object in this dictionary will be called to produce
        the end result which appears in the context.

    ``success_url``
        URL to redirect to after successful registration. Must be a
        value which can legally be passed to
        ``django.shortcuts.redirect``. If not supplied, this will be
        retrieved from the registration backend.

    ``template_name``
        A custom template to use. If not supplied, this will default
        to ``registration/registration_form.html``.

    **Context:**

    ``form``
        The registration form.

    Any extra variables supplied in the ``extra_context`` argument
    (see above).

    **Template:**

    registration/registration_form.html or ``template_name`` keyword
    argument.

    """
    if not settings.ENABLE_SIGNUP or settings.USE_PHONE_REGISTRATION_BY_DEFAULT:
        raise Http404

    if settings.ACTIVATE_AFTER_REGISTRATION:
        success_url = settings.SITE_ROOT

    redirect_to = request.GET.get(redirect_field_name)
    if redirect_to:
        success_url = redirect_to

    backend = get_backend(backend)
    if not backend.registration_allowed(request):
        return redirect(disallowed_url)
    if form_class is None:
        form_class = backend.get_form_class(request)

    if request.method == 'POST':
        form = form_class(data=request.POST, files=request.FILES)
        if form.is_valid():
            new_user = backend.register(request, **form.cleaned_data)
            if success_url is None:
                to, args, kwargs = backend.post_registration_redirect(request, new_user)
                response = redirect(to, *args, **kwargs)
            else:
                response = redirect(success_url)

            source = request.COOKIES.get('REGISTRATION_SOURCE', '')
            invitation_token = request.COOKIES.get('INVITATION_TOKEN', '')
            try:
                record_registration_logs(new_user, source, invitation_token)
            except Exception as e:
                logger.warning('Failed to record registration log, error: %s' % e)

            response.delete_cookie('REGISTRATION_SOURCE')
            response.delete_cookie('INVITATION_TOKEN')
            return response
    else:
        userid = request.GET.get('userid', '')
        form = form_class(initial={'userid': userid})

    if extra_context is None:
        extra_context = {}

    context = {}
    for key, value in list(extra_context.items()):
        context[key] = callable(value) and value() or value

    src = request.GET.get('src', '')
    if src:
        form = form_class(initial={'email': src})

    context['form'] = form
    context['strong_pwd_required'] = USER_STRONG_PASSWORD_REQUIRED

    login_bg_image_path = get_login_bg_image_path()
    context['login_bg_image_path'] = login_bg_image_path
    context['redirect_to'] = redirect_to or reverse('projects_list')
    context[redirect_field_name] = redirect_to or reverse('projects_list')

    return render(request, template_name, context)


def org_register(request, org_id, backend, success_url=None, form_class=None,
             disallowed_url='registration_disallowed',
             template_name='registration/registration_form.html',
             extra_context=None, redirect_field_name=REDIRECT_FIELD_NAME):

    if not settings.ENABLE_SIGNUP:
        raise Http404

    if settings.ACTIVATE_AFTER_REGISTRATION:
        success_url = settings.SITE_ROOT

    redirect_to = request.GET.get(redirect_field_name)
    if redirect_to:
        success_url = redirect_to

    backend = get_backend(backend)
    if not backend.registration_allowed(request):
        return redirect(disallowed_url)
    if form_class is None:
        form_class = backend.get_form_class(request)

    try:
        org_id = int(org_id)
        if not Organization.objects.get_org_by_id(org_id):
            return render_error(request, 'organization %s not found.' % org_id)
    except Exception as e:
        logger.error(e)
        return render_error(request, 'Internal Server Error')


    if request.method == 'POST':
        form = form_class(data=request.POST, files=request.FILES)
        if form.is_valid():
            new_user = backend.register(request, **form.cleaned_data)
            OrgUser.objects.add_org_user(org_id, new_user.username, 0)
            if success_url is None:
                to, args, kwargs = backend.post_registration_redirect(request, new_user)
                return redirect(to, *args, **kwargs)
            else:
                return redirect(success_url)
    else:
        userid = request.GET.get('userid', '')
        form = form_class(initial={'userid': userid})

    if extra_context is None:
        extra_context = {}

    context = {}
    for key, value in list(extra_context.items()):
        context[key] = callable(value) and value() or value

    src = request.GET.get('src', '')
    if src:
        form = form_class(initial={'email': src})

    context['form'] = form
    context['min_len'] = USER_PASSWORD_MIN_LENGTH
    context['strong_pwd_required'] = USER_STRONG_PASSWORD_REQUIRED
    context['level'] = USER_PASSWORD_STRENGTH_LEVEL

    login_bg_image_path = get_login_bg_image_path()
    context['login_bg_image_path'] = login_bg_image_path
    context['redirect_to'] = redirect_to or reverse('projects_list')
    context[redirect_field_name] = redirect_to or reverse('projects_list')

    return render(request, template_name, context)


def clear_sms_registration_session(request):
    for key in (SESSION_KEY_SMS_REGISTRATION_PHONE,
                SESSION_KEY_SMS_REGISTRATION_LOCK_TIME):
        request.session.pop(key, '')
    return


def render_sms_registration_error(request, redirect_to, error_msg, send_button_disabled, phone, is_android=False):
    if is_android:  # android
        return HttpResponse(json.dumps({'error': error_msg}), content_type='application/json')

    from seahub.auth import REDIRECT_FIELD_NAME
    return render(request, 'registration/sms_registration_form.html', {
        REDIRECT_FIELD_NAME: redirect_to or reverse('projects_list'),
        'redirect_to': redirect_to or reverse('projects_list'),
        'login_bg_image_path': get_login_bg_image_path(),
        'error_msg': error_msg,
        'send_button_disabled': send_button_disabled,
        'phone': phone,
        'form': SmsRegistrationForm(),
        'min_len': USER_PASSWORD_MIN_LENGTH,
        'strong_pwd_required': USER_STRONG_PASSWORD_REQUIRED,
        'level': USER_PASSWORD_STRENGTH_LEVEL,
    })

def render_sms_registration_json_error(error_msg):
    return HttpResponse(json.dumps({'error': error_msg}), content_type='application/json')


@csrf_exempt
def sms_register(request, backend, success_url=None, form_class=None,
             disallowed_url='registration_disallowed',
             template_name='registration/sms_registration_form.html',
             extra_context=None, redirect_field_name=REDIRECT_FIELD_NAME):

    from seahub.auth.utils import get_send_sms_attempts, increase_send_sms_attempts, clear_send_sms_attempts
    from seahub.utils.verify import get_random_code, set_sms_verify_code_cache, check_phone, verify_sms_code

    if not settings.ENABLE_SIGNUP or not settings.USE_PHONE_REGISTRATION_BY_DEFAULT:
        raise Http404

    if settings.ACTIVATE_AFTER_REGISTRATION:
        success_url = settings.SITE_ROOT

    redirect_to = request.GET.get(redirect_field_name)
    if redirect_to:
        success_url = redirect_to

    backend = get_backend(backend)
    if not backend.registration_allowed(request):
        return redirect(disallowed_url)
    if not form_class:
        form_class = SmsRegistrationForm()

    phone = ''
    error_msg = ''
    send_button_disabled = ''
    form = form_class()

    is_android = request.GET.get('from_android', None)  # android

    ip = get_remote_ip(request)
    # send sms attempts
    if get_send_sms_attempts(ip=ip) >= settings.SEND_SMS_ATTEMPT_LIMIT:
        phone = request.session.get(SESSION_KEY_SMS_REGISTRATION_PHONE, '')
        error_msg = '发送验证码过于频繁，请 %s 分钟后再试' % (settings.SEND_SMS_ATTEMPT_TIMEOUT // 60)
        return render_sms_registration_error(request, redirect_to, error_msg, send_button_disabled, phone, is_android)

    if request.method == 'POST':
        phone = request.POST.get('phone', '')
        sms_code = request.POST.get('sms_code', '')
        if not phone and not sms_code:
            error_msg = '手机号或验证码不能为空'
            return render_sms_registration_error(request, redirect_to, error_msg, send_button_disabled, phone, is_android)

        # send sms code
        if phone and not sms_code:
            lock_time = request.session.get(SESSION_KEY_SMS_REGISTRATION_LOCK_TIME, 0)
            if int(time.time()) < lock_time:
                error_msg = '请 %s 秒后再次发送验证码' % (lock_time - int(time.time()))
                send_button_disabled = 'disabled'
                return render_sms_registration_json_error(error_msg)

            if not check_phone(phone):
                error_msg = '手机号格式错误'
                return render_sms_registration_json_error(error_msg)

            exists = Profile.objects.get_username_by_phone(phone)
            if exists:
                error_msg = '手机号已注册'
                return render_sms_registration_json_error(error_msg)

            # same as seaqa-web/seahub/api2/endpoints/verify.py
            try:
                from seahub.utils.sms_clients import AliyunSmsClient

                # gen new code
                code = get_random_code()
                # send sms
                AliyunSmsClient().send_verify_code(phone, code)

                # cache the code
                set_sms_verify_code_cache(phone, SMS_REGISTRATION_SMS_TYPE, code)

                send_button_disabled = 'disabled'
                request.session[SESSION_KEY_SMS_REGISTRATION_PHONE] = phone
                request.session[SESSION_KEY_SMS_REGISTRATION_LOCK_TIME] = int(time.time()) + 60
                increase_send_sms_attempts(phone, ip)
                return HttpResponse(json.dumps({'success': True}), content_type='application/json')

            except Exception as e:
                logger.error('phone: %s send verify code: %s error: %s', phone, code, e)
                error_msg = _('Internal Server Error')
                return render_sms_registration_json_error(error_msg)
        else:
            # registration
            phone = request.session.get(SESSION_KEY_SMS_REGISTRATION_PHONE)
            if is_android:
                phone = request.POST.get('phone', '')
            if not phone:
                error_msg = '请先发送短信'
                return render_sms_registration_error(request, redirect_to, error_msg, send_button_disabled, phone, is_android)
            if not check_phone(phone):
                error_msg = '手机号格式错误'
                return render_sms_registration_error(request, redirect_to, error_msg, send_button_disabled, phone, is_android)

            exists = Profile.objects.get_username_by_phone(phone)
            if exists:
                error_msg = '手机号已注册'
                return render_sms_registration_error(request, redirect_to, error_msg, send_button_disabled, phone, is_android)

            # same as seaqa-web/seahub/api2/endpoints/profile.py
            verify_success = verify_sms_code(phone, SMS_REGISTRATION_SMS_TYPE, sms_code)

            if not verify_success:
                error_msg = '验证码不正确'
                return render_sms_registration_error(request, redirect_to, error_msg, send_button_disabled, phone, is_android)

            #
            form = form_class(data=request.POST)
            if form.is_valid():
                new_user = backend.register(request, **form.cleaned_data)
                # bind phone
                Profile.objects.add_or_update(new_user.username, phone=phone)

                # clear
                clear_sms_registration_session(request)
                clear_send_sms_attempts(phone, ip)

                if success_url is None:
                    to, args, kwargs = backend.post_registration_redirect(request, new_user)
                    response = redirect(to, *args, **kwargs)
                else:
                    response = redirect(success_url)

                source = request.COOKIES.get('REGISTRATION_SOURCE', '')
                invitation_token = request.COOKIES.get('INVITATION_TOKEN', '')
                try:
                    record_registration_logs(new_user, source, invitation_token)
                except Exception as e:
                    logger.warning('Failed to record registration log, error: %s' % e)

                response.delete_cookie('REGISTRATION_SOURCE')
                response.delete_cookie('INVITATION_TOKEN')

                if is_android:  # android
                    api_token = get_api_token(request)
                    return HttpResponse(json.dumps({'token': api_token.key}), content_type='application/json')

                return response
            else:
                error_msg = '名称或密码无效'
                return render_sms_registration_error(request, redirect_to, error_msg, send_button_disabled, phone, is_android)

    else:
        # GET
        phone = request.session.get(SESSION_KEY_SMS_REGISTRATION_PHONE, '')

    context = {}

    context['form'] = form
    context['strong_pwd_required'] = USER_STRONG_PASSWORD_REQUIRED

    login_bg_image_path = get_login_bg_image_path()
    context['login_bg_image_path'] = login_bg_image_path
    context['redirect_to'] = redirect_to or reverse('projects_list')
    context[redirect_field_name] = redirect_to or reverse('projects_list')

    context['phone'] = phone
    context['error_msg'] = error_msg
    context['send_button_disabled'] = send_button_disabled

    return render(request, template_name, context)
