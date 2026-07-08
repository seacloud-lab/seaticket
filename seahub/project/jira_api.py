import datetime
import logging

import requests

from seahub import settings


logger = logging.getLogger(__name__)


class JiraAPI:
    def __init__(self, access_token, refresh_token=None, expires_at=None, timeout=60):
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.expires_at = expires_at
        self.client_id = getattr(settings, 'JIRA_CLIENT_ID', '')
        self.client_secret = getattr(settings, 'JIRA_CLIENT_SECRET', '')
        self.token_url = 'https://auth.atlassian.com/oauth/token'
        self.timeout = timeout

    def _headers(self):
        return {
            'Authorization': f'Bearer {self.access_token}',
            'Accept': 'application/json',
        }

    def refresh_access_token(self):
        if not self.client_id or not self.client_secret or not self.refresh_token:
            raise RuntimeError('Jira OAuth settings are invalid.')

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

        expires_in = data.get('expires_in', 3600) or 3600
        self.expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
            seconds=max(int(expires_in) - 60, 0)
        )
        return {
            'access_token': self.access_token,
            'refresh_token': self.refresh_token,
            'expires_at': self.expires_at,
        }

    def list_accessible_resources(self):
        """Fetch all Atlassian cloud sites accessible by this token."""
        url = 'https://api.atlassian.com/oauth/token/accessible-resources'
        response = requests.get(url, headers=self._headers(), timeout=self.timeout)
        if response.status_code == 401:
            self.refresh_access_token()
            response = requests.get(url, headers=self._headers(), timeout=self.timeout)
        response.raise_for_status()
        return response.json() or []

    def list_projects(self, site_id):
        """List all Jira projects for a given site."""
        url = f'https://api.atlassian.com/ex/jira/{site_id}/rest/api/3/project'
        response = requests.get(url, headers=self._headers(), timeout=self.timeout)
        if response.status_code == 401:
            self.refresh_access_token()
            response = requests.get(url, headers=self._headers(), timeout=self.timeout)
        response.raise_for_status()
        projects_data = response.json() or []
        projects = []
        for p in projects_data:
            p_id = p.get('id')
            p_key = p.get('key')
            if not p_id or not p_key:
                continue
            projects.append({
                'id': p_id,
                'key': p_key,
                'name': p.get('name') or p_key,
            })
        projects.sort(key=lambda item: item['key'].lower())
        return projects

    @staticmethod
    def calc_expires_at(expires_in):
        expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
            seconds=max(int(expires_in or 3600) - 60, 0)
        )
        return expires_at
