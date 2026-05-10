import time
import uuid

from django.core.cache import cache
from django.core.signing import BadSignature, Signer

from seahub import settings
from seahub.utils import normalize_cache_key


VISITOR_SESSION_COOKIE_NAME = 'portal_visitor_session'
VISITOR_SESSION_IDLE_TTL = 7 * 24 * 60 * 60
VISITOR_SESSION_ABSOLUTE_TTL = 30 * 24 * 60 * 60
VISITOR_SESSION_REFRESH_INTERVAL = 12 * 60 * 60
VISITOR_SESSION_CACHE_PREFIX = 'portal_visitor_session_'


def _get_cookie_kwargs():
    return {
        'max_age': VISITOR_SESSION_IDLE_TTL,
        'httponly': True,
        'secure': getattr(settings, 'SESSION_COOKIE_SECURE', False) or None,
        'path': '/',
    }


def _get_visitor_session_cache_key(visitor_id):
    return normalize_cache_key(visitor_id, prefix=VISITOR_SESSION_CACHE_PREFIX)


def _sign_visitor_id(visitor_id):
    signer = Signer()
    return signer.sign(visitor_id)


def _unsign_visitor_id(cookie_value):
    if not cookie_value:
        return '', 'missing'

    try:
        signer = Signer()
        return signer.unsign(cookie_value), None
    except BadSignature:
        return '', 'invalid'


def _get_cache_timeout(created_at, now=None):
    now = now or time.time()
    remaining_absolute_ttl = int(VISITOR_SESSION_ABSOLUTE_TTL - (now - created_at))
    if remaining_absolute_ttl <= 0:
        return 0
    return min(VISITOR_SESSION_IDLE_TTL, remaining_absolute_ttl)


def _build_visitor_session(visitor_id, now=None):
    now = now or time.time()
    return {
        'visitor_id': visitor_id,
        'created_at': now,
        'last_seen_at': now,
        'last_refreshed_at': now,
    }


def create_visitor_session():
    now = time.time()
    visitor_id = uuid.uuid4().hex
    session_data = _build_visitor_session(visitor_id, now)
    cache.set(
        _get_visitor_session_cache_key(visitor_id),
        session_data,
        _get_cache_timeout(now, now),
    )
    return session_data


def load_visitor_session(request):
    cookie_value = request.COOKIES.get(VISITOR_SESSION_COOKIE_NAME)
    visitor_id, error = _unsign_visitor_id(cookie_value)
    if error:
        return {'status': error}

    session_data = cache.get(_get_visitor_session_cache_key(visitor_id))
    if not session_data:
        return {'status': 'expired', 'visitor_id': visitor_id}

    try:
        created_at = float(session_data['created_at'])
        last_seen_at = float(session_data['last_seen_at'])
        last_refreshed_at = float(session_data.get('last_refreshed_at', created_at))
    except (KeyError, TypeError, ValueError):
        cache.delete(_get_visitor_session_cache_key(visitor_id))
        return {'status': 'invalid', 'visitor_id': visitor_id}

    now = time.time()
    if now - created_at >= VISITOR_SESSION_ABSOLUTE_TTL or now - last_seen_at >= VISITOR_SESSION_IDLE_TTL:
        cache.delete(_get_visitor_session_cache_key(visitor_id))
        return {'status': 'expired', 'visitor_id': visitor_id}

    return {
        'status': 'active',
        'visitor_id': visitor_id,
        'session_data': session_data,
        'should_refresh_cookie': now - last_refreshed_at >= VISITOR_SESSION_REFRESH_INTERVAL,
    }


def touch_visitor_session(visitor_id, session_data, refresh_cookie=False):
    now = time.time()
    try:
        created_at = float(session_data['created_at'])
    except (KeyError, TypeError, ValueError):
        cache.delete(_get_visitor_session_cache_key(visitor_id))
        return None

    timeout = _get_cache_timeout(created_at, now)
    if timeout <= 0:
        cache.delete(_get_visitor_session_cache_key(visitor_id))
        return None

    updated_session = {
        **session_data,
        'visitor_id': visitor_id,
        'last_seen_at': now,
    }
    if refresh_cookie:
        updated_session['last_refreshed_at'] = now
    elif 'last_refreshed_at' not in updated_session:
        updated_session['last_refreshed_at'] = created_at

    cache.set(_get_visitor_session_cache_key(visitor_id), updated_session, timeout)
    return updated_session


def set_visitor_cookie(response, visitor_id):
    response.set_cookie(
        VISITOR_SESSION_COOKIE_NAME,
        _sign_visitor_id(visitor_id),
        **_get_cookie_kwargs(),
    )
    return response


def clear_visitor_cookie(response):
    response.delete_cookie(VISITOR_SESSION_COOKIE_NAME, path='/')
    return response


def ensure_visitor_cookie(request, response):
    visitor_session = load_visitor_session(request)
    if visitor_session.get('status') == 'active':
        session_data = touch_visitor_session(
            visitor_session['visitor_id'],
            visitor_session['session_data'],
            refresh_cookie=True,
        )
        if not session_data:
            session_data = create_visitor_session()
    else:
        session_data = create_visitor_session()
    return set_visitor_cookie(response, session_data['visitor_id'])
