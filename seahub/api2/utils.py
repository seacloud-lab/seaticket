# Copyright (c) 2012-2016 Seafile Ltd.
# encoding: utf-8
# Utility functions for api2

import os
import time
import json
import re
import logging

from functools import wraps

from django.http import HttpResponse
from rest_framework.authentication import SessionAuthentication
from rest_framework.response import Response
from rest_framework import status, serializers

from seahub.base.templatetags.seahub_tags import email2nickname, email2contact_email
from seahub.group.utils import is_group_member, is_group_admin_or_owner_by_group
from seahub.api2.models import Token, TokenV2, DESKTOP_PLATFORMS
from seahub.avatar.settings import AVATAR_DEFAULT_SIZE
from seahub.avatar.templatetags.avatar_tags import api_avatar_url
from seahub.group.models import Group

from seahub.settings import INSTALLED_APPS


logger = logging.getLogger(__name__)


def api_error(code, msg):
    err_resp = {'error_msg': msg}
    return Response(err_resp, status=code)


def get_groups(email):
    group_json = []

    joined_groups = Group.objects.get_personal_groups_by_user(email)
    grpmsgs = {}
    for g in joined_groups:
        grpmsgs[g.group_id] = 0

    replynum = 0

    return group_json, replynum

def get_timestamp(msgtimestamp):
    if not msgtimestamp:
        return 0
    timestamp = int(time.mktime(msgtimestamp.timetuple()))
    return timestamp

def api_group_check(func):
    """
    Decorator for initial group permission check tasks

    un-login user & group not pub --> login page
    un-login user & group pub --> view_perm = "pub"
    login user & non group member & group not pub --> public info page
    login user & non group member & group pub --> view_perm = "pub"
    group member --> view_perm = "joined"
    sys admin --> view_perm = "sys_admin"
    """
    def _decorated(view, request, group_id, *args, **kwargs):
        group_id_int = int(group_id) # Checked by URL Conf
        group = Group.objects.get_group(group_id_int)
        if not group:
            return api_error(status.HTTP_404_NOT_FOUND, 'Group not found.')
        group.is_staff = False

        joined = is_group_member(group_id_int, request.user.username)
        if joined:
            group.view_perm = "joined"
            group.is_staff = is_group_admin_or_owner_by_group(group, request.user)
            return func(view, request, group, *args, **kwargs)
        if request.user.is_staff:
            # viewed by system admin
            group.view_perm = "sys_admin"
            return func(view, request, group, *args, **kwargs)

        # Return group public info page.
        return api_error(status.HTTP_403_FORBIDDEN, 'Forbid to access this group.')

    return _decorated

def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR', '')

    return ip


JSON_CONTENT_TYPE = 'application/json; charset=utf-8'
def json_response(func):
    @wraps(func)
    def wrapped(*a, **kw):
        result = func(*a, **kw)
        if isinstance(result, HttpResponse):
            return result
        else:
            return HttpResponse(json.dumps(result), status=200,
                                content_type=JSON_CONTENT_TYPE)
    return wrapped

def get_token_v1(username):
    token, _ = Token.objects.get_or_create(user=username)
    return token

_ANDROID_DEVICE_ID_PATTERN = re.compile('^[a-f0-9]{1,16}$')
def get_token_v2(request, username, platform, device_id, device_name,
                 client_version, platform_version):

    if platform in DESKTOP_PLATFORMS:
        # desktop device id is the peer id, so it must be 40 chars
        if len(device_id) != 40:
            raise serializers.ValidationError('invalid device id')

    elif platform == 'android':
        # See http://developer.android.com/reference/android/provider/Settings.Secure.html#ANDROID_ID
        # android device id is the 64bit secure id, so it must be 16 chars in hex representation
        # but some user reports their device ids are 14 or 15 chars long. So we relax the validation.
        if not _ANDROID_DEVICE_ID_PATTERN.match(device_id.lower()):
            raise serializers.ValidationError('invalid device id')
    elif platform == 'ios':
        if len(device_id) != 36:
            raise serializers.ValidationError('invalid device id')
    else:
        raise serializers.ValidationError('invalid platform')

    return TokenV2.objects.get_or_create_token(
        username, platform, device_id, device_name,
        client_version, platform_version, get_client_ip(request))

def get_api_token(request, keys=None):

    if not keys:
        keys = [
            'platform',
            'device_id',
            'device_name',
            'client_version',
            'platform_version',
        ]

    if all([key in request.GET for key in keys]):

        platform = request.GET['platform']
        device_id = request.GET['device_id']
        device_name = request.GET['device_name']
        client_version = request.GET['client_version']
        platform_version = request.GET['platform_version']

        token = get_token_v2(request, request.user.username, platform,
                             device_id, device_name, client_version,
                             platform_version)
    else:
        token = get_token_v1(request.user.username)

    return token

def to_python_boolean(string):
    """Convert a string to boolean.
    """
    if isinstance(string, bool):
        return string
    string = string.lower()
    if string in ('t', 'true', '1'):
        return True
    if string in ('f', 'false', '0'):
        return False
    raise ValueError("Invalid boolean value: '%s'" % string)

def is_seafile_pro():
    return any(['seahub_extra' in app for app in INSTALLED_APPS])

def get_user_common_info(email, include_contact_email=True):
    avatar_url, is_default, date_uploaded = api_avatar_url(email)
    d = {
        "email": email,
        "name": email2nickname(email),
        "avatar_url": avatar_url,
    }
    if include_contact_email:
        d.update({
            "contact_email": email2contact_email(email)
        })
    return d

def user_to_dict(email, request=None, avatar_size=AVATAR_DEFAULT_SIZE):
    d = get_user_common_info(email)
    return {
        'user_name': d['name'],
        'user_email': d['email'],
        'user_contact_email': d['contact_email'],
        'avatar_url': d['avatar_url'],
    }

def is_web_request(request):
    if isinstance(request.successful_authenticator, SessionAuthentication):
        return True
    else:
        return False

def clear_tmp_file(file_path):
    if os.path.exists(file_path):
        os.remove(file_path)
