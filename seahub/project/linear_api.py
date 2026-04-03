import datetime
import logging

import requests
from django.utils import timezone

from seahub.settings import LINEAR_CLIENT_ID, LINEAR_CLIENT_SECRET

logger = logging.getLogger(__name__)


class LinearAPI:
    def __init__(self, access_token):
        self.access_token = access_token
        self.token_url = "https://api.linear.app/oauth/token"

    def list_teams(self):
        query = {
            'query': 'query { teams { nodes { id name key } } viewer { organization { name } } }'
        }
        try:
            resp = requests.post(
                'https://api.linear.app/graphql',
                json=query,
                headers={'Authorization': f'Bearer {self.access_token}'},
                timeout=10,
            )
        except Exception as e:
            logger.error('Linear teams request error: %s', e)
            return None, None, 'request_failed'

        if resp.status_code != 200:
            logger.error('Linear teams request failed: %s %s', resp.status_code, resp.text)
            return None, None, 'request_invalid'

        payload = resp.json() or {}
        data = payload.get('data') or {}
        teams = data.get('teams', {}).get('nodes', []) or []
        viewer = data.get('viewer') or {}
        org = viewer.get('organization') or {}
        workspace_name = org.get('name')
        return teams, workspace_name, None


    def refresh_oauth_token(self, linear_oauth):
        if not linear_oauth or not linear_oauth.refresh_token:
            return None, 'refresh_token_missing'
        if not LINEAR_CLIENT_ID or not LINEAR_CLIENT_SECRET:
            return None, 'client_config_missing'

        payload = {
            'grant_type': 'refresh_token',
            'refresh_token': linear_oauth.refresh_token,
            'client_id': LINEAR_CLIENT_ID,
            'client_secret': LINEAR_CLIENT_SECRET,
        }

        try:
            resp = requests.post(
                self.token_url,
                data=payload,
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                timeout=10,
            )
        except Exception as e:
            logger.error('Linear OAuth refresh request error: %s', e)
            return None, 'refresh_request_failed'

        if resp.status_code != 200:
            logger.error('Linear OAuth refresh response invalid: %s %s', resp.status_code, resp.text)
            return None, 'refresh_response_invalid'

        token_json = resp.json()
        access_token = token_json.get('access_token')
        refresh_token = token_json.get('refresh_token') or linear_oauth.refresh_token
        expires_in = token_json.get('expires_in')
        if not access_token:
            logger.error('Linear OAuth refresh missing access_token: %s', token_json)
            return None, 'refresh_missing_access_token'

        if expires_in:
            expires_in = timezone.now() + datetime.timedelta(seconds=int(expires_in))
        else:
            expires_in = timezone.now() + datetime.timedelta(days=3650)

        linear_oauth.access_token = access_token
        linear_oauth.refresh_token = refresh_token
        linear_oauth.expires_in = expires_in
        linear_oauth.save(update_fields=['access_token', 'refresh_token', 'expires_in'])

        return linear_oauth, None
