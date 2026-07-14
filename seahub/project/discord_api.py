# -*- coding: utf-8 -*-
import logging
import requests

from seahub import settings


logger = logging.getLogger(__name__)

DISCORD_API_BASE_URL = 'https://discord.com/api/v10'


class DiscordAPI(object):
    """Minimal Discord API client for the web tier.

    Used to list guild channels for the connection creation dialog.
    """

    def __init__(self, bot_token):
        self.bot_token = bot_token
        self.headers = {
            'Authorization': f'Bot {bot_token}',
            'Content-Type': 'application/json',
        }

    def list_guild_channels(self, guild_id):
        """List forum channels (type 15) in a guild.

        Returns:
            list[dict]: Channels with keys 'id' (str) and 'name' (str).
        """
        url = f'{DISCORD_API_BASE_URL}/guilds/{guild_id}/channels'
        try:
            resp = requests.get(url, headers=self.headers, timeout=15)
            resp.raise_for_status()
            channels = resp.json()
            # Only forum channels (type 15) are supported
            forum_channels = [
                {'id': str(ch['id']), 'name': ch['name']}
                for ch in channels
                if ch.get('type') == 15
            ]
            # Sort alphabetically by name
            forum_channels.sort(key=lambda c: c['name'].lower())
            return forum_channels
        except requests.exceptions.RequestException as e:
            logger.error(f'Failed to list Discord guild channels for guild {guild_id}: {e}')
            raise
