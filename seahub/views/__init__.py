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

from seahub.avatar.util import get_avatar_file_storage
from seahub.auth.decorators import login_required
from seahub.auth import login as auth_login
from seahub.auth import get_backends
from seahub.base.accounts import User
from seahub.profile.models import Profile
from seahub.utils.auth import get_login_bg_image_path
import seahub.settings as settings
from seahub.settings import AVATAR_FILE_STORAGE, SHARE_LINK_EXPIRE_DAYS_MIN, \
    SHARE_LINK_EXPIRE_DAYS_MAX, USE_PHONE_REGISTRATION_BY_DEFAULT, \
    SHOW_WECHAT_SUPPORT_GROUP, SEATABLE_MARKET_URL, SHOW_TEMPLATES_LINK, \
    VIDEO_TUTORIALS_LINK, ENABLE_CREATE_BASE_FROM_TEMPLATE, ENABLE_INTRODUCTION_VIDEO, \
    ENABLE_USER_GUIDE, GETTING_START_LINK, USE_CASES_LINK, TRAINING_SERVICES_LINK, \
    INTRODUCTION_VIDEO_LINK, ENABLE_INVITE_A_FRIEND


LIBRARY_TEMPLATES = getattr(settings, 'LIBRARY_TEMPLATES', {})
SEATABLE_VERSION = getattr(settings, 'SEATABLE_VERSION', 'Dev')
CUSTOM_NAV_ITEMS = getattr(settings, 'CUSTOM_NAV_ITEMS', [])

from constance import config

# Get an instance of a logger
logger = logging.getLogger(__name__)


def is_registered_user(email):
    """
    Check whether user is registerd.

    """
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        user = None

    return True if user else False


def gen_path_link(path, repo_name):
    """
    Generate navigate paths and links in repo page.

    """
    if path and path[-1] != '/':
        path += '/'

    paths = []
    links = []
    if path and path != '/':
        paths = path[1:-1].split('/')
        i = 1
        for name in paths:
            link = '/' + '/'.join(paths[:i])
            i = i + 1
            links.append(link)
    if repo_name:
        paths.insert(0, repo_name)
        links.insert(0, '/')

    zipped = list(zip(paths, links))

    return zipped


def demo(request):
    """
    Login as demo account.
    """
    if not dj_settings.ENABLE_DEMO_USER:
        raise Http404

    try:
        user = User.objects.get(email=settings.CLOUD_DEMO_USER)
    except User.DoesNotExist:
        logger.warning('CLOUD_DEMO_USER: %s does not exist.' % settings.CLOUD_DEMO_USER)
        raise Http404

    for backend in get_backends():
        user.backend = "%s.%s" % (backend.__module__, backend.__class__.__name__)

    auth_login(request, user)

    redirect_to = settings.SITE_ROOT
    return HttpResponseRedirect(redirect_to)


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
    file_content = config.CUSTOM_CSS
    response = HttpResponse(content=file_content, content_type='text/css')
    return response


def choose_register(request):
    """
    Choose register
    """
    source = request.GET.get('source', None)
    invitation_token = request.GET.get('invitation_token', None)

    login_bg_image_path = get_login_bg_image_path()
    response = render(request, 'choose_register.html', {
        'login_bg_image_path': login_bg_image_path,
        'use_phone_registration_by_default': USE_PHONE_REGISTRATION_BY_DEFAULT,
    })

    if source:
        response.set_cookie('REGISTRATION_SOURCE', source)
    if invitation_token:
        response.set_cookie('INVITATION_TOKEN', invitation_token)

    return response


@login_required
def seaqa_fake_view(request, **kwargs):
    username = request.user.username

    cache_key = username + '_need_show_video'
    need_show_video = cache.get(cache_key)
    phone = ''
    profile = None
    if need_show_video is None:
        try:
            profile = Profile.objects.filter(user=username).first()
            need_show_video = profile.need_show_video
            if need_show_video:
                Profile.objects.add_or_update(username, need_show_video=False)
        except Exception as e:
            logger.error('check need show video failed. {}'.format(e))
            need_show_video = False
        cache.set(cache_key, False, timeout=None)

    if settings.ENABLE_BIND_PHONE and settings.CAN_REMOVE_BASE_PASSWORD_VIA_PHONE:
        try:
            if not profile:
                profile = Profile.objects.filter(user=username).first()
            phone = profile.phone
        except Exception as e:
            logger.error('get user phone failed. {}'.format(e))

    return render(request, 'react_project.html', {
        'version': SEATABLE_VERSION,
        'show_wechat_support_group': SHOW_WECHAT_SUPPORT_GROUP,
        'show_templates_link': SHOW_TEMPLATES_LINK,
        'seatable_market_url': SEATABLE_MARKET_URL,
        'share_link_expire_days_default': settings.SHARE_LINK_EXPIRE_DAYS_DEFAULT,
        'share_link_expire_days_min': SHARE_LINK_EXPIRE_DAYS_MIN,
        'share_link_expire_days_max': SHARE_LINK_EXPIRE_DAYS_MAX,
        'video_tutorials_link': VIDEO_TUTORIALS_LINK,
        'enable_user_guide': ENABLE_USER_GUIDE,
        'getting_start_link': GETTING_START_LINK,
        'use_cases_link': USE_CASES_LINK,
        'training_services_link': TRAINING_SERVICES_LINK,
        'introduction_video_link': INTRODUCTION_VIDEO_LINK,
        'enable_introduction_video': ENABLE_INTRODUCTION_VIDEO,
        'enable_create_base_from_template': ENABLE_CREATE_BASE_FROM_TEMPLATE,
        'enable_org_common_dataset': settings.ENABLE_ORG_COMMON_DATASET,
        'need_show_video': need_show_video,
        'enable_invite_a_friend': ENABLE_INVITE_A_FRIEND,
        'enable_tell_a_friend': settings.ENABLE_TELL_A_FRIEND,
        'friend_invitation_link': settings.FRIEND_INVITATION_LINK if settings.ENABLE_TELL_A_FRIEND else '',
        'use_external_team_admin': settings.USE_EXTERNAL_TEAM_ADMIN,
        'custom_nav_items': json.dumps(CUSTOM_NAV_ITEMS),
        'can_remove_base_password_via_phone': settings.CAN_REMOVE_BASE_PASSWORD_VIA_PHONE if settings.ENABLE_BIND_PHONE else False,
        'has_bound_phone': True if phone else False,
        'disable_adding_personal_bases': True if settings.DISABLE_ADDING_PERSONAL_BASES else False,
        'trash_clean_expire_days': settings.TRASH_CLEAN_AFTER_DAYS,
        'enable_address_book_v2': dj_settings.ENABLE_ADDRESSBOOK_V2,
        'enable_department_admin_manage_member_bases': dj_settings.ENABLE_DEPARTMENT_ADMIN_MANAGE_MEMBER_BASES,
        'enable_show_id_in_org_when_search_user': settings.ENABLE_SHOW_ID_IN_ORG_WHEN_SEARCH_USER,
    })
