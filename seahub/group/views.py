# Copyright (c) 2012-2016 Seafile Ltd.
# -*- coding: utf-8 -*-
import logging
import os
import json
import re
import urllib.request, urllib.error, urllib.parse

from django.conf import settings
from django.urls import reverse
from django.contrib import messages
from django.http import HttpResponse, HttpResponseRedirect, Http404, \
    HttpResponseBadRequest
from django.shortcuts import render

from urllib.parse import quote
from django.utils.translation import gettext as _

from seahub.auth.decorators import login_required, login_required_ajax
from seahub.constants import PERMISSION_PREVIEW
from seahub.department_v2.utils import is_department_v2_group
from seahub.settings import DTABLE_WEB_SERVICE_URL, GROUP_MEMBER_LIMIT, PERSONAL_GROUP_LIMIT
import seaserv
from seaserv import ccnet_threaded_rpc, ccnet_api, \
    get_group_repos, get_group, \
    remove_repo, get_file_id_by_path, post_empty_file, del_file
from pysearpc import SearpcError

from seahub.auth import REDIRECT_FIELD_NAME
from seahub.base.decorators import sys_staff_required, require_POST
from seahub.group.utils import validate_group_name, BadGroupNameError, \
    ConflictGroupNameError, is_group_member
from seahub.group.models import GroupInviteLinkModel
from seahub.settings import SITE_ROOT
from seahub.utils import render_error, send_html_email, is_org_context, \
    get_site_name

from seahub.forms import SharedRepoCreateForm

# Get an instance of a logger
logger = logging.getLogger(__name__)

########## ccnet rpc wrapper
def create_group(group_name, username):
    return seaserv.ccnet_threaded_rpc.create_group(group_name, username)

def create_org_group(org_id, group_name, username):
    return seaserv.ccnet_threaded_rpc.create_org_group(org_id, group_name,
                                                       username)

def get_all_groups(start, limit):
    return seaserv.ccnet_threaded_rpc.get_all_groups(start, limit)

def org_user_exists(org_id, username):
    return seaserv.ccnet_threaded_rpc.org_user_exists(org_id, username)

########## helper functions
def is_group_staff(group, user):
    if user.is_anonymous:
        return False
    return seaserv.check_group_staff(group.id, user.username)

def remove_group_common(group_id, username, org_id=None):
    """Common function to remove a group, and it's repos,
    If ``org_id`` is provided, also remove org group.

    Arguments:
    - `group_id`:
    """
    seaserv.ccnet_threaded_rpc.remove_group(group_id, username)
    seaserv.seafserv_threaded_rpc.remove_repo_group(group_id)
    if org_id and org_id > 0:
        seaserv.ccnet_threaded_rpc.remove_org_group(org_id, group_id)

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
        group = get_group(group_id_int)
        if not group:
            group_list_url = reverse('groups')
            return HttpResponseRedirect(group_list_url)
        group.is_staff = False
        if PublicGroup.objects.filter(group_id=group.id):
            group.is_pub = True
        else:
            group.is_pub = False

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
            group.is_staff = is_group_staff(group, request.user)
            return func(request, group, *args, **kwargs)

        if group.is_pub:
            group.view_perm = "pub"
            return func(request, group, *args, **kwargs)

        return render(request, 'error.html', {
                'error_msg': _('Permission denied'),
                })

    return _decorated

def rename_group_with_new_name(request, group_id, new_group_name):
    """Rename a group with new name.

    Arguments:
    - `request`:
    - `group_id`:
    - `new_group_name`:

    Raises:
        BadGroupNameError: New group name format is not valid.
        ConflictGroupNameError: New group name confilicts with existing name.
    """
    if not validate_group_name(new_group_name):
        raise BadGroupNameError

    # Check whether group name is duplicated.
    username = request.user.username
    org_id = -1
    if is_org_context(request):
        org_id = request.user.org.org_id
        checked_groups = seaserv.get_org_groups_by_user(org_id, username)
    else:
        if request.cloud_mode:
            checked_groups = seaserv.get_personal_groups_by_user(username)
        else:
            checked_groups = get_all_groups(-1, -1)

    for g in checked_groups:
        if g.group_name == new_group_name:
            raise ConflictGroupNameError

    ccnet_threaded_rpc.set_group_name(group_id, new_group_name)

def send_group_member_add_mail(request, group, from_user, to_user):
    c = {
        'email': from_user,
        'to_email': to_user,
        'group': group,
        }

    subject = _('You are invited to join a group on %s') % get_site_name()
    send_html_email(subject, 'group/add_member_email.html', c, None, [to_user])


@login_required
def group_invite(request, token):
    """
    reigsterd user add to group
    """
    email = request.user.username
    next_url = request.GET.get('next', '/')
    redirect_to = DTABLE_WEB_SERVICE_URL.rstrip('/') + '/' + next_url.lstrip('/')
    group_invite_link = GroupInviteLinkModel.objects.filter(token=token).first()
    if not group_invite_link:
        return render_error(request, _('Group invite link does not exist'))

    if is_department_v2_group(group_invite_link.group_id):
        return render_error(request, _('Forbidden invite user to department group'))

    if is_group_member(group_invite_link.group_id, email):
        return HttpResponseRedirect(redirect_to)

    try:
        group_org_id = ccnet_api.get_org_id_by_group(group_invite_link.group_id)
    except Exception as e:
        logger.error(f'get org id by group failed. {e}')
        return render_error(request, 'Internal Server Error')

    # org user but not same org
    if request.user.org and request.user.org.org_id != group_org_id:
        return render_error(request, _('You cannot join this group'))

    # non-org user but group is in org
    if not request.user.org and group_org_id > 0:
        return render_error(request, _('You cannot join this group'))

    if not group_invite_link.created_by:
        return render_error(request, _('Group invite link broken'))

    group_members = []
    try:
        group_members = ccnet_api.get_group_members(group_invite_link.group_id)
    except Exception as e:
        logger.error(f'get group members failed. {e}')
        return render_error(request, 'Internal Server Error')

    if group_members and len(group_members) >= GROUP_MEMBER_LIMIT:
        return render_error(request, _('Number of group members exceeds limit.'))

    # personal group limit
    if is_org_context(request):
        org_id = request.user.org.org_id
        user_groups = ccnet_api.get_org_groups_by_user(org_id, email)
    else:
        user_groups = ccnet_api.get_groups(email)

    if len(user_groups) >= PERSONAL_GROUP_LIMIT:
        error_msg = _('Number of groups exceeds the %s limit.') % PERSONAL_GROUP_LIMIT
        return render_error(request, error_msg)

    try:
        ccnet_api.group_add_member(group_invite_link.group_id, group_invite_link.created_by, email)
    except Exception as e:
        logger.error(f'group invite add user failed. {e}')
        return render_error(request, 'Internal Server Error')

    return HttpResponseRedirect(redirect_to)
