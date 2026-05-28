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
        timeout: int = 60
    ):
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.client_id = LINEAR_CLIENT_ID
        self.client_secret = LINEAR_CLIENT_SECRET
        self.api_url = "https://api.linear.app/graphql"
        self.token_url = "https://api.linear.app/oauth/token"
        self.timeout = timeout

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
        refresh_token = data.get("refresh_token")

        return {'access_token': access_token, 'refresh_token': refresh_token, 'expires_at': expires_at}

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

    @staticmethod
    def calc_expires_in(expires_in):
        """Calculate absolute expiry datetime from expires_in seconds.
        Returns an aware datetime or None."""
        expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
            seconds=int(expires_in)
        )
        return expires_at
