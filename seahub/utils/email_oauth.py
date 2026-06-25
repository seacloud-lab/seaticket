"""Shared OAuth token client for OAuth-based email providers.

Both email sending (``email_sender``) and mailbox operations
(``mailbox_manager``) need to refresh OAuth access tokens for Gmail/Microsoft.
This module holds that shared logic so neither side duplicates it.
"""
import logging
import time
from urllib import parse

import requests

logger = logging.getLogger(__name__)


class EmailAuthProviderError(Exception):
    """Email auth provider error (OAuth token fetch failure)."""
    pass


def _check_and_raise_error(response):
    if response.status_code >= 400:
        raise ConnectionError(response.json())


class OAuthTokenClient:
    """Mixin providing OAuth access-token management.

    Subclasses are expected to also hold a provider-specific configuration and
    call :meth:`_request_access_token` before making authenticated requests.
    The refreshed token is written back into ``self.config`` and
    ``self.config_updated`` is set so callers can persist it.
    """

    def __init__(self, config):
        self.config = config
        self.config_updated = False
        self.client_id = config.get('client_id')
        self.client_secret = config.get('client_secret')
        self.refresh_token = config.get('refresh_token')
        self.access_token = config.get('access_token')
        self.expires_at = config.get('expires_at')
        self.token_url = config.get('token_url')
        self.scopes = config.get('scopes')

    def _has_complete_oauth_config(self):
        return all([
            self.client_id, self.client_secret, self.refresh_token,
            self.token_url, self.scopes,
        ])

    def _request_access_token(self):
        if not self.access_token or self.expires_at is None or self.expires_at - time.time() < 300:
            params = {
                'grant_type': 'refresh_token',
                'client_id': self.client_id,
                'client_secret': self.client_secret,
                'refresh_token': self.refresh_token,
                'scope': ' '.join(self.scopes)
            }
            headers = {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
            response = requests.post(self.token_url, headers=headers, data=parse.urlencode(params))
            try:
                _check_and_raise_error(response)
            except Exception as e:
                logger.exception('Failure to fetch new access token, error: %s', e)
                raise EmailAuthProviderError('Failed to fetch access token')
            else:
                response = response.json()
                if 'access_token' not in response:
                    logger.exception('Failure to fetch new access token. No access_token in response.')
                    raise EmailAuthProviderError('No access_token in response')

            expires_at = 0
            if response.get('ext_expires_at'):
                expires_at = response.get('ext_expires_at')
            elif response.get('expires_at'):
                expires_at = response.get('expires_at')
            elif response.get('ext_expires_in'):
                expires_at = response.get('ext_expires_in') + time.time()
            elif response.get('expires_in'):
                expires_at = response.get('expires_in') + time.time()

            self._update_access_token(
                response.get('access_token'),
                expires_at,
                response.get('refresh_token') or self.refresh_token,
            )

    def _update_access_token(self, new_access_token, new_expires_at, new_refresh_token):
        self.access_token = new_access_token
        self.expires_at = new_expires_at
        self.refresh_token = new_refresh_token
        self.config['access_token'] = new_access_token
        self.config['expires_at'] = new_expires_at
        self.config['refresh_token'] = new_refresh_token
        self.config_updated = True


__all__ = [
    'EmailAuthProviderError',
    'OAuthTokenClient',
]
