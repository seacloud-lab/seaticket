import requests
import time
import jwt

from seahub.settings import GITHUB_APP_ID, GITHUB_PRIVATE_KEY


class GitHubAPIException(Exception):
    pass


class GitHubAppNotInstalled(Exception):
    pass


class GitHubRepoNotFound(Exception):
    pass


class GitHubAPI:
    def __init__(self, installation_id, timeout=60):
        self.installation_id = installation_id
        self.app_id = str(GITHUB_APP_ID)
        self.app_private_key = GITHUB_PRIVATE_KEY
        self.timeout = timeout
        self.base_url = "https://api.github.com"
        self.headers = self._gen_headers()

    def generate_github_app_jwt(self):
        now = int(time.time())
        payload = {
            "iat": now,
            "exp": now + (5 * 60),
            "iss": self.app_id
        }
        encoded_jwt = jwt.encode(payload, self.app_private_key, algorithm="RS256")
        return encoded_jwt

    def get_installation_access_token(self, installation_id):
        jwt_token = self.generate_github_app_jwt()

        headers = {
            "Authorization": f"Bearer {jwt_token}",
            "Accept": "application/vnd.github.v3+json"
        }

        url = f"https://api.github.com/app/installations/{installation_id}/access_tokens"

        try:
            response = requests.post(url, headers=headers)
        except requests.exceptions.RequestException as e:
            raise GitHubAPIException(f'Failed to obtain installation token: {response.status_code}: {response.text}')
        except Exception as e:
            raise GitHubAPIException(f'An exception occurred while obtaining the installation token.: {e}')
        if response.status_code == 404:
            raise GitHubAppNotInstalled('App is deleted or installation_id is incorrect.')
        response.raise_for_status()
        access_token_data = response.json()
        return access_token_data["token"]

    def _gen_headers(self):
        access_token = self.get_installation_access_token(self.installation_id)
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github.v3+json"
        }
        return headers

    def _request(self, url, params=None):
        response = requests.get(url, headers=self.headers, params=params, timeout=self.timeout)
        if response.status_code == 404:
            raise GitHubRepoNotFound(f'Not found: {url}')
        elif response.status_code >= 400:
            raise GitHubAPIException(f'GitHub API error {response.status_code}: {response.text}')
        return response.json()

    def _request_patch(self, url, payload=None):
        response = requests.patch(url, headers=self.headers, json=payload, timeout=self.timeout)
        if response.status_code == 404:
            raise GitHubRepoNotFound(f'Not found: {url}')
        elif response.status_code >= 400:
            raise GitHubAPIException(f'GitHub API error {response.status_code}: {response.text}')
        return response.json()

    def get_installation_repositories(self, per_page=30, page=1):
        if not (1 <= per_page <= 100):
            raise ValueError("The value of per_page must be less than 100")

        url = f"{self.base_url}/installation/repositories"
        repositories = []
        while True:
            params = {
                'per_page': per_page,
                'page': page
            }

            resp = self._request(url, params=params)
            page_repositories = resp.get('repositories', [])
            if len(page_repositories) <= 0:
                break
            repositories.extend(page_repositories)

            page += 1
        return repositories

    def update_issue(self, owner, repo, issue_number, title=None, labels=None, content=None, issue_type=None, state=None, state_reason=None):
        url = f"{self.base_url}/repos/{owner}/{repo}/issues/{issue_number}"
        payload = {}
        if title is not None:
            payload['title'] = title
        if labels is not None:
            payload['labels'] = labels
        if issue_type is not None:
            if issue_type:
                payload['type'] = issue_type
            else:
                payload['type'] = None
        if state is not None:
            payload['state'] = state
        if state_reason is not None:
            payload['state_reason'] = state_reason
        if not payload:
            return {}

        issue_data = self._request_patch(url, payload=payload)
        return {
            'title': issue_data.get('title', ''),
            'labels': [item.get('name') for item in issue_data.get('labels', [])],
            'issue_type': (issue_data.get('type') or {}).get('name', ''),
            'state': issue_data.get('state', ''),
            'state_reason': issue_data.get('state_reason', ''),
            'updated_time': issue_data.get('updated_at', ''),
        }
