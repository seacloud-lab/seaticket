# Copyright (c) 2012-2016 Seafile Ltd.
import hashlib
import json
import logging
import random
import requests

from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.conf import settings
from django.core.cache import cache
from django.contrib.sites.shortcuts import get_current_site
from django.template.loader import render_to_string
from django.utils.translation import gettext as _
from constance import config

from seahub.avatar.settings import AVATAR_DEFAULT_SIZE
from seahub.avatar.templatetags.avatar_tags import api_avatar_url
from seahub.utils import is_valid_email
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.base.templatetags.seahub_tags import email2nickname, \
        email2contact_email
from seahub.dtable.models import IdInOrgTuple
from seahub.profile.models import Profile
from seahub.settings import ENABLE_UPDATE_USER_INFO, ENABLE_USER_SET_CONTACT_EMAIL, SEND_SMS_ATTEMPT_LIMIT, \
    SEND_SMS_ATTEMPT_TIMEOUT, ENABLE_CONVERT_TO_TEAM_ACCOUNT, ENABLE_USER_SET_NAME
from seahub.utils import is_org_context, send_html_email, get_update_contact_email_cache_key, is_user_password_strong
from seaserv import ccnet_api
from seahub.work_weixin.settings import WORK_WEIXIN_PROVIDER
from seahub.org_work_weixin.settings import ORG_WORK_WEIXIN_PROVIDER
from seahub.weixin.settings import WEIXIN_PROVIDER
from seahub.org_dingtalk.settings import ORG_DINGTALK_PROVIDER
from seahub.dingtalk.settings import DINGTALK_PROVIDER
from seahub.auth.models import SocialAuthUser
from seahub.ccnet_db.ccnet.users import remove_user_password
from seahub.base.accounts import User as AccountUser
from seahub.utils.verify import verify_sms_code
from seahub.auth.utils import get_send_sms_attempts, increase_send_sms_attempts, clear_send_sms_attempts
from seahub.utils.ip import get_remote_ip
from seahub.password_session.handlers import update_session_auth_hash
from seahub.base.accounts import UNUSABLE_PASSWORD
from seahub.utils.password import is_password_strength_valid

try:
    from seahub.settings import LDAP_PROVIDER
except ImportError:
    LDAP_PROVIDER = ''


logger = logging.getLogger(__name__)
json_content_type = 'application/json; charset=utf-8'

class User(APIView):
    """ Query/update user info of myself.
    """

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def _get_user_info(self, email):
        profile = Profile.objects.get_profile_by_user(email)

        info = {}
        info['email'] = email
        info['name'] = profile.nickname if profile and profile.nickname else ''
        info['contact_email'] = profile.contact_email if profile and profile.contact_email else ''
        info['login_id'] = profile.login_id if profile else ''
        info['list_in_address_book'] = profile.list_in_address_book if profile else False
        info['bind_phone'] = profile.phone or ''
        info['sms_2fa'] = profile.sms_2fa

        return info

    def _update_user_info(self, info_dict, email):

        # update nickname
        if info_dict['name']:
            Profile.objects.add_or_update(email, nickname=info_dict['name'])

        # update user list_in_address_book
        if info_dict['list_in_address_book']:
            Profile.objects.add_or_update(email, list_in_address_book=info_dict['list_in_address_book'])

        # update user sms_2fa
        if info_dict['sms_2fa'] is not None:
            Profile.objects.add_or_update(email, sms_2fa=info_dict['sms_2fa'])

    def get(self, request):
        email = request.user.username
        info = self._get_user_info(email)

        org_id = -1
        if is_org_context(request):
            org_id = request.user.org.org_id

        id_in_org = ''
        try:
            id_in_org_query = IdInOrgTuple.objects.filter(virtual_id=email, org_id=org_id)
            if id_in_org_query.exists():
                id_in_org = id_in_org_query.first().id_in_org
        except Exception as e:
            logger.error(f'get id_in_org for user failed. {e}')
            id_in_org = ''
        info['id_in_org'] = id_in_org

        return Response(info)

    def put(self, request):

        email = request.user.username

        if not ENABLE_UPDATE_USER_INFO:
            error_msg = _('Feature disabled.')
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # argument check for name
        name = request.data.get("name", None)
        if name:
            if not ENABLE_USER_SET_NAME:
                error_msg = _('Feature disabled.')
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)

            name = name.strip()
            if len(name) > 64:
                error_msg = _('Name is too long (maximum is 64 characters)')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if "/" in name:
                error_msg = _("Name should not include '/'.")
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # argument check for list_in_address_book
        list_in_address_book = request.data.get("list_in_address_book", None)
        if list_in_address_book is not None:
            if list_in_address_book.lower() not in ('true', 'false'):
                error_msg = 'list_in_address_book invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        sms_2fa = request.data.get("sms_2fa", None)
        if sms_2fa is not None:
            if not isinstance(sms_2fa, bool):
                error_msg = 'sms_2fa invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        info_dict = {
            'name': name,
            'list_in_address_book': list_in_address_book,
            'sms_2fa': sms_2fa,
        }

        # update user profile and user additionnal info
        try:
            self._update_user_info(info_dict, email)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # get user info and return
        info = self._get_user_info(email)
        return Response(info)


class UserContactEmailView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    EXPIRATION_DAYS = 1
    UPDATE_KEY_TIMEOUT = 60 * 60 * 24 * EXPIRATION_DAYS

    def _cache_update_contact_email_key(self, username, new_contact_email):
        salt = hashlib.sha1(str(random.random()).encode('utf-8')).hexdigest()[:5].encode('utf-8')
        # if isinstance(username, str):
        #     username = username.encode('utf-8')
        update_key = hashlib.sha1(salt+username.encode('utf-8')).hexdigest()
        cache_key = get_update_contact_email_cache_key(update_key)
        cache.set(cache_key, json.dumps({
            'username': username,
            'new_contact_email': new_contact_email
        }), self.UPDATE_KEY_TIMEOUT)
        return update_key

    def put(self, request):
        if not ENABLE_USER_SET_CONTACT_EMAIL:
            error_msg = _('Feature disabled.')
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # arguments check
        new_contact_email = request.data.get('new_contact_email')
        if not new_contact_email:
            return api_error(status.HTTP_400_BAD_REQUEST, 'new_contact_email invalid.')

        # check email
        new_contact_email = new_contact_email.strip()
        if not is_valid_email(new_contact_email):
            error_msg = 'new_contact_email invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if Profile.objects.get_profile_by_contact_email(new_contact_email):
            error_msg = _('The email has been bound by someone else!')
            return api_error(status.HTTP_409_CONFLICT, error_msg)

        update_key = self._cache_update_contact_email_key(request.user.username, new_contact_email)

        # send to new contact email
        ctx_dict = {'update_key': update_key,
                    'expiration_days': self.EXPIRATION_DAYS,
                    'site': get_current_site(request),
                    'SITE_ROOT': settings.SITE_ROOT}
        subject = render_to_string('profile/update_contact_email_subject.txt',
                                   ctx_dict)
        # Email subject *must not* contain newlines
        subject = ''.join(subject.splitlines())
        try:
            send_html_email(subject, 'profile/update_contact_email.html', ctx_dict, None, [new_contact_email])
        except Exception as e:
            logger.error('send email error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({
            'msg': 'Email has been sent, please check it in your current mail box.'
        })


class UserCommonInfoView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, email):
        # checkout valid username
        user = ccnet_api.get_emailuser_with_import(email)
        if not user:
            return api_error(status.HTTP_404_NOT_FOUND, 'User not found.')

        info = {}
        info['email'] = email
        info['name'] = email2nickname(email)
        info['avatar_url'] = api_avatar_url(email)[0]

        # about some private info(such as contact_email) so far, like following table
        # +-------------------+----------------+------------------------------+
        # |  request/target   |   not org      |   org                        |
        # +-------------------------------------------------------------------+
        # |      not org      |   excluding    |   exluding                   |
        # +-------------------------------------------------------------------+
        # |       org         |   excluding    |   including if org identical |
        # +-------------------+----------------+------------------------------+

        if is_org_context(request):  # request-user is an org user
            orgs = ccnet_api.get_orgs_by_user(email)  # target user's org(s)
            if orgs:
                if orgs[0].org_id == request.user.org.org_id:
                    info['contact_email'] = email2contact_email(email)

        return Response(info)


class RemovePasswordView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def put(self, request):

        provider_list = [WORK_WEIXIN_PROVIDER, WEIXIN_PROVIDER, ORG_WORK_WEIXIN_PROVIDER, ORG_DINGTALK_PROVIDER,
                         DINGTALK_PROVIDER]

        is_connect_wx_or_dingtalk = SocialAuthUser.objects.filter(username=request.user.username,
                                                                  provider__in=provider_list).exists()

        try:
            profile = Profile.objects.get(user=request.user.username)
        except Profile.DoesNotExist:
            error_msg = 'user %s not found.' % request.user.username
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)
        except Exception as e:
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if not is_connect_wx_or_dingtalk and not profile.phone:
            error_msg = 'phone or third party account not bind'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            remove_user_password(request.user.username)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class UserResetPasswordByPhoneView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request):
        code = request.data.get('code')
        phone = request.data.get('phone')
        new_password = request.data.get('new_password')
        confirm_password = request.data.get('confirm_password')
        if not all([code, phone]):
            error_msg = 'code or phone invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if not all([new_password, confirm_password]) or new_password != confirm_password:
            error_msg = 'password invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        if len(new_password) > 4096:
            error_msg = 'Password is too long (maximum is 4096 characters).'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        ip = get_remote_ip(request)

        if get_send_sms_attempts(ip=ip) >= SEND_SMS_ATTEMPT_LIMIT:
            error_msg = '验证码错误次数过多，请 %s 分钟后再试' % (SEND_SMS_ATTEMPT_TIMEOUT // 60)
            return api_error(status.HTTP_429_TOO_MANY_REQUESTS, error_msg)

        increase_send_sms_attempts(phone, ip)

        # verify code
        if not verify_sms_code(phone, 'reset_password', code):
            error_msg = 'Code incorrect'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            user = AccountUser.objects.get(email=request.user.username)
        except AccountUser.DoesNotExist as e:
            logger.error(e)
            error_msg = 'email invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        user.set_password(new_password)
        user.save()

        clear_send_sms_attempts(phone, ip)

        return Response({'success': True})


class UserConvertToTeamView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request):
        from seahub.constants import ORG_DEFAULT
        from seahub.subscription.utils import subscription_check, get_customer_id, \
            get_subscription_api_headers
        from seahub.subscription.settings import SUBSCRIPTION_SERVER_URL, SUBSCRIPTION_ORG_PREFIX
        from seahub.invitations.utils import record_registration_logs, record_org_registration_logs
        from seahub.organizations.utils import user_convert_to_org, gen_org_url_prefix
        from seahub.organizations.signals import org_created
        from seahub.organizations.models import OrgSettings
        from seahub.organizations.settings import ORG_AUTO_URL_PREFIX

        if not ENABLE_CONVERT_TO_TEAM_ACCOUNT:
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        if request.user.org:
            error_msg = 'User is already in team.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # main
        if ORG_AUTO_URL_PREFIX:
            url_prefix = gen_org_url_prefix(3)
            if url_prefix is None:
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        username = request.user.username
        # Use the nickname as the org_name, but the org_name does not support emoji
        nickname = email2nickname(username)
        nickname_characters = []
        for character in nickname:
            if len(character.encode('utf-8')) > 3:
                nickname_characters.append('_')
            else:
                nickname_characters.append(character)
        org_name = ''.join(nickname_characters)

        try:
            org_id = ccnet_api.create_org(org_name, url_prefix, username)
        except Exception as e:
            logger.exception(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        new_org = ccnet_api.get_org_by_id(org_id)
        org_created.send(sender=None, org=new_org)
        OrgSettings.objects.add_or_update(new_org, ORG_DEFAULT)

        convert_status = user_convert_to_org(username, new_org.org_id)
        if not convert_status:
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        source = request.COOKIES.get('REGISTRATION_SOURCE', '')
        invitation_token = request.COOKIES.get('INVITATION_TOKEN', '')
        try:
            record_org_registration_logs(new_org, source)
            record_registration_logs(request.user, source, invitation_token)
        except Exception as e:
            logger.warning('Failed to record registration log, error: %s' % e)

        # subscription
        if subscription_check():
            try:
                customer_id = get_customer_id(request)
                headers = get_subscription_api_headers()
                data = {
                    'customer_id': customer_id,
                    'new_customer_id': SUBSCRIPTION_ORG_PREFIX + str(new_org.org_id),
                }
                url = SUBSCRIPTION_SERVER_URL.rstrip('/') + '/api/subscription/user-convert-to-team/'
                response = requests.post(url, json=data, headers=headers)
                if response.status_code != 200:
                    logger.warning(response.text)
            except Exception as e:
                logger.warning(e)

        return Response({'success': True})
    

class ResetPasswordView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request):
        if not isinstance(request.data, dict):
            return api_error(status.HTTP_400_BAD_REQUEST, 'Bad request')
        old_password = request.data.get('old_password')
        if old_password and (not isinstance(old_password, str) or len(old_password) > 4096):
            return api_error(status.HTTP_400_BAD_REQUEST, 'Old password invalid')
        new_password = request.data.get('new_password')
        if not new_password or (not isinstance(new_password, str)) or len(new_password) > 4096:
            return api_error(status.HTTP_400_BAD_REQUEST, 'New password invalid')

        if old_password == new_password:
            return api_error(status.HTTP_400_BAD_REQUEST, 'New password cannot be the same as old password')

        if not is_password_strength_valid(new_password):
            return api_error(status.HTTP_400_BAD_REQUEST, 'Password strength should be strong or very strong')

        user = request.user
        if user.enc_password != UNUSABLE_PASSWORD and not old_password:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Old password invalid')

        has_bind_social_auth = False
        if SocialAuthUser.objects.filter(username=request.user.username).exists():
            has_bind_social_auth = True

        has_bind_ldap_auth = False
        if SocialAuthUser.objects.filter(username=request.user.username, provider=LDAP_PROVIDER).exists():
            has_bind_ldap_auth = True

        can_update_password = True
        if (not settings.ENABLE_SSO_USER_CHANGE_PASSWORD) and has_bind_social_auth:
            can_update_password = False

        if settings.ENABLE_LDAP and (not settings.ENABLE_LDAP_USER_CHANGE_PASSWORD) and has_bind_ldap_auth:
            can_update_password = False

        if not can_update_password:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        if old_password and not user.check_password(old_password):
            return api_error(status.HTTP_400_BAD_REQUEST, 'Old password incorrect')

        user.set_password(new_password)
        user.save()

        if not request.session.is_empty():
            # update session auth hash
            update_session_auth_hash(request, request.user)

        return Response({'success': True})
