# Copyright (c) 2012-2016 Seafile Ltd.
# -*- coding: utf-8 -*-
import re
import logging

from django.conf import settings
from django.core.cache import cache

from seahub.avatar.templatetags.avatar_tags import api_avatar_url
from seahub.profile.models import Profile
from seahub.utils import is_org_context, normalize_cache_key
from seahub.group.models import Group, GroupUser

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

        sql = """SELECT a.group_id, count(*) as total_count FROM `group` a 
        INNER JOIN group_user b ON a.group_id=b.group_id 
        INNER JOIN org_group c ON c.group_id=a.group_id 
        WHERE a.group_name=%s AND c.org_id=%s AND b.user_name=%s"""
        group_count = Group.objects.raw(sql, (new_group_name, org_id, username))[0].total_count

        if group_count > 0:
            return True

    return False

def is_group_member(group_id, email):

    group_id = int(group_id)

    group = Group.objects.get(group_id=group_id)
    if not group:
        return False

    return GroupUser.objects.is_group_user(group_id, email)

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
    group = Group.objects.get(group_id=group_id)
    if group.creator_name == email:
        return True
    group_user = GroupUser.objects.get(group_id=group_id, user_name=email)
    if group_user.is_staff:
        return True
    return False


def is_group_admin_or_owner_by_group(group, email):
    return group.is_staff or group.creator_name == email

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

    group = Group.objects.get(group_id=int(group_id))
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
