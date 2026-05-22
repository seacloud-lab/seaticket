from rest_framework import status

from seahub.api2.utils import api_error
from seahub.project.constants import EMAIL_OAUTH_SESSION_KEY
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
        oauth_data = cls.get_oauth_session(key, request) or {}
        oauth_data['status'] = 'failure'
        oauth_data['error_msg'] = error_msg
        cls.set_oauth_session(key, request, oauth_data)


class EmailOAuthUtils(CommonOAuthUtils):
    @classmethod
    def get_oauth_session(cls, request):
        return super().get_oauth_session(EMAIL_OAUTH_SESSION_KEY, request)
    
    @classmethod
    def set_oauth_session(cls, request, data):
        return super().set_oauth_session(EMAIL_OAUTH_SESSION_KEY, request, data)
    
    @classmethod
    def set_oauth_failure(cls, request, error_msg):
        return super().set_oauth_failure(EMAIL_OAUTH_SESSION_KEY, request, error_msg)
    
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
