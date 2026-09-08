# -*- coding: utf-8 -*-
import logging
import requests

logger = logging.getLogger(__name__)

SLACK_API_BASE_URL = 'https://slack.com/api'


class SlackAPI(object):
    """Minimal Slack Web API client for the web tier.

    Used to list workspace channels for the connection creation dialog.
    """

    def __init__(self, bot_token, timeout=15):
        self.bot_token = bot_token
        self.timeout = timeout
        self.headers = {
            'Authorization': f'Bearer {bot_token}',
            'Content-Type': 'application/json',
        }

    def list_channels(self):
        """List public channels in the workspace (plus private channels the bot belongs to).

        Returns:
            list[dict]: Channels with keys 'id' (str) and 'name' (str).
        """
        url = f'{SLACK_API_BASE_URL}/conversations.list'
        params = {
            'types': 'public_channel,private_channel',
            'exclude_archived': 'true',
            'limit': 1000,
        }
        channels = []
        cursor = None
        while True:
            page_params = dict(params)
            if cursor:
                page_params['cursor'] = cursor
            resp = requests.get(url, headers=self.headers, params=page_params, timeout=self.timeout)
            resp.raise_for_status()
            data = resp.json()
            if not data.get('ok'):
                raise requests.HTTPError(f"Slack error: {data.get('error')}", response=resp)

            channels.extend([
                {
                    'id': str(ch['id']),
                    'name': ch['name'],
                    'is_private': bool(ch.get('is_private')),
                    'is_member': bool(ch.get('is_member')),
                }
                for ch in data.get('channels', [])
                if ch.get('name')
            ])

            next_cursor = (data.get('response_metadata') or {}).get('next_cursor')
            if not next_cursor:
                break
            cursor = next_cursor

        channels.sort(key=lambda c: c['name'].lower())
        return channels

    def get_team_domain(self):
        """Fetch the workspace domain (used to construct permalinks)."""
        url = f'{SLACK_API_BASE_URL}/team.info'
        resp = requests.get(url, headers=self.headers, timeout=self.timeout)
        resp.raise_for_status()
        data = resp.json()
        if not data.get('ok'):
            return ''
        return (data.get('team') or {}).get('domain', '')

    def join_channel(self, channel_id):
        """Join the bot to a public channel via conversations.join.

        Requires the ``channels:join`` scope. Only works for public channels
        (private channels return ``method_not_supported_for_channel_type``).
        Idempotent: ``already_in_channel`` is treated as success.
        """
        url = f'{SLACK_API_BASE_URL}/conversations.join'
        try:
            resp = requests.post(url, headers=self.headers, json={'channel': channel_id}, timeout=self.timeout)
            resp.raise_for_status()
            data = resp.json()
            if not data.get('ok'):
                if data.get('error') == 'already_in_channel':
                    return data
                logger.error('Slack conversations.join failed: %s', data.get('error'))
                raise requests.HTTPError(f"Slack error: {data.get('error')}", response=resp)
            return data
        except requests.exceptions.RequestException as e:
            logger.error('Failed to join Slack channel %s: %s', channel_id, e)
            raise
