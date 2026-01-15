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
from seahub.base.templatetags.seahub_tags import email2nickname

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
    group = Group.objects.get_group(group_id)
    if not group:
        return False
    return GroupUser.objects.is_group_user(group_id, email)

def is_group_owner(group_id, email):
    group = Group.objects.get_group(group_id)
    if not group:
        return False
    if email == group.creator_name:
        return True
    else:
        return False

def is_group_admin_or_owner(group_id, email):
    group = Group.objects.get_group(group_id)
    if not group:
        return False
    if group.creator_name == email:
        return True
    group_user = GroupUser.objects.filter(group_id=group_id, user_name=email).first()
    if not group_user:
        return False
    if group_user.is_staff:
        return True
    return False

def is_group_admin_or_owner_by_group(group, email):
    if group.creator_name == email:
        return True
    group_user = GroupUser.objects.filter(group_id=group.group_id, user_name=email).first()
    if not group_user:
        return False
    if group_user.is_staff:
        return True
    return False

def get_group_member_info(group_id, email):
    p = Profile.objects.get_profile_by_user(email)
    if p:
        login_id = p.login_id if p.login_id else ''
    else:
        login_id = ''

    avatar_url, is_default, date_uploaded = api_avatar_url(email)
    group = Group.objects.get_group(group_id)
    if not group:
        return None
    role = 'Member'
    is_admin = is_group_admin_or_owner(group_id, email)
    if email == group.creator_name:
        role = 'Owner'
    elif is_admin:
        role = 'Admin'

    if p is not None and p.nickname and p.nickname.strip():
        display_name = p.nickname.strip()
    else:
        display_name = email2nickname(email)

    member_info = {
        'group_id': group_id,
        "name": display_name,
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

    group = Group.objects.get_group(group_id=int(group_id))
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
    members = GroupUser.objects.filter(group_id=group_id)
    return [{'username': member.user_name, 'is_staff': member.is_staff} for member in members]


def get_groups_members(group_ids, only_staffs=False):
    """
    return: {group_id: [{username, is_staff}]}
    """
    groups_members_dict = {}
    members = GroupUser.objects.filter(group_id__in=group_ids)
    for member in members:
        member_info = {'username': member['username'], 'is_staff': member['is_staff']}
        if member.group_id not in groups_members_dict:
            groups_members_dict[member.group_id] = [member_info]
        else:
            groups_members_dict[member.group_id].append(member_info)
    return groups_members_dict


def get_user_groups(username, return_ancestors=False):
    """
    return: a list of Group objs
    """
    groups = []
    user_groups = GroupUser.objects.filter(user_name=username)
    for g in user_groups:
        group = Group.objects.get_group(group_id=g.group_id)
        if not group:
            continue
        if group not in groups:
            groups.append(group)
        if return_ancestors and group.parent_group_id > 0:
            while True:
                try:
                    parent_group = Group.objects.get_group(
                        group_id=group.parent_group_id)
                    if not parent_group:
                        break
                    if parent_group not in groups:
                        groups.append(parent_group)
                    if parent_group.parent_group_id > 0:
                        group = parent_group
                        continue
                    else:
                        break
                except Exception as e:
                    logger.error(e)
                    break
    return groups


def get_user_admin_group_ids(username):
    """
    return: group ids
    """
    group_ids = []
    user_groups = GroupUser.objects.filter(user_name=username, is_staff=True)
    for g in user_groups:
        group_ids.append(g.group_id)
    return group_ids
