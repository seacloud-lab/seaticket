# Copyright (c) 2012-2016 Seafile Ltd.
import re
import datetime
import time
import urllib.request, urllib.parse, urllib.error
import logging

from rest_framework import status

from seahub.api2.utils import api_error
from seahub.base.templatetags.seahub_tags import email2nickname, \
        email2contact_email
from seahub.utils import is_org_context
from seahub.organizations.models import OrgUser, Organization
from seahub.group.models import Group

try:
    from seahub.settings import MULTI_TENANCY
except ImportError:
    MULTI_TENANCY = False

logger = logging.getLogger(__name__)

def api_check_group(func):
    """
    Decorator for check if group valid
    """
    def _decorated(view, request, group_id, *args, **kwargs):
        group_id = int(group_id) # Checked by URL Conf
        try:
            group = Group.objects.get_group(int(group_id))
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if not group:
            error_msg = 'Group %d not found.' % group_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        return func(view, request, group_id, *args, **kwargs)

    return _decorated

def add_org_context(func):
    def _decorated(view, request, *args, **kwargs):
        if is_org_context(request):
            org_id = request.user.org.org_id
        else:
            org_id = None
        return func(view, request, org_id=org_id, *args, **kwargs)

    return _decorated

def is_org_user(username, org_id=None):
    """ Check if an user is an org user.

    Keyword arguments:
    org_id -- An integer greater than zero. If provided,
    check if the user is a member of the specific org.
    """

    if not MULTI_TENANCY:
        return False

    try:
        if org_id:
            # Return non-zero if True, otherwise 0.
            return OrgUser.objects.org_user_exists(org_id, username) != 0
        else:
            org = Organization.objects.get_org_by_username(username)
            if not org:
                return False
            return True
    except Exception as e:
        logger.error(e)
        return False

def get_user_contact_email_dict(email_list):
    email_list = set(email_list)
    user_contact_email_dict = {}
    for email in email_list:
        if email not in user_contact_email_dict:
            user_contact_email_dict[email] = email2contact_email(email)

    return user_contact_email_dict

def get_user_name_dict(email_list):
    email_list = set(email_list)
    user_name_dict = {}
    for email in email_list:
        if email not in user_name_dict:
            user_name_dict[email] = email2nickname(email)

    return user_name_dict


def get_group_dict(group_id_list):
    group_id_list = set(group_id_list)
    group_dict = {}
    for group_id in group_id_list:
        if group_id not in group_dict:
            group_dict[group_id] = ''
            group = Group.objects.get_group(int(group_id))
            if group:
                group_dict[group_id] = group

    return group_dict


def check_time_period_valid(start, end):
    if not start or not end:
        return False

    # check the date format, should be like '2015-10-10'
    date_re = re.compile(r'^(\d{4})\-([1-9]|0[1-9]|1[012])\-([1-9]|0[1-9]|[12]\d|3[01])$')
    if not date_re.match(start) or not date_re.match(end):
        return False

    return True
