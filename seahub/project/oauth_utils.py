import datetime
import json

from django.utils import timezone
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from rest_framework import status

from seahub import settings
from seahub.api2.utils import api_error
from seahub.project.constants import EMAIL_OAUTH_SESSION_KEY, EMAIL_OAUTH_SESSION_TIMEOUT, \
    EMAIL_ACCOUNT_TYPE_PERSONAL, EMAIL_ACCOUNT_TYPE_SHARED, EMAIL_OAUTH_CONFIGS, MICROSOFT_OAUTH_URL_PREFIX, \
    NOTION_OAUTH_SESSION_KEY, NOTION_OAUTH_SESSION_TIMEOUT
from seahub.project.utils import is_oauth_email_provider


class CommonOAuthUtils:
    @staticmethod
    def calc_expires_at(expires_in):
        """Turn an OAuth token response's `expires_in` (seconds) into an absolute
        expiry datetime (UTC aware). Callers apply their own refresh threshold.
        """
        try:
            expires_in = int(expires_in or 3600)
        except (TypeError, ValueError):
            expires_in = 3600
        return datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=expires_in)

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


class NotionOAuthUtils(CommonOAuthUtils):
    @classmethod
    def get_oauth_session(cls, request):
        oauth_data = super().get_oauth_session(NOTION_OAUTH_SESSION_KEY, request)
        if not oauth_data:
            return None

        if oauth_data.get('created_at', 0) < timezone.now().timestamp() - NOTION_OAUTH_SESSION_TIMEOUT:
            cls.clear_oauth_session(request)
            return None

        return oauth_data

    @classmethod
    def set_oauth_session(cls, request, data):
        super().set_oauth_session(NOTION_OAUTH_SESSION_KEY, request, data)

    @classmethod
    def clear_oauth_session(cls, request):
        request.session.pop(NOTION_OAUTH_SESSION_KEY, None)
        request.session.modified = True

    @classmethod
    def set_oauth_failure(cls, request, error_msg):
        oauth_data = cls.get_oauth_session(request)
        if not oauth_data:
            return
        oauth_data['status'] = 'failure'
        oauth_data['error_msg'] = error_msg
        cls.set_oauth_session(request, oauth_data)


class EmailOAuthUtils(CommonOAuthUtils):
    @staticmethod
    def _get_oauth_config(provider, account_type, connection_config=None):
        config = EMAIL_OAUTH_CONFIGS.get(provider)
        if not config:
            return None

        connection_config = connection_config or {}
        if account_type == EMAIL_ACCOUNT_TYPE_PERSONAL:
            client_id = getattr(settings, config['client_id_setting'], '')
            client_secret = getattr(settings, config['client_secret_setting'], '')
        else:
            client_id = connection_config.get('client_id')
            client_secret = connection_config.get('client_secret')

        if not client_id or not client_secret:
            return None

        authority_url = config['authority_url']
        token_url = config['token_url']
        # Shared Microsoft apps may use tenant-specific endpoints. Gmail endpoints
        # are provider-owned and always come from the server configuration.
        if provider == 'Microsoft' and account_type == EMAIL_ACCOUNT_TYPE_SHARED:
            authority_url = connection_config.get('authority_url') or authority_url
            token_url = connection_config.get('token_url') or token_url

        return {
            'client_id': client_id,
            'client_secret': client_secret,
            'authority_url': authority_url,
            'token_url': token_url,
            'scopes': list(config['scopes'][account_type]),
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
            oauth_config = cls._get_oauth_config(provider, account_type)
            if not oauth_config:
                return None, api_error(status.HTTP_400_BAD_REQUEST, 'Email OAuth provider is not configured.')
            return {
                'name': name,
                'config': connection_config,
                'oauth_config': oauth_config,
            }, None

        for key in ('client_id', 'client_secret'):
            if not isinstance(config.get(key), str) or not config[key].strip():
                return None, api_error(status.HTTP_400_BAD_REQUEST, f'{key} invalid.')
            connection_config[key] = config[key].strip()

        if provider == 'Microsoft':
            for key in ('authority_url', 'token_url'):
                value = config.get(key)
                if value in (None, ''):
                    continue
                if not isinstance(value, str):
                    return None, api_error(status.HTTP_400_BAD_REQUEST, f'{key} invalid.')
                value = value.strip()
                if not value.startswith(MICROSOFT_OAUTH_URL_PREFIX):
                    return None, api_error(status.HTTP_400_BAD_REQUEST, f'{key} invalid.')
                connection_config[key] = value

        sender_email = (config.get('sender_email') or '').strip()
        if not sender_email:
            return None, api_error(status.HTTP_400_BAD_REQUEST, 'sender_email invalid.')
        try:
            validate_email(sender_email)
        except ValidationError:
            return None, api_error(status.HTTP_400_BAD_REQUEST, 'sender_email invalid.')

        connection_config['sender_email'] = sender_email
        connection_config['sender_name'] = (config.get('sender_name') or '').strip()
        oauth_config = cls._get_oauth_config(provider, account_type, connection_config)
        if not oauth_config:
            return None, api_error(status.HTTP_400_BAD_REQUEST, 'Email OAuth provider is not configured.')
        return {
            'name': name,
            'config': connection_config,
            'oauth_config': oauth_config,
        }, None
