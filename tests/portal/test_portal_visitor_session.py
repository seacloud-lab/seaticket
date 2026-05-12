import time

from django.core.cache import cache
from django.http import HttpResponse

from seahub.portal.visitor_session import (
    VISITOR_SESSION_COOKIE_NAME,
    VISITOR_SESSION_ABSOLUTE_TTL,
    create_visitor_session,
    load_visitor_session,
    touch_visitor_session,
    set_visitor_cookie,
    clear_visitor_cookie,
    ensure_visitor_cookie,
)


class TestCreateVisitorSession:

    def test_creates_session_with_expected_keys(self):
        session_data = create_visitor_session()

        assert 'visitor_uuid' in session_data
        assert 'created_at' in session_data
        assert 'last_seen_at' in session_data
        assert 'last_refreshed_at' in session_data
        assert len(session_data['visitor_uuid']) == 32

    def test_session_persisted_in_cache(self):
        session_data = create_visitor_session()
        from seahub.portal.visitor_session import _get_visitor_session_cache_key

        cached = cache.get(_get_visitor_session_cache_key(session_data['visitor_uuid']))

        assert cached is not None
        assert cached['visitor_uuid'] == session_data['visitor_uuid']


class TestLoadVisitorSession:

    def test_no_cookie_returns_missing(self, factory):
        request = factory.get('/')
        result = load_visitor_session(request)

        assert result['status'] == 'missing'

    def test_invalid_signature_returns_invalid(self, factory):
        request = factory.get('/')
        request.COOKIES[VISITOR_SESSION_COOKIE_NAME] = 'garbage_value'

        result = load_visitor_session(request)

        assert result['status'] == 'invalid'

    def test_expired_session_returns_expired(self, factory):
        session_data = create_visitor_session()
        cache.clear()
        request = factory.get('/')
        signer_cookie = _get_signed_cookie_for(session_data['visitor_uuid'])
        request.COOKIES[VISITOR_SESSION_COOKIE_NAME] = signer_cookie

        result = load_visitor_session(request)

        assert result['status'] == 'expired'

    def test_active_session_returns_active(self, factory):
        session_data = create_visitor_session()
        request = factory.get('/')
        signer_cookie = _get_signed_cookie_for(session_data['visitor_uuid'])
        request.COOKIES[VISITOR_SESSION_COOKIE_NAME] = signer_cookie

        result = load_visitor_session(request)

        assert result['status'] == 'active'
        assert result['visitor_uuid'] == session_data['visitor_uuid']
        assert 'session_data' in result

    def test_should_refresh_cookie_initially_false(self, factory):
        session_data = create_visitor_session()
        request = factory.get('/')
        signer_cookie = _get_signed_cookie_for(session_data['visitor_uuid'])
        request.COOKIES[VISITOR_SESSION_COOKIE_NAME] = signer_cookie

        result = load_visitor_session(request)

        assert result['should_refresh_cookie'] is False


class TestTouchVisitorSession:

    def test_updates_last_seen_at(self):
        session_data = create_visitor_session()
        original_last_seen = session_data['last_seen_at']
        time.sleep(0.01)

        updated = touch_visitor_session(session_data['visitor_uuid'], session_data)

        assert updated is not None
        assert updated['last_seen_at'] > original_last_seen

    def test_expired_absolute_ttl_returns_none(self):
        past_time = time.time() - VISITOR_SESSION_ABSOLUTE_TTL - 60
        expired_session = {
            'visitor_uuid': 'test123',
            'created_at': past_time,
            'last_seen_at': past_time,
            'last_refreshed_at': past_time,
        }

        result = touch_visitor_session('test123', expired_session)

        assert result is None

    def test_invalid_session_data_returns_none(self):
        result = touch_visitor_session('x', {})

        assert result is None

    def test_refresh_cookie_updates_last_refreshed_at(self):
        session_data = create_visitor_session()
        original_refreshed = session_data['last_refreshed_at']
        time.sleep(0.01)

        updated = touch_visitor_session(
            session_data['visitor_uuid'], session_data, refresh_cookie=True
        )

        assert updated is not None
        assert updated['last_refreshed_at'] > original_refreshed


class TestCookieOperations:

    def test_set_visitor_cookie(self):
        response = HttpResponse()

        result = set_visitor_cookie(response, 'abc123')

        assert result is response
        assert VISITOR_SESSION_COOKIE_NAME in response.cookies

    def test_clear_visitor_cookie(self):
        response = HttpResponse()
        set_visitor_cookie(response, 'abc123')

        result = clear_visitor_cookie(response)

        assert result is response
        cookie = str(response.cookies[VISITOR_SESSION_COOKIE_NAME])
        assert 'Max-Age=0' in cookie

    def test_ensure_visitor_cookie_creates_new_for_missing_session(self, factory):
        request = factory.get('/')
        response = HttpResponse()

        result = ensure_visitor_cookie(request, response)

        assert VISITOR_SESSION_COOKIE_NAME in result.cookies

    def test_ensure_visitor_cookie_refreshes_existing(self, factory):
        session_data = create_visitor_session()
        request = factory.get('/')
        signer_cookie = _get_signed_cookie_for(session_data['visitor_uuid'])
        request.COOKIES[VISITOR_SESSION_COOKIE_NAME] = signer_cookie
        response = HttpResponse()

        result = ensure_visitor_cookie(request, response)

        assert VISITOR_SESSION_COOKIE_NAME in result.cookies
        cached = cache.get(
            'portal_visitor_session_' +
            session_data['visitor_uuid'].replace('-', '')
        )
        assert cached is not None


def _get_signed_cookie_for(visitor_uuid):
    from seahub.portal.visitor_session import _sign_visitor_uuid
    return _sign_visitor_uuid(visitor_uuid)
