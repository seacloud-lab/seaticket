# Copyright (c) 2012-2016 Seafile Ltd.
# -*- coding: utf-8 -*-
import re
import logging

from django.conf import settings
from django.core.cache import cache

import seaserv
from seaserv import ccnet_api

from seahub.avatar.settings import AVATAR_DEFAULT_SIZE
from seahub.avatar.templatetags.avatar_tags import api_avatar_url
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.ccnet_db.ccnet.groups import get_groups_members as ccnet_get_groups_members, get_user_admin_group_ids as ccnet_get_user_admin_group_ids, \
    get_groups_info, FakeGroup
from seahub.department_v2.utils import is_department_v2_group_admin, is_department_v2_group_member, \
    is_department_v2_group, get_department_v2_groups_members, get_department_v2_groups_by_user
from seahub.profile.models import Profile
from seahub.utils import is_org_context, normalize_cache_key

logger = logging.getLogger(__name__)

class BadGroupNameError(Exception):
    pass

class ConflictGroupNameError(Exception):
    pass

def validate_group_name(group_name):
    """
    Check whether group name is valid.
    A valid group name only contains alphanumeric character, and the length
    should less than 255.
    """
    if len(group_name) > 255:
        return False
    return re.match('^[\w\s\'\.-]+$', group_name, re.U)

def check_group_name_conflict(request, new_group_name):
    """Check if new group name conflict with existed group.

    return "True" if conflicted else "False"
    """
    org_id = -1
    username = request.user.username
    if is_org_context(request):
        org_id = request.user.org.org_id
        checked_groups = seaserv.get_org_groups_by_user(org_id, username)
    else:
        if request.cloud_mode:
            checked_groups = seaserv.get_personal_groups_by_user(username)
        else:
            checked_groups = ccnet_api.search_groups(new_group_name, -1, -1)

    for g in checked_groups:
        if g.group_name == new_group_name:
            return True

    return False

def is_group_member(group_id, email, in_structure=None):

    group_id = int(group_id)

    group = ccnet_api.get_group(group_id)
    if not group:
        return False

    is_member = False

    if settings.ENABLE_ADDRESSBOOK_V2 and is_department_v2_group(group_id):
        is_member = is_department_v2_group_member(group_id, email)
    else:
        if in_structure in (True, False):
            return ccnet_api.is_group_user(group_id, email, in_structure)
        if group.parent_group_id == 0:
            # -1: top address book group
            #  0: group not in address book
            # >0: sub group in address book
            # if `in_structure` is False, NOT check sub groups in address book
            is_member = ccnet_api.is_group_user(group_id, email, in_structure=False)
        else:
            is_member = ccnet_api.is_group_user(group_id, email)

    return is_member

def is_group_admin(group_id, email):
    if settings.ENABLE_ADDRESSBOOK_V2 and is_department_v2_group(group_id):
        is_admin = is_department_v2_group_admin(group_id, email)
    else:
        is_admin = ccnet_api.check_group_staff(int(group_id), email)
    return is_admin

def is_group_owner(group_id, email):
    group = ccnet_api.get_group(int(group_id))
    if not group:
        return False
    if email == group.creator_name:
        return True
    else:
        return False

def is_group_admin_or_owner(group_id, email):
    if is_group_admin(group_id, email) or \
        is_group_owner(group_id, email):
        return True
    else:
        return False

def get_group_member_info(request, group_id, email):
    p = Profile.objects.get_profile_by_user(email)
    if p:
        login_id = p.login_id if p.login_id else ''
    else:
        login_id = ''

    avatar_url, is_default, date_uploaded = api_avatar_url(email)

    group = ccnet_api.get_group(int(group_id))

    if settings.ENABLE_ADDRESSBOOK_V2 and is_department_v2_group(group_id):
        role = 'Member'
        is_admin = is_department_v2_group_admin(group_id, email)
        if is_admin:
            role = 'Admin'
    else:
        role = 'Member'
        is_admin = bool(ccnet_api.check_group_staff(int(group_id), email))
        if email == group.creator_name:
            role = 'Owner'
        elif is_admin:
            role = 'Admin'

    if p is not None and p.nickname and p.nickname.strip():
        nickname = p.nickname.strip()
    else:
        nickname = email.split('@')[0]

    member_info = {
        'group_id': group_id,
        "name": nickname,
        'email': email,
        "contact_email": p.contact_email,
        "login_id": login_id,
        "avatar_url": avatar_url,
        "is_admin": is_admin,
        "role": role,
    }

    return member_info

GROUP_ID_CACHE_PREFIX = "GROUP_ID_"
GROUP_ID_CACHE_TIMEOUT = 24 * 60 * 60

def group_id_to_name(group_id):

    group_id = str(group_id)

    key = normalize_cache_key(group_id, GROUP_ID_CACHE_PREFIX)
    cached_group_name = cache.get(key)
    if cached_group_name:
        return cached_group_name

    group = ccnet_api.get_group(int(group_id))
    if not group:
        return ''

    group_name = group.group_name
    cache.set(key, group_name, GROUP_ID_CACHE_TIMEOUT)

    return group_name


def refresh_group_name_cache(group_id, new_group_name):
    """
    Function to be called when change group name.
    """
    group_id = str(group_id)

    key = normalize_cache_key(group_id, GROUP_ID_CACHE_PREFIX)
    cache.set(key, new_group_name, GROUP_ID_CACHE_TIMEOUT)


def get_group_id_by_repo_owner(repo_owner):

    return int(repo_owner.split('@')[0])


def get_group_members(group_id):
    """return [{username, is_staff}]
    """
    if settings.ENABLE_ADDRESSBOOK_V2 and is_department_v2_group(group_id):
        members = get_department_v2_groups_members([group_id]).get(group_id, [])
        return [{'username': member['username'], 'is_staff': member['is_staff']} for member in members]
    else:
        members = ccnet_api.get_group_members(group_id)
        return [{'username': member.user_name, 'is_staff': member.is_staff} for member in members]


def get_groups_members(group_ids, only_staffs=False):
    """
    return: {group_id: [{username, is_staff}]}
    """
    groups_members_dict = ccnet_get_groups_members(group_ids, only_staffs=only_staffs)
    if settings.ENABLE_ADDRESSBOOK_V2:
        department_groups_members_dict = get_department_v2_groups_members(group_ids, only_staffs=only_staffs)
        for group_id, members in department_groups_members_dict.items():
            if members:  # members not empty means the group is a department group and there are members in it
                groups_members_dict[group_id] = [{'username': member['username'], 'is_staff': member['is_staff']} for member in members]
    return groups_members_dict


def get_user_groups(username, return_ancestors=False):
    """
    return: a list of Group objs
    """
    groups = ccnet_api.get_groups(username, return_ancestors=return_ancestors)
    if settings.ENABLE_ADDRESSBOOK_V2:
        department_v2_group_ids = list(get_department_v2_groups_by_user(username).values_list('group_id', flat=True))
        group_infos_dict = get_groups_info(department_v2_group_ids)
        for group_id in department_v2_group_ids:
            group_info = group_infos_dict.get(group_id)
            if not group_info:
                continue
            groups.append(FakeGroup(group_info))
    return groups


def get_user_admin_group_ids(username):
    """
    return: group ids
    """
    group_ids = ccnet_get_user_admin_group_ids(username)
    if settings.ENABLE_ADDRESSBOOK_V2:
        department_v2_group_ids = get_department_v2_groups_by_user(username, is_staff=True).values_list('group_id', flat=True)
        group_ids.extend(department_v2_group_ids)
    return group_ids
