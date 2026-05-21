import datetime
import logging

import requests

from seahub.settings import LINEAR_CLIENT_ID, LINEAR_CLIENT_SECRET

logger = logging.getLogger(__name__)


class LinearAPIException(Exception):
    pass


class LinearAPIAuthException(LinearAPIException):
    pass


class LinearAPI:
    def __init__(
        self,
        access_token: str,
        refresh_token: str = "",
        expires_at=None,
        timeout: int = 60,
    ):
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.expires_at = expires_at
        self.client_id = LINEAR_CLIENT_ID
        self.client_secret = LINEAR_CLIENT_SECRET
        self.api_url = "https://api.linear.app/graphql"
        self.token_url = "https://api.linear.app/oauth/token"
        self.timeout = timeout
        self._last_token_update = None

    @property
    def last_token_update(self):
        return self._last_token_update

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
        access_token = data.get("access_token")

        self.access_token = access_token
        self.refresh_token = data.get("refresh_token")

        self._last_token_update = data
        return data

    def _is_expired(self):
        """Check if the token is expired."""
        now = datetime.datetime.now(datetime.timezone.utc)
        return now >= self.expires_at

    def list_teams(self):
        """List Linear teams for the authenticated user.
        Returns (teams, workspace_name).
        Raises LinearAPIException or LinearAPIAuthException on failure."""
        if self._is_expired():
            self.refresh_access_token()

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
        if not expires_in:
            return None
        expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
            seconds=int(expires_in)
        )
        return expires_at.replace(microsecond=0)
