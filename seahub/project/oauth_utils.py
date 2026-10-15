import json

from django.utils import timezone
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from rest_framework import status

from seahub import settings
from seahub.api2.utils import api_error
from seahub.project.constants import EMAIL_OAUTH_SESSION_KEY, EMAIL_OAUTH_SESSION_TIMEOUT, \
    EMAIL_ACCOUNT_TYPE_PERSONAL, EMAIL_ACCOUNT_TYPES, EMAIL_OAUTH_CONFIGS, MICROSOFT_OAUTH_URL_PREFIX, \
    EMAIL_OAUTH_CLIENT_DEFAULT, EMAIL_OAUTH_CLIENT_CUSTOM
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
    def _get_oauth_config(provider, account_type, connection_config=None):
        config = EMAIL_OAUTH_CONFIGS.get(provider)
        if not config or account_type not in EMAIL_ACCOUNT_TYPES.get(provider, ()):
            return None

        connection_config = connection_config or {}
        client_mode = connection_config.get('oauth_client_mode') or EMAIL_OAUTH_CLIENT_DEFAULT
        if client_mode == EMAIL_OAUTH_CLIENT_DEFAULT:
            client_id = getattr(settings, config['client_id_setting'], '')
            client_secret = getattr(settings, config['client_secret_setting'], '')
        elif client_mode == EMAIL_OAUTH_CLIENT_CUSTOM:
            client_id = connection_config.get('client_id')
            client_secret = connection_config.get('client_secret')
        else:
            return None

        if not client_id or not client_secret:
            return None

        authority_url = config['authority_url']
        token_url = config['token_url']
        # Custom Microsoft apps may use tenant-specific endpoints. Gmail endpoints
        # are provider-owned and always come from the server configuration.
        if provider == 'Microsoft' and client_mode == EMAIL_OAUTH_CLIENT_CUSTOM:
            authority_url = connection_config.get('authority_url') or authority_url
            token_url = connection_config.get('token_url') or token_url
            if not all(isinstance(url, str) and url.startswith(MICROSOFT_OAUTH_URL_PREFIX)
                       for url in (authority_url, token_url)):
                return None

        scopes = list(config['scopes'][account_type])
        # Platform authorization includes identity permissions. Custom personal
        # accounts also need them to discover their sender profile automatically.
        if client_mode == EMAIL_OAUTH_CLIENT_DEFAULT or account_type == EMAIL_ACCOUNT_TYPE_PERSONAL:
            scopes.extend(config['identity_scopes'])
        scopes = list(dict.fromkeys(scopes))

        return {
            'client_id': client_id,
            'client_secret': client_secret,
            'authority_url': authority_url,
            'token_url': token_url,
            'scopes': scopes,
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
        if account_type not in EMAIL_ACCOUNT_TYPES[provider]:
            return None, api_error(status.HTTP_400_BAD_REQUEST, 'account_type invalid.')

        client_mode = config.get('oauth_client_mode') or EMAIL_OAUTH_CLIENT_DEFAULT
        if client_mode not in (EMAIL_OAUTH_CLIENT_DEFAULT, EMAIL_OAUTH_CLIENT_CUSTOM):
            return None, api_error(status.HTTP_400_BAD_REQUEST, 'oauth_client_mode invalid.')

        connection_config = {
            'server_provider': provider,
            'account_type': account_type,
            'oauth_client_mode': client_mode,
        }
        if 'sync_years' in config:
            connection_config['sync_years'] = config['sync_years']

        if client_mode == EMAIL_OAUTH_CLIENT_CUSTOM:
            for key in ('client_id', 'client_secret'):
                if not isinstance(config.get(key), str) or not config[key].strip():
                    return None, api_error(status.HTTP_400_BAD_REQUEST, f'{key} invalid.')
                connection_config[key] = config[key].strip()

        if provider == 'Microsoft' and client_mode == EMAIL_OAUTH_CLIENT_CUSTOM:
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

        if account_type != EMAIL_ACCOUNT_TYPE_PERSONAL:
            sender_email = config.get('sender_email')
            if not isinstance(sender_email, str) or not sender_email.strip():
                return None, api_error(status.HTTP_400_BAD_REQUEST, 'sender_email invalid.')
            sender_email = sender_email.strip()
            try:
                validate_email(sender_email)
            except ValidationError:
                return None, api_error(status.HTTP_400_BAD_REQUEST, 'sender_email invalid.')
            sender_name = config.get('sender_name') or ''
            if not isinstance(sender_name, str):
                return None, api_error(status.HTTP_400_BAD_REQUEST, 'sender_name invalid.')
            connection_config['sender_email'] = sender_email
            connection_config['sender_name'] = sender_name.strip()
        oauth_config = cls._get_oauth_config(provider, account_type, connection_config)
        if not oauth_config:
            return None, api_error(status.HTTP_400_BAD_REQUEST, 'Email OAuth provider is not configured.')
        return {
            'name': name,
            'config': connection_config,
            'oauth_config': oauth_config,
        }, None
