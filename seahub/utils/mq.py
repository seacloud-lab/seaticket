# -*- coding: utf-8 -*-
import redis
import logging

from urllib.parse import urlparse
from django.conf import settings


logger = logging.getLogger(__name__)


def get_mq():
    try:
        cache_location = settings.CACHES['default'].get('LOCATION', '')

        if not cache_location.startswith('redis://'):
              logger.warning('Redis cache is not configured')
              return None

        parsed = urlparse(cache_location)
        host = parsed.hostname or '127.0.0.1'
        port = parsed.port or 6379
        password = parsed.password

        if not (host and port):
            logger.warning('Redis has not been set up correctly')
            return None

        rdp = redis.ConnectionPool(
            host=host,
            port=int(port),
            password=password if password else None,
            retry_on_timeout=True,
            decode_responses=True
        )

        mq = redis.StrictRedis(connection_pool=rdp)

        try:
            mq.ping()
        except Exception as e:
            logger.error("Redis server can't be connected: host %s, port %s, error %s",
                         host, port, e)
        return mq

    except Exception as e:
        logger.error('Failed to create Redis MQ client: %s', e)
        return None
