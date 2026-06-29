import datetime
import logging
from urllib.parse import parse_qs, urlparse

import requests

from seahub import settings

logger = logging.getLogger(__name__)


class ConfluenceAPI:
    def __init__(self, access_token, refresh_token=None, expires_at=None, timeout=60):
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.expires_at = expires_at
        self.client_id = getattr(settings, 'CONFLUENCE_CLIENT_ID', '')
        self.client_secret = getattr(settings, 'CONFLUENCE_CLIENT_SECRET', '')
        self.token_url = 'https://auth.atlassian.com/oauth/token'
        self.timeout = timeout

    def _headers(self):
        return {
            'Authorization': f'Bearer {self.access_token}',
            'Accept': 'application/json',
        }

    def _request(self, url, params=None):
        """Send a GET request with proactive expiry check (60s buffer) and 401 retry."""
        now = datetime.datetime.now(datetime.timezone.utc)
        if self.expires_at and self.expires_at <= now + datetime.timedelta(seconds=60):
            logger.info('Confluence access token near expiry, refreshing proactively')
            self.refresh_access_token()

        response = requests.get(url, headers=self._headers(), params=params, timeout=self.timeout)
        if response.status_code == 401:
            logger.info('Confluence access token rejected, refreshing and retrying')
            self.refresh_access_token()
            response = requests.get(url, headers=self._headers(), params=params, timeout=self.timeout)
        response.raise_for_status()
        return response

    def refresh_access_token(self):
        if not self.client_id or not self.client_secret or not self.refresh_token:
            raise RuntimeError('Confluence OAuth settings are invalid.')

        payload = {
            'grant_type': 'refresh_token',
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'refresh_token': self.refresh_token,
        }
        response = requests.post(self.token_url, json=payload, timeout=self.timeout)
        response.raise_for_status()
        data = response.json()
        self.access_token = data.get('access_token')
        new_refresh_token = data.get('refresh_token')
        if new_refresh_token:
            self.refresh_token = new_refresh_token

        expires_in = data.get('expires_in') or 3600
        self.expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
            seconds=max(int(expires_in) - 60, 0)
        )
        return {
            'access_token': self.access_token,
            'refresh_token': self.refresh_token,
            'expires_at': self.expires_at,
        }

    def list_accessible_resources(self):
        """Fetch all Atlassian cloud sites accessible by this token.
        Returns a list of resources with id, name, url, scopes."""
        response = self._request('https://api.atlassian.com/oauth/token/accessible-resources')
        return response.json() or []

    def list_spaces(self, workspace_id):
        """List all spaces in a Confluence workspace.
        Uses cursor-based pagination via the v2 API."""
        all_spaces = []
        cursor = None
        limit = 100

        while True:
            url = f'https://api.atlassian.com/ex/confluence/{workspace_id}/wiki/api/v2/spaces'
            params = {'limit': limit}
            if cursor:
                params['cursor'] = cursor

            response = self._request(url, params=params)
            data = response.json()
            results = data.get('results') or []
            for space in results:
                space_id = space.get('id')
                if space_id is None:
                    continue
                all_spaces.append({
                    'id': str(space_id),
                    'key': space.get('key') or '',
                    'name': space.get('name') or '',
                    'type': space.get('type') or '',
                    'status': space.get('status') or '',
                })

            next_link = (data.get('_links') or {}).get('next')
            if not next_link:
                break
            query = parse_qs(urlparse(next_link).query)
            cursor_list = query.get('cursor')
            if not cursor_list:
                break
            cursor = cursor_list[0]

        return all_spaces

    @staticmethod
    def calc_expires_at(expires_in):
        expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
            seconds=max(int(expires_in or 3600) - 60, 0)
        )
        return expires_at
