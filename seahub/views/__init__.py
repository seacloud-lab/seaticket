# Copyright (c) 2012-2016 Seafile Ltd.
# encoding: utf-8
import hashlib
import mimetypes
import logging
import json

from django.conf import settings as dj_settings
from django.core.cache import cache
from django.http import HttpResponse, Http404, \
    HttpResponseRedirect, HttpResponseServerError
from django.shortcuts import render
from django.views.decorators.http import condition
from django.urls import reverse

from seahub.avatar.util import get_avatar_file_storage
from seahub.auth.decorators import login_required
from seahub.auth import login as auth_login
from seahub.auth import get_backends
from seahub.base.accounts import User
from seahub.profile.models import Profile
import seahub.settings as settings
from seahub.settings import AVATAR_FILE_STORAGE


SEAQA_VERSION = getattr(settings, 'SEAQA_VERSION', 'Dev')
CUSTOM_NAV_ITEMS = getattr(settings, 'CUSTOM_NAV_ITEMS', [])

# Get an instance of a logger
logger = logging.getLogger(__name__)


def is_registered_user(email):
    """
    Check whether user is registered.

    """
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        user = None

    return True if user else False


def i18n(request):
    """
    Set client language preference, lasts for one month

    """
    from django.conf import settings
    next_page = request.META.get('HTTP_REFERER', settings.SITE_ROOT)

    lang = request.GET.get('lang', settings.LANGUAGE_CODE)
    if lang not in [e[0] for e in settings.LANGUAGES]:
        # language code is not supported, use default.
        lang = settings.LANGUAGE_CODE

    # set language code to user profile if user is logged in
    if not request.user.is_anonymous:
        p = Profile.objects.get_profile_by_user(request.user.username)
        if p is not None:
            # update exist record
            p.set_lang_code(lang)
        else:
            # add new record
            Profile.objects.add_or_update(request.user.username, '', '', lang)

    # set language code to client
    res = HttpResponseRedirect(next_page)
    res.set_cookie(settings.LANGUAGE_COOKIE_NAME, lang, max_age=30*24*60*60)
    return res



storage = get_avatar_file_storage()
def latest_entry(request, filename):
    try:
        return storage.modified_time(filename)
    except Exception as e:
        logger.error(e)
        return None

@condition(last_modified_func=latest_entry)
def image_view(request, filename):
    if AVATAR_FILE_STORAGE is None:
        raise Http404

    # read file from cache, if hit
    filename_md5 = hashlib.md5(filename.encode('utf-8')).hexdigest()
    cache_key = 'image_view__%s' % filename_md5
    file_content = cache.get(cache_key)
    if file_content is None:
        import django_oss_storage.backends
        import django_s3_storage.storage
        import oss2.exceptions
        # otherwise, read file from database and update cache
        try:
            image_file = storage.open(filename, 'rb')
        except oss2.exceptions.NoSuchKey:
            raise Http404
        except django_oss_storage.backends.OssError:
            raise Http404
        except django_s3_storage.storage.ClientError:
            raise Http404
        except Exception as e:
            logger.error(e)
            return HttpResponseServerError()
        if not image_file:
            raise Http404
        file_content = image_file.read()
        cache.set(cache_key, file_content, 365 * 24 * 60 * 60)

    # Prepare response
    content_type, content_encoding = mimetypes.guess_type(filename)
    response = HttpResponse(content=file_content, content_type=content_type)
    response['Content-Disposition'] = 'inline; filename=%s' % filename
    if content_encoding:
        response['Content-Encoding'] = content_encoding
    return response

def custom_css_view(request):
    file_content = CUSTOM_CSS
    response = HttpResponse(content=file_content, content_type='text/css')
    return response

@login_required
def seaqa_fake_view(request, **kwargs):
    username = request.user.username
    phone = ''
    profile = None

    if request.user.is_staff:
        return HttpResponseRedirect(reverse('sys_info'))

    if settings.ENABLE_BIND_PHONE:
        try:
            if not profile:
                profile = Profile.objects.filter(user=username).first()
            phone = profile.phone
        except Exception as e:
            logger.error('get user phone failed. {}'.format(e))

    return render(request, 'home.html', {
        'version': SEAQA_VERSION,
        'custom_nav_items': json.dumps(CUSTOM_NAV_ITEMS),
        'has_bound_phone': True if phone else False,
        'disable_adding_personal_projects': True if settings.DISABLE_ADDING_PERSONAL_PROJECTS else False,
    })
