import datetime
import logging

import requests

from seahub import settings


logger = logging.getLogger(__name__)

OAUTH_TOKEN_EXPIRY_BUFFER_SECONDS = 60


class JiraAPI:
    def __init__(self, access_token, refresh_token, expires_at, timeout=60, on_token_refreshed=None):
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.expires_at = expires_at
        self.client_id = getattr(settings, 'JIRA_CLIENT_ID', '')
        self.client_secret = getattr(settings, 'JIRA_CLIENT_SECRET', '')
        self.token_url = 'https://auth.atlassian.com/oauth/token'
        self.timeout = timeout
        # Called with the new token right after a refresh, so a rotated refresh
        # token survives a failure of the request that triggered the refresh.
        self.on_token_refreshed = on_token_refreshed

    def _headers(self):
        return {
            'Authorization': f'Bearer {self.access_token}',
            'Accept': 'application/json',
        }

    def _request(self, method, url, **kwargs):
        kwargs.setdefault('timeout', self.timeout)
        kwargs['headers'] = self._headers()
        response = requests.request(method, url, **kwargs)
        if response.status_code == 401:
            self.refresh_access_token()
            kwargs['headers'] = self._headers()
            response = requests.request(method, url, **kwargs)
        response.raise_for_status()
        return response

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
            seconds=max(int(expires_in) - OAUTH_TOKEN_EXPIRY_BUFFER_SECONDS, 0)
        )
        token = {
            'access_token': self.access_token,
            'refresh_token': self.refresh_token,
            'expires_at': self.expires_at,
        }
        if self.on_token_refreshed:
            try:
                self.on_token_refreshed(token)
            except Exception as e:
                logger.error('Failed to store the refreshed Jira token: %s', e)
        return token

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
            projects.append({
                'id': p_id,
                'key': p_key,
                'name': p.get('name'),
            })
        return projects

    @staticmethod
    def build_adf_description(content):
        paragraphs = []
        for line in (content or '').splitlines() or ['']:
            paragraph = {'type': 'paragraph', 'content': []}
            if line:
                paragraph['content'].append({'type': 'text', 'text': line})
            paragraphs.append(paragraph)
        return {
            'type': 'doc',
            'version': 1,
            'content': paragraphs,
        }

    def create_issue(
        self, site_id, project_key, title, description, issue_type_id,
        priority_id=None, assignee_id=None, due_date=None,
    ):
        fields = {
            'project': {'key': project_key},
            'summary': title,
            'issuetype': {'id': str(issue_type_id)},
            'description': self.build_adf_description(description),
        }
        if priority_id:
            fields['priority'] = {'id': str(priority_id)}
        if assignee_id:
            fields['assignee'] = {'accountId': str(assignee_id)}
        if due_date:
            fields['duedate'] = due_date

        url = f'https://api.atlassian.com/ex/jira/{site_id}/rest/api/3/issue'
        response = self._request('POST', url, json={'fields': fields})
        created = response.json() or {}
        issue_id_or_key = created.get('key') or created.get('id')
        if not issue_id_or_key:
            raise RuntimeError('Jira create issue response is invalid.')
        return self.get_issue(site_id, issue_id_or_key)

    def get_issue(self, site_id, issue_id_or_key):
        fields = 'summary,issuetype,status,priority,assignee,creator,duedate,description,updated,created'
        url = f'https://api.atlassian.com/ex/jira/{site_id}/rest/api/3/issue/{issue_id_or_key}'
        response = self._request('GET', url, params={'fields': fields})
        return response.json() or {}

    @staticmethod
    def calc_expires_at(expires_in):
        expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
            seconds=max(int(expires_in or 3600) - OAUTH_TOKEN_EXPIRY_BUFFER_SECONDS, 0)
        )
        return expires_at
