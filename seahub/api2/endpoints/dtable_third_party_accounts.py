# -*- coding: utf-8 -*-
import json
import logging

from requests_oauthlib import OAuth2Session
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from urllib.parse import unquote

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.models import DTables, BoundThirdPartyAccounts, ACCOUNT_TYPE_EMAIL, ACCOUNT_TYPE_WECHAT_ROBOT, \
    _encrypt_detail, _decrypt_detail, ACCOUNT_TYPE_IMAGE_RECOGNITION, ACCOUNT_TYPE_DINGTALK, ACCOUNT_TYPE_SEAFILE
from seahub.dtable.settings import EASY_DL_TOKEN_CACHE_PREFIX
from seahub.dtable.utils import check_dtable_permission, check_dtable_admin_permission
from seahub.utils import uuid_str_to_32_chars, normalize_cache_key
from django.core.cache import cache
from seahub import auth
from seahub.settings import DTABLE_WEB_SERVICE_URL

logger = logging.getLogger(__name__)

ACCOUNT_TYPES = [
    ACCOUNT_TYPE_EMAIL,
    ACCOUNT_TYPE_WECHAT_ROBOT,
    ACCOUNT_TYPE_IMAGE_RECOGNITION,
    ACCOUNT_TYPE_DINGTALK,
    ACCOUNT_TYPE_SEAFILE
]

class DTableThirdPartyAccountsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, dtable_uuid):
        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable or dtable.deleted:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

        # permission check
        username = request.user.username
        if not check_dtable_permission(username, dtable.workspace, dtable):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            uuid_str = uuid_str_to_32_chars(dtable_uuid)
            accounts = BoundThirdPartyAccounts.objects.get_accounts_by_dtable(uuid_str)
        except Exception as e:
            logger.exception(e)
            error_msg = 'Internal Server Error.'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'accounts_list':[account.to_dict(drop_passwd_or_key=True) for account in accounts]})

    def post(self, request, dtable_uuid):
        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable or dtable.deleted:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')
        uuid_str = uuid_str_to_32_chars(dtable_uuid)
        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, dtable.workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        account_name = request.data.get('account_name', None)
        if not account_name:
            error_msg = 'Account name is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if BoundThirdPartyAccounts.objects.get_accounts_by_dtable_and_name(uuid_str, account_name):
            error_msg = 'Account name %s already exists.' % account_name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        account_type = request.data.get('account_type', None)
        if (not account_type) or (account_type not in ACCOUNT_TYPES):
            error_msg = 'Account type is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        detail = request.data.get('detail', None)
        if not detail:
            error_msg = 'Account info is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            account = BoundThirdPartyAccounts.objects.create(
                dtable_uuid=dtable.uuid.hex,
                account_name=account_name,
                account_type=account_type,
                detail=_encrypt_detail(detail)
            )
        except Exception as e:
            logger.exception(e)
            error_msg = 'Internal Server Error.'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'account': account.to_dict(drop_passwd_or_key=True)}, status=status.HTTP_201_CREATED)

class DTableThirdPartyAccountView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def put(self, request, dtable_uuid, account_id):
        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable or dtable.deleted:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, dtable.workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        account = BoundThirdPartyAccounts.objects.filter(id=account_id, dtable_uuid=dtable.uuid.hex).first()
        if not account:
            error_msg = 'Account does not exist.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        new_account_name = request.data.get('account_name', None)
        if new_account_name:
            account.account_name = new_account_name


        new_account_type = request.data.get('account_type', None)
        if new_account_type:
            account.account_type = new_account_type


        new_detail = request.data.get('detail', None)
        if not new_detail:
            error_msg = 'Account info is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        detail = _decrypt_detail(json.loads(account.detail))
        detail.update(new_detail)
        account.detail = _encrypt_detail(detail)

        try:
            account.save()
            cache_key = normalize_cache_key(str(account_id), EASY_DL_TOKEN_CACHE_PREFIX)
            cache.delete(cache_key)
        except Exception as e:
            logger.exception(e)
            error_msg = 'Internal Server Error.'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'account':account.to_dict(drop_passwd_or_key=True)})


    def delete(self, request, dtable_uuid, account_id):
        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable or dtable.deleted:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, dtable.workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            account = BoundThirdPartyAccounts.objects.get(id=account_id, dtable_uuid=dtable.uuid.hex)
            account.delete()
        except BoundThirdPartyAccounts.DoesNotExist:
            return api_error(status.HTTP_404_NOT_FOUND, 'Not found.')
        except Exception as e:
            logger.exception(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class DTableThirdPartyAccountDetailView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, dtable_uuid):
        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable or dtable.deleted:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

        # permission check
        username = request.user.username
        if not check_dtable_permission(username, dtable.workspace, dtable):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        account_name = request.GET.get('account_name', '')
        uuid_str = uuid_str_to_32_chars(dtable_uuid)
        account = BoundThirdPartyAccounts.objects.get_accounts_by_dtable_and_name(uuid_str, account_name)
        if not account:
            error_msg = "Account %s does not exits." % account_name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        account_info = account.to_dict(drop_passwd_or_key=True)
        return Response({
            'account': account_info
        })
    
class DTableThirdPartyEmailOAuthAccountAuthURLView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request):
        detail = request.data.get('detail')
        if not detail:
            error_msg = 'Missing OAuth credential parameters.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        client_id = detail.get('client_id')
        scope = detail.get('scopes')
        authority_url = detail.get('authority_url')
        authority_args = detail.get('authority_args')
        dtable_uuid = request.data.get('dtable_uuid')
        account_name = request.data.get('account_name')

        # parameters check
        if not client_id:
            error_msg = 'client_id is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        if not scope:
            error_msg = 'scope is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        if not authority_url:
            error_msg = 'authority_url is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        if not dtable_uuid:
            error_msg = 'dtable_uuid is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        if not account_name:
            error_msg = 'account_name is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable or dtable.deleted:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')
        uuid_str = uuid_str_to_32_chars(dtable_uuid)
        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, dtable.workspace.owner):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if BoundThirdPartyAccounts.objects.get_accounts_by_dtable_and_name(uuid_str, account_name):
            error_msg = 'Account name %s already exists.' % account_name
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        callback_url = DTABLE_WEB_SERVICE_URL + 'oauth/third-party-email-accounts/callback/'
        
        session = OAuth2Session(client_id=client_id,
            scope=scope,
            redirect_uri=callback_url)
        
        try:
            authority_url, state = session.authorization_url(authority_url)
            for key, value in authority_args.items():
                authority_url += f'&{key}={value}'
        except Exception as e:
            logger.exception(e)
            error_msg = 'Failure to fetch authorization url, please contact administractor.'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        
        request.session['oauth_email_accounts'] = {
            'oauth_state': state,
            'oauth_redirect': request.GET.get(auth.REDIRECT_FIELD_NAME, '/'),
            'dtable_uuid': dtable_uuid,
            'account_name': account_name,
            'account_detail': detail,
            'status': 'in-progress'
        }
        request.session.modified = True
        return Response({'auth_url': authority_url})
    
class DTableThirdPartyEmailOAuthAccountQueryView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        dtable_uuid = request.GET.get('dtable_uuid')
        account_name = request.GET.get('account_name')

        if not account_name:
            error_msg = 'Account name is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
    
        if not dtable_uuid:
            error_msg = 'dtable uuid is invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        results = {}

        try:
            task_status = request.session['oauth_email_accounts']['status']
            if task_status == 'failure':
                error_msg = request.session['oauth_email_accounts'].get('error_msg')
                return api_error(status.HTTP_401_UNAUTHORIZED, error_msg)
            elif task_status == 'success':
                try:
                    uuid_str = uuid_str_to_32_chars(dtable_uuid)
                    account = BoundThirdPartyAccounts.objects.get_accounts_by_dtable_and_name(uuid_str, account_name)
                    results['account'] = account.to_dict()
                    results['status'] = 'success'
                except Exception as e:
                    logger.exception(e)
                    error_msg = 'Account information not found, maybe authorization failure or internal server error'
                    return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
            elif task_status == 'in-progress':
                results['status'] = 'in-progress'
            else:
                error_msg = 'Invalid authorization progress'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        except:
            error_msg = 'Authorization task not found'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        return Response(results)
    