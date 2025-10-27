# Copyright (c) 2012-2016 Seafile Ltd.
# -*- coding: utf-8 -*-
import logging
import time

from django.conf import settings
from django.urls import reverse
from django.http import HttpResponseRedirect
from django.shortcuts import render

from urllib.parse import quote
from django.utils.translation import gettext as _

from seahub.auth.decorators import login_required
from seahub.auth import REDIRECT_FIELD_NAME
from seahub.group.utils import is_group_member
from seahub.utils import send_html_email, is_org_context, \
    get_site_name, render_error, redirect_to_login
from seahub.group.models import Group, GroupUser, GroupInviteLinkModel
from seahub.organizations.models import Organization, OrgUser, OrgGroup
from seahub.group.utils import is_group_admin_or_owner_by_group, get_group_members
from seahub.settings import SEAQA_WEB_SERVICE_URL, GROUP_MEMBER_LIMIT, PERSONAL_GROUP_LIMIT
from seahub.api2.utils import get_groups
from seahub.admin_log.signals import org_admin_operation
from seahub.admin_log.models import GROUP_MEMBER_ADD


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


@login_required
def group_invite(request, token):
    """
    reigsterd user add to group
    """
    email = request.user.username
    next_url = request.GET.get('next', '/')
    redirect_to = SEAQA_WEB_SERVICE_URL.rstrip('/') + '/' + next_url.lstrip('/')
    group_invite_link = GroupInviteLinkModel.objects.filter(token=token).first()
    if not group_invite_link:
        return render_error(request, _('Group invite link does not exist'))

    try:
        group_org_id = Organization.objects.get_org_id_by_group(group_invite_link.group_id)
    except Exception as e:
        logger.error(f'get org id by group failed. {e}')
        return render_error(request, 'Internal Server Error')

    if is_group_member(group_invite_link.group_id, email):
        return HttpResponseRedirect(redirect_to)

    # org user but not same org
    if request.user.org and request.user.org.org_id != group_org_id:
        return render_error(request, _('You cannot join this group'))

    # non-org user but group is in org
    if not request.user.org and group_org_id > 0:
        return render_error(request, _('You cannot join this group'))

    group_members = []
    try:
        group_members = get_group_members(group_invite_link.group_id)
    except Exception as e:
        logger.error(f'get group members failed. {e}')
        return render_error(request, 'Internal Server Error')

    if group_members and len(group_members) >= GROUP_MEMBER_LIMIT:
        return render_error(request, _('Number of group members exceeds limit.'))

    # personal group limit
    if is_org_context(request):
        org_id = request.user.org.org_id
        user_groups = OrgGroup.objects.get_org_groups_by_user(org_id, email)
    else:
        user_groups = get_groups(email)

    if len(user_groups) >= PERSONAL_GROUP_LIMIT:
        error_msg = _('Number of groups exceeds the %s limit.') % PERSONAL_GROUP_LIMIT
        return render_error(request, error_msg)

    try:
        GroupUser.objects.group_add_member(group_invite_link.group_id, email)
        org_admin_op_detail = {
            'username': email,
            'group_id': group_invite_link.group_id,
        }
        org_admin_operation.send(sender=None,
            admin_name='',
            operation=GROUP_MEMBER_ADD,
            detail=org_admin_op_detail,
            org_id=org_id,
        )
    except Exception as e:
        logger.error(f'group invite add user failed. {e}')
        return render_error(request, 'Internal Server Error')

    return HttpResponseRedirect(redirect_to)
