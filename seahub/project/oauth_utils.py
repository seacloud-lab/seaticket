from django.utils import timezone
from rest_framework import status

from seahub.api2.utils import api_error
from seahub.project.constants import EMAIL_OAUTH_SESSION_KEY, EMAIL_OAUTH_SESSION_TIMEOUT
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
        name = (request.data.get('name') or '').strip()
        config = request.data.get('config')
        if not name:
            return None, api_error(status.HTTP_400_BAD_REQUEST, 'name invalid.')
        if not isinstance(config, dict):
            return None, api_error(status.HTTP_400_BAD_REQUEST, 'config invalid.')

        config = dict(config)
        provider = config.get('server_provider')
        if not is_oauth_email_provider(provider):
            return None, api_error(status.HTTP_400_BAD_REQUEST, 'server_provider invalid.')

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

        config['server_provider'] = provider
        return {
            'name': name,
            'config': config,
        }, None
