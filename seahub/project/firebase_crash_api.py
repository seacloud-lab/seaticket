# -*- coding: utf-8 -*-
import datetime
import logging
import re

import requests

from seahub.settings import FIREBASE_CRASH_CLIENT_ID, FIREBASE_CRASH_CLIENT_SECRET


logger = logging.getLogger(__name__)

GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
FIREBASE_PROJECTS_URL = 'https://firebase.googleapis.com/v1beta1/projects'
OAUTH_TOKEN_EXPIRY_BUFFER_SECONDS = 60
PROJECT_ID_PATTERN = re.compile(r'^[a-z][a-z0-9-]{4,28}[a-z0-9]$')
FIREBASE_ANDROID_APPS_URL = 'https://firebase.googleapis.com/v1beta1/projects/{project_id}/androidApps'
FIREBASE_IOS_APPS_URL = 'https://firebase.googleapis.com/v1beta1/projects/{project_id}/iosApps'


class FirebaseCrashOAuthError(Exception):
    pass


class FirebaseCrashOAuthAPI:
    """List and validate Firebase Crashlytics BigQuery resources through Google OAuth."""

    def __init__(self, access_token, refresh_token, expires_at=None, timeout=30):
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.expires_at = expires_at
        self.timeout = timeout
        self.tokens_updated = False

    def _headers(self):
        return {
            'Authorization': f'Bearer {self.access_token}',
            'Accept': 'application/json',
        }

    @staticmethod
    def _validate_resource_ids(project_id):
        if not isinstance(project_id, str) or not PROJECT_ID_PATTERN.fullmatch(project_id):
            raise FirebaseCrashOAuthError('The Firebase project ID is invalid.')

    def _refresh_access_token(self):
        if not all([FIREBASE_CRASH_CLIENT_ID, FIREBASE_CRASH_CLIENT_SECRET, self.refresh_token]):
            raise FirebaseCrashOAuthError('Google authorization is invalid. Please reconnect Google.')

        try:
            response = requests.post(
                GOOGLE_TOKEN_URL,
                data={
                    'grant_type': 'refresh_token',
                    'client_id': FIREBASE_CRASH_CLIENT_ID,
                    'client_secret': FIREBASE_CRASH_CLIENT_SECRET,
                    'refresh_token': self.refresh_token,
                },
                timeout=self.timeout,
            )
        except requests.RequestException as e:
            logger.error('Firebase Crashlytics OAuth refresh request failed: %s', e)
            raise FirebaseCrashOAuthError('Failed to refresh Google authorization.') from e
        if response.status_code in (400, 401):
            raise FirebaseCrashOAuthError('Google authorization expired. Please reconnect Google.')
        if response.status_code != 200:
            logger.error('Firebase Crashlytics OAuth refresh failed: status=%s', response.status_code)
            raise FirebaseCrashOAuthError('Failed to refresh Google authorization.')

        try:
            token_data = response.json()
        except (TypeError, ValueError) as exc:
            raise FirebaseCrashOAuthError(
                'Failed to refresh Google authorization.'
            ) from exc
        if not isinstance(token_data, dict):
            raise FirebaseCrashOAuthError(
                'Failed to refresh Google authorization.'
            )
        access_token = token_data.get('access_token')
        if not access_token:
            raise FirebaseCrashOAuthError('Failed to refresh Google authorization.')

        try:
            expires_in = int(token_data.get('expires_in') or 3600)
        except (TypeError, ValueError):
            expires_in = 3600

        self.access_token = access_token
        self.refresh_token = token_data.get('refresh_token') or self.refresh_token
        self.expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
            seconds=max(expires_in - OAUTH_TOKEN_EXPIRY_BUFFER_SECONDS, 0)
        )
        self.tokens_updated = True

    def _get(self, url, params=None):
        try:
            response = requests.get(url, headers=self._headers(), params=params, timeout=self.timeout)
        except requests.RequestException as e:
            logger.error('Firebase Crashlytics API request failed: %s', e)
            raise FirebaseCrashOAuthError('Failed to load Firebase Crashlytics resources.') from e
        if response.status_code == 401:
            self._refresh_access_token()
            try:
                response = requests.get(url, headers=self._headers(), params=params, timeout=self.timeout)
            except requests.RequestException as e:
                logger.error('Firebase Crashlytics API retry failed: %s', e)
                raise FirebaseCrashOAuthError('Failed to load Firebase Crashlytics resources.') from e

        if response.status_code == 401:
            raise FirebaseCrashOAuthError('Google authorization expired. Please reconnect Google.')
        if response.status_code == 403:
            raise FirebaseCrashOAuthError('The Google account does not have permission to access this resource.')
        if response.status_code == 404:
            raise FirebaseCrashOAuthError('The selected Firebase project or BigQuery dataset was not found.')
        if response.status_code != 200:
            logger.error('Firebase Crashlytics API request failed: status=%s', response.status_code)
            raise FirebaseCrashOAuthError('Failed to load Firebase Crashlytics resources.')
        try:
            data = response.json()
        except (TypeError, ValueError) as exc:
            raise FirebaseCrashOAuthError(
                'Firebase Crashlytics API returned an invalid JSON response.'
            ) from exc
        if not isinstance(data, dict):
            raise FirebaseCrashOAuthError(
                'Firebase Crashlytics API response must be a JSON object.'
            )
        return data

    def list_projects(self):
        projects = []
        page_token = None
        visited_page_tokens = set()
        while True:
            if page_token:
                if page_token in visited_page_tokens:
                    raise FirebaseCrashOAuthError(
                        'Firebase project API returned a repeated page token.'
                    )
                visited_page_tokens.add(page_token)
            params = {'pageSize': 1000}
            if page_token:
                params['pageToken'] = page_token
            data = self._get(FIREBASE_PROJECTS_URL, params=params)
            projects.extend(data.get('results') or [])
            page_token = data.get('nextPageToken')
            if not page_token:
                break

        return sorted(
            [
                {
                    'project_id': project.get('projectId'),
                    'name': project.get('displayName') or project.get('projectId'),
                }
                for project in projects
                if project.get('projectId')
            ],
            key=lambda project: (project['name'].lower(), project['project_id']),
        )

    def list_apps(self, project_id):
        self._validate_resource_ids(project_id)
        apps = []
        for platform, url, identifier_key in (
            ('ANDROID', FIREBASE_ANDROID_APPS_URL, 'packageName'),
            ('IOS', FIREBASE_IOS_APPS_URL, 'bundleId'),
        ):
            page_token = None
            visited_page_tokens = set()
            while True:
                if page_token:
                    if page_token in visited_page_tokens:
                        raise FirebaseCrashOAuthError(
                            'Firebase application API returned a repeated page token.'
                        )
                    visited_page_tokens.add(page_token)
                params = {'pageSize': 1000}
                if page_token:
                    params['pageToken'] = page_token
                data = self._get(url.format(project_id=project_id), params=params)
                for app in data.get('apps') or []:
                    app_id = app.get('appId')
                    if not app_id:
                        continue
                    identifier = app.get(identifier_key)
                    apps.append({
                        'app_id': app_id,
                        'name': app.get('displayName') or identifier or app_id,
                        'platform': platform,
                        'identifier': identifier,
                    })
                page_token = data.get('nextPageToken')
                if not page_token:
                    break

        return sorted(
            apps,
            key=lambda app: (app['name'].lower(), app['platform'], app['app_id']),
        )
