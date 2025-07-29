# Copyright (c) 2012-2016 Seafile Ltd.
# -*- coding: utf-8 -*-
import logging
import time
import os
import json
import re
import urllib.request, urllib.error, urllib.parse

from django.conf import settings
from django.urls import reverse
from django.http import HttpResponseRedirect
from django.shortcuts import render

from urllib.parse import quote
from django.utils.translation import gettext as _

from seahub.auth import REDIRECT_FIELD_NAME
from seahub.group.utils import validate_group_name, BadGroupNameError, \
    ConflictGroupNameError, is_group_member
from seahub.utils import send_html_email, is_org_context, \
    get_site_name
from seahub.group.models import Group
from seahub.organizations.models import OrgUser, OrgGroup
from seahub.group.utils import is_group_admin_or_owner_by_group


# Get an instance of a logger
logger = logging.getLogger(__name__)

########## ccnet rpc wrapper
def create_group(group_name, username):
    ctime = int(time.time_ns() / 1000)
    return Group.objects.create(group_name=group_name, creator_name=username, parent_group_id=0, timestamp=ctime)

def create_org_group(org_id, group_name, username):
    return OrgGroup.objects.create_org_group(org_id, group_name, username)

def get_all_groups(start, limit):
    return Group.objects.all()[start, limit]

def org_user_exists(org_id, username):
    return OrgUser.objects.org_user_exists(org_id, username)

########## helper functions

def remove_group_common(group_id, username, org_id=None):
    """Common function to remove a group, and it's repos,
    If ``org_id`` is provided, also remove org group.

    Arguments:
    - `group_id`:
    """
    Group.objects.remove_group(group_id)
    if org_id and org_id > 0:
        OrgGroup.objects.remove_org_group(org_id, group_id)

def group_check(func):
    """
    Decorator for initial group permission check tasks

    un-login user & group not pub --> login page
    un-login user & group pub --> view_perm = "pub"
    login user & non group member & group not pub --> public info page
    login user & non group member & group pub --> view_perm = "pub"
    group member --> view_perm = "joined"
    sys admin --> view_perm = "sys_admin"
    """
    def _decorated(request, group_id, *args, **kwargs):
        group_id_int = int(group_id) # Checked by URL Conf
        group = Group.objects.get_group(group_id_int)
        if not group:
            group_list_url = reverse('groups')
            return HttpResponseRedirect(group_list_url)
        group.is_staff = False

        if not request.user.is_authenticated:
            if not group.is_pub:
                login_url = settings.LOGIN_URL
                path = quote(request.get_full_path())
                tup = login_url, REDIRECT_FIELD_NAME, path
                return HttpResponseRedirect('%s?%s=%s' % tup)
            else:
                group.view_perm = "pub"
                return func(request, group, *args, **kwargs)

        joined = is_group_member(group_id_int, request.user.username)
        if joined:
            group.view_perm = "joined"
            group.is_staff = is_group_admin_or_owner_by_group(group, request.user)
            return func(request, group, *args, **kwargs)

        if group.is_pub:
            group.view_perm = "pub"
            return func(request, group, *args, **kwargs)

        return render(request, 'error.html', {
                'error_msg': _('Permission denied'),
                })

    return _decorated

def send_group_member_add_mail(request, group, from_user, to_user):
    c = {
        'email': from_user,
        'to_email': to_user,
        'group': group,
        }

    subject = _('You are invited to join a group on %s') % get_site_name()
    send_html_email(subject, 'group/add_member_email.html', c, None, [to_user])
