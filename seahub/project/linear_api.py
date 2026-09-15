import datetime
import logging

import requests

from seahub.settings import LINEAR_CLIENT_ID, LINEAR_CLIENT_SECRET

logger = logging.getLogger(__name__)


class LinearAPI:
    def __init__(
        self,
        access_token,
        refresh_token,
        timeout: int = 60,
        on_token_refreshed=None
    ):
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.expires_at = None
        self.client_id = LINEAR_CLIENT_ID
        self.client_secret = LINEAR_CLIENT_SECRET
        self.api_url = "https://api.linear.app/graphql"
        self.token_url = "https://api.linear.app/oauth/token"
        self.timeout = timeout
        # Called with the new token right after a refresh, so a rotated refresh
        # token survives a failure of the request that triggered the refresh.
        self.on_token_refreshed = on_token_refreshed

    def _headers(self):
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

    def refresh_access_token(self):
        payload = {
            "grant_type": "refresh_token",
            "refresh_token": self.refresh_token,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        }
        response = requests.post(
            self.token_url,
            data=payload,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=self.timeout,
        )
        response.raise_for_status()
        data = response.json() or {}

        expires_at = self.calc_expires_in(data.get("expires_in"))
        access_token = data.get("access_token")
        refresh_token = data.get("refresh_token") or self.refresh_token
        if not access_token:
            raise RuntimeError('Linear OAuth refresh response is invalid.')
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.expires_at = expires_at

        token = {'access_token': access_token, 'refresh_token': refresh_token, 'expires_at': expires_at}
        if self.on_token_refreshed:
            try:
                self.on_token_refreshed(token)
            except Exception as e:
                logger.error('Failed to store the refreshed Linear token: %s', e)
        return token

    def _post_graphql(self, query, variables=None):
        payload = {'query': query, 'variables': variables or {}}
        response = requests.post(
            self.api_url,
            json=payload,
            headers=self._headers(),
            timeout=self.timeout,
        )
        if response.status_code == 401:
            self.refresh_access_token()
            response = requests.post(
                self.api_url,
                json=payload,
                headers=self._headers(),
                timeout=self.timeout,
            )
        response.raise_for_status()
        result = response.json() or {}
        errors = result.get('errors') or []
        if errors:
            message = errors[0].get('message') if isinstance(errors[0], dict) else str(errors[0])
            raise RuntimeError(message or 'Linear API request failed.')
        return result.get('data') or {}

    def list_teams(self):
        """List Linear teams for the authenticated user.
        Returns (teams, workspace_name)."""

        query = """
        query Teams {
          teams {
            nodes {
              id
              name
              key
            }
          }
          viewer {
            organization {
              name
            }
          }
        }
        """
        payload = {"query": query}
        response = requests.post(
            self.api_url,
            json=payload,
            headers=self._headers(),
            timeout=self.timeout,
        )
        response.raise_for_status()
        data = response.json() or {}
        result = data.get("data") or {}
        teams = result.get("teams", {}).get("nodes", []) or []
        viewer = result.get("viewer") or {}
        org = viewer.get("organization") or {}
        workspace_name = org.get("name")
        return teams, workspace_name

    def list_users(self, team_id):
        query = """
        query TeamMembers($teamId: String!) {
          team(id: $teamId) {
            members {
              nodes { id name email avatarUrl }
            }
          }
        }
        """
        data = self._post_graphql(query, {'teamId': team_id})
        return ((data.get('team') or {}).get('members') or {}).get('nodes', []) or []

    def create_issue(
        self, team_id, title, description, state_id=None, priority=None,
        assignee_id=None, label_ids=None, due_date=None,
    ):
        query = """
        mutation IssueCreate($input: IssueCreateInput!) {
          issueCreate(input: $input) {
            success
            issue {
              id identifier title description
              state { name }
              creator { name }
              assignee { name }
              labels { nodes { name color } }
              priority dueDate createdAt updatedAt completedAt archivedAt
            }
          }
        }
        """
        issue_input = {
            'teamId': team_id,
            'title': title,
            'description': description or '',
        }
        if state_id:
            issue_input['stateId'] = state_id
        if priority is not None:
            issue_input['priority'] = priority
        if assignee_id:
            issue_input['assigneeId'] = assignee_id
        if label_ids:
            issue_input['labelIds'] = label_ids
        if due_date:
            issue_input['dueDate'] = due_date

        data = self._post_graphql(query, {'input': issue_input})
        result = data.get('issueCreate') or {}
        issue = result.get('issue') or {}
        if not result.get('success') or not issue.get('id'):
            raise RuntimeError('Linear create issue response is invalid.')
        return issue

    @staticmethod
    def calc_expires_in(expires_in):
        """Calculate absolute expiry datetime from expires_in seconds.
        Returns an aware datetime or None."""
        expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
            seconds=int(expires_in)
        )
        return expires_at
