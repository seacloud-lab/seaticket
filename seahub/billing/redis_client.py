import redis
from django.conf import settings

_pool = None
_client = None


def get_redis_conn():
    global _pool, _client

    if _client is None:
        _pool = redis.ConnectionPool(
            host=settings.BILLING_REDIS_CONFIG["host"],
            port=settings.BILLING_REDIS_CONFIG["port"],
            db=settings.BILLING_REDIS_CONFIG["db"],
            password=settings.BILLING_REDIS_CONFIG["password"],
            max_connections=50,
            decode_responses=True,
        )
        _client = redis.Redis(connection_pool=_pool)

    return _client
