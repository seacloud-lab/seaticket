import json

from django.utils import timezone
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from rest_framework import status

from seahub import settings
from seahub.api2.utils import api_error
from seahub.project.constants import EMAIL_OAUTH_SESSION_KEY, EMAIL_OAUTH_SESSION_TIMEOUT, \
    EMAIL_ACCOUNT_TYPE_PERSONAL, EMAIL_ACCOUNT_TYPE_SHARED, PERSONAL_EMAIL_OAUTH_CONFIGS
from seahub.project.utils import is_oauth_email_provider


class CommonOAuthUtils:
    @classmethod
    def get_oauth_session(cls, key, request):
        oauth_data = request.session.get(key)
        if isinstance(oauth_data, dict):
            return oauth_data
        return None

    @classmethod
    def set_oauth_session(cls, key, request, data):
        request.session[key] = data
        request.session.modified = True

    @classmethod
    def set_oauth_failure(cls, key, request, error_msg):
        oauth_data = CommonOAuthUtils.get_oauth_session(key, request) or {}
        oauth_data['status'] = 'failure'
        oauth_data['error_msg'] = error_msg
        CommonOAuthUtils.set_oauth_session(key, request, oauth_data)


class EmailOAuthUtils(CommonOAuthUtils):
    @staticmethod
    def _get_personal_oauth_config(provider):
        config = PERSONAL_EMAIL_OAUTH_CONFIGS.get(provider)
        if not config:
            return None

        client_id = getattr(settings, config['client_id_setting'], '')
        client_secret = getattr(settings, config['client_secret_setting'], '')
        if not client_id or not client_secret:
            return None

        return {
            'client_id': client_id,
            'client_secret': client_secret,
            'authority_url': config['authority_url'],
            'token_url': config['token_url'],
            'scopes': list(config['scopes']),
            'authority_args': dict(config['authority_args']),
        }

    @classmethod
    def _get_oauth_transactions(cls, request):
        transactions = super().get_oauth_session(EMAIL_OAUTH_SESSION_KEY, request)
        return transactions if isinstance(transactions, dict) else {}

    @classmethod
    def _set_oauth_transactions(cls, request, transactions):
        super().set_oauth_session(EMAIL_OAUTH_SESSION_KEY, request, transactions)

    @classmethod
    def _remove_expired_transactions(cls, transactions):
        expires_before = timezone.now().timestamp() - EMAIL_OAUTH_SESSION_TIMEOUT
        return {
            state: transaction for state, transaction in transactions.items()
            if isinstance(transaction, dict) and transaction.get('created_at', 0) >= expires_before
        }

    @classmethod
    def get_oauth_session(cls, request, state):
        stored_transactions = cls._get_oauth_transactions(request)
        transactions = cls._remove_expired_transactions(stored_transactions)
        if transactions != stored_transactions:
            cls._set_oauth_transactions(request, transactions)
        return transactions.get(state)

    @classmethod
    def set_oauth_session(cls, request, state, data):
        transactions = cls._remove_expired_transactions(cls._get_oauth_transactions(request))
        transactions[state] = data
        cls._set_oauth_transactions(request, transactions)

    @classmethod
    def set_oauth_failure(cls, request, state, error_msg):
        oauth_data = cls.get_oauth_session(request, state)
        if not oauth_data:
            return
        oauth_data['status'] = 'failure'
        oauth_data['error_msg'] = error_msg
        cls.set_oauth_session(request, state, oauth_data)

    @classmethod
    def build_email_oauth_config(cls, request):
        data = getattr(request, 'data', None)
        if data is None:
            data = request.POST
            if request.content_type == 'application/json':
                try:
                    data = json.loads(request.body)
                except (TypeError, ValueError):
                    data = {}
        name = (data.get('name') or '').strip()
        config = data.get('config')
        if not name:
            return None, api_error(status.HTTP_400_BAD_REQUEST, 'name invalid.')
        if not isinstance(config, dict):
            return None, api_error(status.HTTP_400_BAD_REQUEST, 'config invalid.')

        config = dict(config)
        provider = config.get('server_provider')
        if not is_oauth_email_provider(provider):
            return None, api_error(status.HTTP_400_BAD_REQUEST, 'server_provider invalid.')

        account_type = config.get('account_type') or EMAIL_ACCOUNT_TYPE_PERSONAL
        if account_type not in (EMAIL_ACCOUNT_TYPE_PERSONAL, EMAIL_ACCOUNT_TYPE_SHARED):
            return None, api_error(status.HTTP_400_BAD_REQUEST, 'account_type invalid.')

        connection_config = {
            'server_provider': provider,
            'account_type': account_type,
        }
        if 'sync_years' in config:
            connection_config['sync_years'] = config['sync_years']

        if account_type == EMAIL_ACCOUNT_TYPE_PERSONAL:
            oauth_config = cls._get_personal_oauth_config(provider)
            if not oauth_config:
                return None, api_error(status.HTTP_400_BAD_REQUEST, 'Email OAuth provider is not configured.')
            return {
                'name': name,
                'config': connection_config,
                'oauth_config': oauth_config,
            }, None

        required_fields = ['client_id', 'client_secret', 'authority_url', 'token_url', 'scopes', 'authority_args']
        for key in required_fields:
            value = config.get(key)
            if value in (None, '', []):
                return None, api_error(status.HTTP_400_BAD_REQUEST, f'{key} invalid.')

        if not isinstance(config.get('scopes'), list):
            return None, api_error(status.HTTP_400_BAD_REQUEST, 'scopes invalid.')

        if not isinstance(config.get('authority_args'), dict):
            return None, api_error(status.HTTP_400_BAD_REQUEST, 'authority_args invalid.')
        if not config.get('authority_args'):
            return None, api_error(status.HTTP_400_BAD_REQUEST, 'authority_args invalid.')

        sender_email = (config.get('sender_email') or '').strip()
        if not sender_email:
            return None, api_error(status.HTTP_400_BAD_REQUEST, 'sender_email invalid.')
        try:
            validate_email(sender_email)
        except ValidationError:
            return None, api_error(status.HTTP_400_BAD_REQUEST, 'sender_email invalid.')

        config['server_provider'] = provider
        config['account_type'] = account_type
        config['sender_email'] = sender_email
        config['sender_name'] = (config.get('sender_name') or '').strip()
        return {
            'name': name,
            'config': config,
            'oauth_config': config,
        }, None
