# Copyright (c) 2012-2016 Seafile Ltd.
# encoding: utf-8
import re
import logging
import json
from urllib.parse import urlparse

from rest_framework.decorators import api_view, throttle_classes
from django.conf import settings
from django.contrib import messages
from django.urls import reverse
from django.http import HttpResponse, Http404, HttpResponseRedirect
from django.shortcuts import render
from django.utils.crypto import get_random_string
from django.utils.translation import gettext_lazy as _

from seahub.auth import login, REDIRECT_FIELD_NAME
from seahub.auth.decorators import login_required, login_required_ajax
from seahub.base.accounts import User
from seahub.constants import TEAM_FREE
from seahub.group.views import remove_group_common
from seahub.utils import get_service_url, render_error
from seahub.utils.auth import get_login_bg_image_path
from seahub.organizations.signals import org_created
from seahub.organizations.decorators import org_staff_required
from seahub.organizations.forms import OrgRegistrationForm
from seahub.organizations.settings import ORG_AUTO_URL_PREFIX, ORG_MEMBER_QUOTA_ENABLED, ENABLE_ORG_LOGO
from seahub.organizations.utils import transfer_user_to_org, can_org_use_saml
from seahub.organizations.models import OrgSettings, Organization
from seahub.utils.two_factor_auth import has_two_factor_auth
from seahub.profile.models import Profile
from seahub.options.models import UserOptions
from seahub.api2.throttling import OrgRegisterRateThrottle
from seahub.settings import ENABLE_MULTI_SAML, ENABLE_TWO_FACTOR_AUTH

from seahub.organizations.models import OrgUser

# Get an instance of a logger
logger = logging.getLogger(__name__)


# ccnet rpc wrapper
def create_org(org_name, url_prefix, creator):
    return Organization.objects.create_org(org_name, url_prefix, creator)


def count_orgs():
    return Organization.objects.count_orgs()


def get_org_by_url_prefix(url_prefix):
    return Organization.objects.get_org_by_url_prefix(url_prefix)


def set_org_user(org_id, username, is_staff=False):
    return OrgUser.objects.create_org_user(org_id, username, is_staff)


def unset_org_user(org_id, username):
    return OrgUser.objects.remove_org_user(org_id, username)


def org_user_exists(org_id, username):
    return OrgUser.objects.org_user_exists(org_id, username)


def get_org_groups(org_id, start, limit):
    from seahub.organizations.models import OrgGroup

    sql = """SELECT g.*, og.org_id, og.id FROM `group` g 
    INNER JOIN org_group og ON g.group_id=og.group_id 
    WHERE og.org_id=%s LIMIT %s OFFSET %s"""

    org_groups = OrgGroup.objects.raw(sql, (org_id, limit, start))

    return org_groups


def get_org_id_by_group(group_id):
    return Organization.objects.get_org_id_by_group(group_id)


def remove_org_group(org_id, group_id, username):
    remove_group_common(group_id, username, org_id=org_id)


def is_org_staff(org_id, username):
    return OrgUser.objects.is_org_staff(org_id, username)


def set_org_staff(org_id, username):
    return OrgUser.objects.set_org_staff(org_id, username)


def unset_org_staff(org_id, username):
    return OrgUser.objects.unset_org_staff(org_id, username)


# seafile rpc wrapper
def get_org_user_self_usage(org_id, username):
    """

    Arguments:
    - `org_id`:
    - `username`:
    """
    return seafile_api.get_org_user_quota_usage(org_id, username)


def get_org_user_quota(org_id, username):
    return seafile_api.get_org_user_quota(org_id, username)


def get_org_quota(org_id):
    return seafile_api.get_org_quota(org_id)


def is_org_repo(org_id, repo_id):
    return True if seafile_api.get_org_id_by_repo_id(
        repo_id) == org_id else False


# views
@login_required_ajax
def org_add(request):
    """Handle ajax request to add org, and create org owner.

    Arguments:
    - `request`:
    """
    if not request.user.is_staff or request.method != 'POST':
        raise Http404

    content_type = 'application/json; charset=utf-8'

    url_prefix = gen_org_url_prefix(3)
    post_data = request.POST.copy()
    post_data['url_prefix'] = url_prefix
    form = OrgRegistrationForm(post_data)
    if form.is_valid():
        email = form.cleaned_data['email']
        password = form.cleaned_data['password1']
        org_name = form.cleaned_data['org_name']
        url_prefix = form.cleaned_data['url_prefix']

        try:
            new_user = User.objects.create_user(email, password,
                                                is_staff=False, is_active=True)
        except User.DoesNotExist as e:
            logger.error(e)
            err_msg = 'Fail to create organization owner %s.' % email
            return HttpResponse(json.dumps({'error': err_msg}),
                                status=403, content_type=content_type)
        create_org(org_name, url_prefix, new_user.username)

        return HttpResponse(json.dumps({'success': True}),
                            content_type=content_type)
    else:
        try:
            err_msg = list(form.errors.values())[0][0]
        except IndexError:
            err_msg = list(form.errors.values())[0]
        return HttpResponse(json.dumps({'error': str(err_msg)}),
                            status=400, content_type=content_type)


def gen_org_url_prefix(max_trial=None):
    """Generate organization url prefix automatically.
    If ``max_trial`` is large than 0, then re-try that times if failed.

    Arguments:
    - `max_trial`:

    Returns:
        Url prefix if succed, otherwise, ``None``.
    """
    def _gen_prefix():
        url_prefix = 'org-' + get_random_string(
            6, allowed_chars='abcdefghijklmnopqrstuvwxyz0123456789')
        if get_org_by_url_prefix(url_prefix) is not None:
            logger.info("org url prefix, %s is duplicated" % url_prefix)
            return None
        else:
            return url_prefix

    try:
        max_trial = int(max_trial)
    except (TypeError, ValueError):
        max_trial = 0

    while max_trial >= 0:
        ret = _gen_prefix()
        if ret is not None:
            return ret
        else:
            max_trial -= 1

    logger.warning("Failed to generate org url prefix, retry: %d" % max_trial)
    return None


@api_view(['GET', 'POST'])
@throttle_classes([OrgRegisterRateThrottle])
def org_register(request, redirect_field_name=REDIRECT_FIELD_NAME):
    """Allow a new user to register an organization account. A new
    organization will be created associate with that user.

    Arguments:
    - `request`:
    """

    login_bg_image_path = get_login_bg_image_path()
    redirect_to = request.GET.get(redirect_field_name)

    if request.method == 'POST':
        form = OrgRegistrationForm(request.POST)

        if ORG_AUTO_URL_PREFIX:
            # generate url prefix automatically
            url_prefix = gen_org_url_prefix(3)
            if url_prefix is None:
                messages.error(request, "Failed to create organization account, please try again later.")
                return render(request, 'organizations/org_register.html', {
                    'form': form,
                    'login_bg_image_path': login_bg_image_path,
                    'org_auto_url_prefix': ORG_AUTO_URL_PREFIX,
                })

        if form.is_valid():
            name = form.cleaned_data['name']
            email = form.cleaned_data['email']
            password = form.cleaned_data['password1']
            org_name = form.cleaned_data['org_name']

            new_user = User.objects.create_user(email, password,
                                                is_staff=False, is_active=True)
            create_org(org_name, url_prefix, new_user.username)
            new_org = get_org_by_url_prefix(url_prefix)
            org_created.send(sender=None, org=new_org)
            OrgSettings.objects.add_or_update(new_org, TEAM_FREE)

            # record the org's register IP to dtable_web.log
            remote_address = request.META.get('REMOTE_ADDR', '')
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR', '')
            if x_forwarded_for:
                remote_address = x_forwarded_for.split(',')[0]
            logger.warning('Org %s register IP is: %s' % (org_name, remote_address))

            if name:
                Profile.objects.add_or_update(new_user.username, name)

            # Handle newsletter subscription
            newsletter_subscribed = request.POST.get('newsletter') == 'on'
            if newsletter_subscribed:
                try:
                    # Save newsletter subscription status to user options
                    UserOptions.objects.set_newsletter_subscribed(new_user.username, '1')
                except Exception as e:
                    logger.warning('Failed to save newsletter subscription status: %s' % e)

            # login the user
            new_user.backend = settings.AUTHENTICATION_BACKENDS[0]
            login(request, new_user)

            if not redirect_to:
                response = HttpResponseRedirect(reverse('projects_list'))
            else:
                response = HttpResponseRedirect(redirect_to)

            response.delete_cookie('REGISTRATION_SOURCE')
            response.delete_cookie('INVITATION_TOKEN')
            return response
    else:
        form = OrgRegistrationForm()

    service_url = get_service_url()
    up = urlparse(service_url)
    service_url_scheme = up.scheme
    service_url_remaining = up.netloc + up.path

    return render(request, 'organizations/org_register.html', {
        'form': form,
        'login_bg_image_path': login_bg_image_path,
        'service_url_scheme': service_url_scheme,
        'service_url_remaining': service_url_remaining,
        'org_auto_url_prefix': ORG_AUTO_URL_PREFIX,
        'redirect_to': redirect_to or reverse('projects_list'),
    })


@login_required
def org_transfer(request, **kwargs):
    """ transfer user self to org
    """
    user = request.user
    username = user.username
    org_id = request.session.get('org_transfer_org_id', None)
    redirect_to = request.session.get('org_transfer_redirect', settings.LOGIN_REDIRECT_URL)

    # clear session
    try:
        del request.session['org_transfer_org_id']
        del request.session['org_transfer_redirect']
    except Exception as e:
        logger.warning(e)

    # check
    if Organization.objects.get_orgs_by_user(username):
        return render_error(request, '您的账号已经加入过 SeaTicket 团队')

    if not org_id:
        return render_error(request, 'org_id invalid.')

    org = Organization.objects.get_org_by_id(org_id)
    if not org:
        return render_error(request, 'Organization %s not found.' % org_id)

    # main
    transfer_status = transfer_user_to_org(username, org_id)
    if not transfer_status:
        return render_error(request, _('Internal Server Error'))

    return HttpResponseRedirect(redirect_to)


@login_required
@org_staff_required
def react_fake_view(request, **kwargs):
    group_id = kwargs.get('group_id', '')
    org = request.user.org
    enable_org_logo = ENABLE_ORG_LOGO and request.user.permissions.can_use_advanced_customization()
    can_use_saml = can_org_use_saml(org)

    # Whether use new page
    return render(request, "organizations/org_admin_react.html", {
        'org_id': org.org_id,
        'org_name': org.org_name,
        'org_member_quota_enabled': ORG_MEMBER_QUOTA_ENABLED,
        'enable_multi_saml': ENABLE_MULTI_SAML,
        'can_use_saml': can_use_saml,
        'group_id': group_id,
        'display_two_factor_auth': ENABLE_TWO_FACTOR_AUTH,
        'enable_org_logo': enable_org_logo,
        'two_factor_auth_enabled': has_two_factor_auth(),
        'trash_clean_expire_days': settings.TRASH_CLEAN_AFTER_DAYS,
        })
