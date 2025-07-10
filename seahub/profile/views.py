# Copyright (c) 2012-2016 Seafile Ltd.
# encoding: utf-8
import logging
import json
from django.conf import settings
from django.core.cache import cache
from django.urls import reverse
from django.http import HttpResponseRedirect, Http404
from django.shortcuts import render
from django.contrib import messages
from django.utils.translation import gettext as _
from constance import config

from seahub.organizations.models import OrgAdminSettings
from .models import Profile
from seahub.auth.decorators import login_required
from seahub.utils import is_org_context, is_pro_version, is_valid_username
from seahub.base.accounts import User, UNUSABLE_PASSWORD
from seahub.base.templatetags.seahub_tags import email2nickname, email2contact_email
from seahub.options.models import UserOptions
from seahub.utils import render_error, get_update_contact_email_cache_key
from seahub.utils.two_factor_auth import has_two_factor_auth
from seahub.work_weixin.utils import work_weixin_oauth_check
from seahub.weixin.utils import weixin_check, get_mp_weixin_users_openid
from seahub.settings import ENABLE_SSO_USER_CHANGE_PASSWORD, ENABLE_DELETE_ACCOUNT, ENABLE_UPDATE_USER_INFO, ENABLE_BIND_PHONE, \
    ENABLE_LDAP_USER_CHANGE_PASSWORD, USE_EXTERNAL_TEAM_ADMIN, ENABLE_CONVERT_TO_TEAM_ACCOUNT, \
    ENABLE_SAML, ENABLE_MULTI_SAML, ENABLE_USER_SET_NAME, USER_STRONG_PASSWORD_REQUIRED
from seahub.auth.models import SocialAuthUser
from seahub.work_weixin.settings import WORK_WEIXIN_PROVIDER
from seahub.weixin.settings import WEIXIN_PROVIDER, MP_OPENID
from seahub.org_work_weixin.utils import org_work_weixin_check
from seahub.org_work_weixin.settings import ORG_WORK_WEIXIN_PROVIDER
from seahub.org_dingtalk.utils import org_dingtalk_check
from seahub.org_dingtalk.settings import ORG_DINGTALK_PROVIDER
from seahub.dingtalk.settings import DINGTALK_PROVIDER
from seahub.dingtalk.utils import dingtalk_check
from seahub.organizations.utils import get_org_corp_bind_type

try:
    from seahub.settings import ENABLE_LDAP, LDAP_PROVIDER
except ImportError as e:
    ENABLE_LDAP = False
    LDAP_PROVIDER = ''
try:
    from seahub.settings import SAML_PROVIDER_IDENTIFIER
except ImportError as e:
    SAML_PROVIDER_IDENTIFIER = 'saml'

logger = logging.getLogger(__name__)
COLLABORATE_EMAIL_INTERVAL_DEFAULT = 3600 # One hour by seconds

@login_required
def edit_profile(request):
    """
    Show and edit user profile.
    """
    username = request.user.username

    if settings.ENABLE_WEBDAV_SECRET:
        decoded = UserOptions.objects.get_webdav_decoded_secret(username)
        webdav_passwd = decoded if decoded else ''
    else:
        webdav_passwd = ''

    project_updates_email_interval = UserOptions.objects.get_dtable_updates_email_interval(username)
    project_updates_email_interval = project_updates_email_interval if project_updates_email_interval is not None else 0
    project_collaborate_email_interval = UserOptions.objects.get_dtable_collaborate_email_interval(username)
    project_collaborate_email_interval = project_collaborate_email_interval if project_collaborate_email_interval is not None else COLLABORATE_EMAIL_INTERVAL_DEFAULT

    # social oauth
    enable_work_weixin = False
    enable_dingtalk = False
    enable_org_work_weixin = False
    enable_weixin = False
    enable_org_dingtalk = False
    work_weixin_connected = False
    org_work_weixin_connected = False
    org_work_weixin_license_status = 0
    dingtalk_connected = False
    weixin_connected = False
    enable_saml = False
    saml_connected = False
    enable_multi_saml = False
    org_saml_connected = False
    weixin_official_accounts_followed = False
    org_dingtalk_connected = False
    org_corp_bind_type = ''

    if work_weixin_oauth_check():
        enable_work_weixin = True
        work_weixin_connected = SocialAuthUser.objects.filter(
            username=request.user.username, provider=WORK_WEIXIN_PROVIDER).exists()
    if dingtalk_check():
        enable_dingtalk = True
        dingtalk_connected = SocialAuthUser.objects.filter(
            username=request.user.username, provider=DINGTALK_PROVIDER).exists()
    if org_work_weixin_check() and is_org_context(request):
        enable_org_work_weixin = True
        org_work_weixin_connected = SocialAuthUser.objects.filter(
            username=request.user.username, provider=ORG_WORK_WEIXIN_PROVIDER).exists()
        if org_work_weixin_connected:
            try:
                from seahub.org_work_weixin.utils import get_active_info_by_user
                uid = SocialAuthUser.objects.filter(username=request.user.username, provider=ORG_WORK_WEIXIN_PROVIDER).first().uid
                active_info = get_active_info_by_user(uid)
                if active_info:
                    org_work_weixin_license_status = active_info.get('active_status', 0)
            except Exception as e:
                logger.error(e)
    if weixin_check():
        enable_weixin = True
        weixin_obj = SocialAuthUser.objects.filter(
            username=request.user.username, provider=WEIXIN_PROVIDER).first()
        if weixin_obj:
            weixin_connected = True
            if weixin_obj.extra_data:
                try:
                    openid = json.loads(weixin_obj.extra_data).get(MP_OPENID)
                    users_openid = get_mp_weixin_users_openid()  # refresh every hour
                    if openid in users_openid:
                        weixin_official_accounts_followed = True
                except Exception as e:
                    logger.error(e)
    if org_dingtalk_check() and is_org_context(request):
        enable_org_dingtalk = True
        org_dingtalk_connected = SocialAuthUser.objects.filter(
            username=request.user.username, provider=ORG_DINGTALK_PROVIDER).exists()
    if is_org_context(request) and (org_dingtalk_check() or org_work_weixin_check()):
        org_corp_bind_type = get_org_corp_bind_type(request.user.org.org_id)

    if ENABLE_SAML:
        enable_saml = True
        saml_connected = SocialAuthUser.objects.filter(
            username=request.user.username, provider=SAML_PROVIDER_IDENTIFIER).exists()
    if ENABLE_MULTI_SAML and is_org_context(request):
        enable_multi_saml = True
        org_saml_connected = SocialAuthUser.objects.filter(
            username=request.user.username, provider=SAML_PROVIDER_IDENTIFIER).exists()

    has_bind_social_auth = False
    if SocialAuthUser.objects.filter(username=request.user.username).exists():
        has_bind_social_auth = True

    can_update_password = True
    if (not ENABLE_SSO_USER_CHANGE_PASSWORD) and has_bind_social_auth:
        can_update_password = False

    if ENABLE_LDAP and\
        SocialAuthUser.objects.filter(username=request.user.username, provider=LDAP_PROVIDER).exists():
        if not ENABLE_LDAP_USER_CHANGE_PASSWORD:
            can_update_password = False

    org_id = request.user.org and request.user.org.org_id or None
    enable_member_modify_name = True
    if org_id:
        enable_member_modify_name = OrgAdminSettings.objects.is_enable_memeber_modify_name_by_org_id(org_id)

    resp_dict = {
            'is_pro': is_pro_version(),
            'two_factor_auth_enabled': has_two_factor_auth(),
            'ENABLE_WEBDAV_SECRET': settings.ENABLE_WEBDAV_SECRET,
            'ENABLE_DELETE_ACCOUNT': False if is_org_context(request) else ENABLE_DELETE_ACCOUNT,
            'ENABLE_CONVERT_TO_TEAM_ACCOUNT': False if is_org_context(request) else ENABLE_CONVERT_TO_TEAM_ACCOUNT,
            'ENABLE_UPDATE_USER_INFO': ENABLE_UPDATE_USER_INFO,
            'webdav_passwd': webdav_passwd,
            'project_updates_email_interval': project_updates_email_interval,
            'project_collaborate_email_interval': project_collaborate_email_interval,
            'enable_work_weixin': enable_work_weixin,
            'enable_dingtalk': enable_dingtalk,
            'enable_org_work_weixin': enable_org_work_weixin,
            'enable_weixin': enable_weixin,
            'enable_org_dingtalk': enable_org_dingtalk,
            'work_weixin_connected': work_weixin_connected,
            'dingtalk_connected': dingtalk_connected,
            'org_work_weixin_connected': org_work_weixin_connected,
            'org_work_weixin_license_status': org_work_weixin_license_status,
            'weixin_connected': weixin_connected,
            'org_dingtalk_connected': org_dingtalk_connected,
            'weixin_official_accounts_followed': weixin_official_accounts_followed,
            'org_corp_bind_type': org_corp_bind_type,
            'social_next_page': reverse('edit_profile'),
            'ENABLE_USER_SET_CONTACT_EMAIL': settings.ENABLE_USER_SET_CONTACT_EMAIL,
            'ENABLE_USER_SET_NAME' : ENABLE_USER_SET_NAME,
            'use_external_team_admin': USE_EXTERNAL_TEAM_ADMIN,
            'user_unusable_password': request.user.enc_password == UNUSABLE_PASSWORD,
            'enable_bind_phone': ENABLE_BIND_PHONE,
            'enable_saml': enable_saml,
            'saml_connected': saml_connected,
            'enable_multi_saml': enable_multi_saml,
            'org_saml_connected': org_saml_connected,
            'org_id': org_id,
            'can_update_password': can_update_password,
            'strong_password_required': bool(USER_STRONG_PASSWORD_REQUIRED),
            'enable_member_modify_name': enable_member_modify_name,
    }

    if has_two_factor_auth():
        from seahub.two_factor.models import StaticDevice, default_device

        try:
            backup_tokens = StaticDevice.objects.get(
                user=request.user.username).token_set.count()
        except StaticDevice.DoesNotExist:
            backup_tokens = 0

        resp_dict['default_device'] = default_device(request.user)
        resp_dict['backup_tokens'] = backup_tokens

    #template = 'profile/set_profile.html'
    template = 'profile/set_profile_react.html'
    return render(request, template, resp_dict)

@login_required
def user_profile(request, username):
    if is_valid_username(username):
        try:
            user = User.objects.get(email=username)
        except User.DoesNotExist:
            user = None
    else:
        user = None

    if user is not None:
        nickname = email2nickname(user.username)
    else:
        nickname = ''

    return render(request, 'profile/user_profile.html', {
            'user': user,
            'nickname': nickname,
            })

@login_required
def delete_user_account(request):
    if request.method != 'POST':
        raise Http404

    username = request.user.username

    if not ENABLE_DELETE_ACCOUNT:
        messages.error(request, _('Permission denied.'))
        next_page = request.META.get('HTTP_REFERER', settings.SITE_ROOT)
        return HttpResponseRedirect(next_page)

    if is_org_context(request):
        messages.error(request, _('Permission denied.'))
        next_page = request.META.get('HTTP_REFERER', settings.SITE_ROOT)
        return HttpResponseRedirect(next_page)

    if username == 'demo@seafile.com':
        messages.error(request, _('Demo account can not be deleted.'))
        next_page = request.META.get('HTTP_REFERER', settings.SITE_ROOT)
        return HttpResponseRedirect(next_page)

    detail = {
        'name': email2nickname(username),
        'contact_email': email2contact_email(username)
    }

    org_id = request.user.org.org_id if is_org_context(request) else -1

    user = User.objects.get(email=username)
    user.delete()

    return HttpResponseRedirect(settings.LOGIN_URL)


def update_contact_email_view(request, update_key):
    cache_key = get_update_contact_email_cache_key(update_key)
    new_email_info_str = cache.get(cache_key)
    if not new_email_info_str:
        raise Http404
    try:
        new_email_info = json.loads(new_email_info_str)
    except:
        raise Http404
    username, new_contact_email = new_email_info['username'], new_email_info['new_contact_email']

    if Profile.objects.get_username_by_contact_email(new_contact_email):
        tip = _('The email address has already been bound to another account.')
        next_url = 'edit_profile'
        operation_text = _('Back to SeaTable')
    else:
        try:
            Profile.objects.add_or_update(username, contact_email=new_contact_email)
            Profile.objects.filter(user=username).update(is_manually_set_contact_email=True)
        except Exception as e:
            logger.error(e)
            return render_error(request, _('Internal Server Error'))

        tip = _('Contact email has been updated.')
        next_url = 'edit_profile'
        operation_text = _('Back to SeaTable')

    cache.delete(cache_key)

    context = {
        'tip': tip,
        'next_url': next_url,
        'operation_text': operation_text
    }

    return render(request, 'profile/update_contact_email_complete.html', context=context)
