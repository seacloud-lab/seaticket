import redis
from seahub.billing.settings import BILLING_REDIS_CONFIG

_pool = None
_client = None


def get_redis_conn():
    global _pool, _client

    if _client is None:
        _pool = redis.ConnectionPool(
            host=BILLING_REDIS_CONFIG["host"],
            port=BILLING_REDIS_CONFIG["port"],
            db=BILLING_REDIS_CONFIG["db"],
            password=BILLING_REDIS_CONFIG["password"],
            max_connections=50,
            decode_responses=True,
        )
        _client = redis.Redis(connection_pool=_pool)

    return _client
