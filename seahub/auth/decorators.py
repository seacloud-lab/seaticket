# Copyright (c) 2012-2016 Seafile Ltd.
try:
    from functools import update_wrapper, wraps
except ImportError:
    from django.utils.functional import update_wrapper, wraps  # Python 2.4 fallback.
import logging
from seahub.auth import REDIRECT_FIELD_NAME
from django.conf import settings
from django.http import HttpResponseRedirect, HttpResponse, Http404
from urllib.parse import quote
import functools
import json
import jwt
from django.utils.translation import gettext as _
from django.utils.encoding import iri_to_uri

from seahub.api2.models import Token
from seahub.auth.models import AnonymousUser
from seahub.base.accounts import User
from seahub.base.accounts import AuthBackend
from seahub.utils import uuid_str_to_36_chars
from seahub.utils.auth import AUTHORIZATION_PREFIX

logger = logging.getLogger(__name__)

def user_passes_test(test_func, login_url=None, redirect_field_name=REDIRECT_FIELD_NAME):
    """
    Decorator for views that checks that the user passes the given test,
    redirecting to the log-in page if necessary. The test should be a callable
    that takes the user object and returns True if the user passes.
    """
    if not login_url:
        from django.conf import settings
        login_url = settings.LOGIN_URL

    def decorator(view_func):
        def _wrapped_view(request, *args, **kwargs):
            if test_func(request.user):
                return view_func(request, *args, **kwargs)
            path = quote(request.path)
            query_string = iri_to_uri(request.META.get('QUERY_STRING', ''))
            if query_string:
                tup = login_url, redirect_field_name, path, query_string
                return HttpResponseRedirect('%s?%s=%s&%s' % tup)
            tup = login_url, redirect_field_name, path
            return HttpResponseRedirect('%s?%s=%s' % tup)
        return wraps(view_func)(_wrapped_view)
    return decorator


def bind_token_user(function):
    def get_token_user(request):
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        if not auth or auth[0].lower() not in AUTHORIZATION_PREFIX:
            return None
        if len(auth) != 2:
            return None
        user_token = auth[1]
        try:
            token = Token.objects.filter(key=user_token).first()
        except Exception as e:
            logger.error('db query token error: %s', e)
            return None
        if not token:
            return None
        try:
            user = User.objects.get(email=token.user)
        except User.DoesNotExist:
            return None
        return user

    @functools.wraps(function)
    def wrapper(request, *args, **kwargs):
        if request.user and not isinstance(request.user, AnonymousUser):
            return function(request, *args, **kwargs)
        token_user = get_token_user(request)
        if token_user:
            token_user.backend = AuthBackend.__module__ + ".AuthBackend"
            request.user = token_user
        return function(request, *args, **kwargs)

    return wrapper


def bind_cookie_user(function):
    def get_access_token_user(request, dtable_uuid):
        access_token = request.COOKIES.get('access-token')
        try:
            payload = jwt.decode(access_token, settings.DTABLE_PRIVATE_KEY, algorithms=['HS256'])
        except:
            return None
        if not payload.get('is_internal'):
            return None
        payload_username = payload.get('username')
        payload_dtable_uuid = payload.get('dtable_uuid')
        if uuid_str_to_36_chars(payload_dtable_uuid) != uuid_str_to_36_chars(dtable_uuid):
            return None
        user = User(payload_username)
        user.is_from_cookie = True
        return user

    @functools.wraps(function)
    def wrapper(request, *args, **kwargs):
        if request.user and not isinstance(request.user, AnonymousUser):
            return function(request, *args, **kwargs)
        request_dtable_uuid = kwargs.get('dtable_uuid')
        if not request_dtable_uuid:
            return function(request, *args, **kwargs)
        access_token_user = get_access_token_user(request, request_dtable_uuid)
        if access_token_user:
            request.user = access_token_user
        return function(request, *args, **kwargs)

    return wrapper


def login_required(function=None, redirect_field_name=REDIRECT_FIELD_NAME):
    """
    Decorator for views that checks that the user is logged in, redirecting
    to the log-in page if necessary.
    """
    actual_decorator = user_passes_test(
        lambda u: u.is_authenticated,
        redirect_field_name=redirect_field_name
    )
    if function:
        return actual_decorator(function)
    return actual_decorator


def permission_required(perm, login_url=None):
    """
    Decorator for views that checks whether a user has a particular permission
    enabled, redirecting to the log-in page if necessary.
    """
    return user_passes_test(lambda u: u.has_perm(perm), login_url=login_url)


def login_required_ajax(function=None,redirect_field_name=None):
    """
    Just make sure the user is authenticated to access a certain ajax view

    Otherwise return a HttpResponse 401 - authentication required
    instead of the 302 redirect of the original Django decorator
    """
    def _decorator(view_func):
        def _wrapped_view(request, *args, **kwargs):
            if not request.headers.get('x-requested-with') == 'XMLHttpRequest':
                raise Http404

            if request.user.is_authenticated:
                return view_func(request, *args, **kwargs)
            else:
                content_type = 'application/json; charset=utf-8'
                return HttpResponse(json.dumps({
                    'error': _('Please log in.')
                    }), status=401, content_type=content_type)

        return _wrapped_view

    if function is None:
        return _decorator
    else:
        return _decorator(function)
