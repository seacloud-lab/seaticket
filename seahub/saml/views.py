# -*- coding:utf-8 -*-
import logging
from urllib.parse import unquote, parse_qs, urlparse

from djangosaml2.views import LogoutView

from seahub.constants import SAML_ATTRIBUTE_MAP

from saml2 import BINDING_HTTP_POST
from saml2.metadata import entity_descriptor
from saml2.client import Saml2Client
from saml2.ident import code
from saml2.response import StatusInvalidNameidPolicy
from djangosaml2.cache import IdentityCache, OutstandingQueriesCache
from djangosaml2.conf import get_config

from django.utils.translation import gettext as _
from django.urls import reverse
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.http import HttpResponseRedirect, HttpResponse
from django.utils.http import url_has_allowed_host_and_scheme

from seahub import auth
from seahub.base.accounts import User
from seahub.base.sudo_mode import update_sudo_mode_ts
from seahub.utils import render_error
from seahub.auth.decorators import login_required
from seahub.auth.models import SocialAuthUser
from seahub.profile.models import Profile
from seahub.project.models import IdInOrgTuple
from seahub.utils.licenseparse import user_number_over_limit
from seahub.organizations.utils import can_org_use_saml
from seahub.settings import LOGIN_REDIRECT_URL
from seahub.saml.signals import saml_sso_failed
try:
    from seahub.settings import ORG_MEMBER_QUOTA_ENABLED
except ImportError:
    ORG_MEMBER_QUOTA_ENABLED = False


logger = logging.getLogger(__name__)

SAML_ATTRIBUTE_MAP = getattr(settings, 'SAML_ATTRIBUTE_MAP', SAML_ATTRIBUTE_MAP)
SAML_PROVIDER_IDENTIFIER = getattr(settings, 'SAML_PROVIDER_IDENTIFIER', 'saml')


def _set_subject_id(session, subject_id):
    session['_saml2_subject_id'] = code(subject_id)


def get_org_admins(org):
    org_admins = list()
    org_users = ccnet_api.get_org_emailusers(org.url_prefix, -1, -1)
    for user in org_users:
        if ccnet_api.is_org_staff(org.org_id, user.email):
            org_admins.append(user)
    return org_admins


def parse_user_identity(user_identity):
    uid = contact_email = nickname = id_in_org = user_role = None
    for saml_key, dtable_key in SAML_ATTRIBUTE_MAP.items():
        if dtable_key == 'uid':
            uid = user_identity.get(saml_key, [''])[0]
        if dtable_key == 'contact_email':
            contact_email = user_identity.get(saml_key, [''])[0]
        if dtable_key == 'name':
            nickname = user_identity.get(saml_key, [''])[0]
        if dtable_key == 'employee_id':
            id_in_org = user_identity.get(saml_key, [''])[0]
        if dtable_key == 'user_role':
            user_role = user_identity.get(saml_key, [''])[0]

    return uid, contact_email, nickname, id_in_org, user_role


def update_user_profile(username, nickname, contact_email, org_id, id_in_org, user_role):
    # update user's profile
    profile = Profile.objects.get_profile_by_user(username)
    if not profile:
        profile = Profile(user=username)
    if nickname:
        profile.nickname = nickname.strip()
        profile.save()
    if contact_email:
        profile.contact_email = contact_email.strip()
        profile.save()

    # update user's id_in_org
    if id_in_org:
        IdInOrgTuple.objects.add_or_update(username, id_in_org, org_id)

    # update user's role
    if user_role:
        User.objects.update_role(username, user_role)


def metadata(request, org_id=None):
    org = None
    if org_id and int(org_id) > 0:
        org_id = int(org_id)
        org = ccnet_api.get_org_by_id(org_id)
        if not org:
            logger.error('Cannot find an organization related to org_id %s.' % org_id)
            return render_error(request, _('Internal server error. Please contact system administrator.'))

        if not can_org_use_saml(org):
            logger.error('Feature is not enabled.')
            return render_error(request, _('Internal server error. Please contact system administrator.'))

    try:
        sp_config = get_config(None, request)
    except RuntimeError as e:
        logger.error(e)
        # send error msg to admin
        error_msg = 'ADFS/SAML service error. Please check and fix the ADFS/SAML service.'
        if org:
            org_admins = get_org_admins(org)
            for org_admin in org_admins:
                saml_sso_failed.send(sender=None, to_user=org_admin.email, error_msg=error_msg)
        else:
            admins = User.objects.get_superusers()
            for admin in admins:
                saml_sso_failed.send(sender=None, to_user=admin.email, error_msg=error_msg)
        return render_error(request, _('Login failed: ADFS/SAML service error. '
                                       'Please report to your organization (company) administrator.'))
    except Exception as e:
        logger.error(e)
        return render_error(request, _('Internal server error. Please contact system administrator.'))

    sp_metadata = entity_descriptor(sp_config)
    return HttpResponse(
        content=str(sp_metadata).encode("utf-8"),
        content_type="text/xml; charset=utf-8",
    )


@require_POST
@csrf_exempt
def acs(request, org_id=None):
    org = None
    if org_id and int(org_id) > 0:
        org_id = int(org_id)
        org = ccnet_api.get_org_by_id(org_id)
        if not org:
            logger.error('Cannot find an organization related to org_id %s.' % org_id)
            return render_error(request, _('Internal server error. Please contact system administrator.'))

        if not can_org_use_saml(org):
            logger.error('Feature is not enabled.')
            return render_error(request, _('Internal server error. Please contact system administrator.'))
    else:
        org_id = -1

    saml_resp = request.POST.get('SAMLResponse', None)
    if not saml_resp:
        logger.error('Missing "SAMLResponse" parameter in POST data.')
        # send error msg to admin
        error_msg = 'ADFS/SAML service error. Please check and fix the ADFS/SAML service.'
        if org:
            org_admins = get_org_admins(org)
            for org_admin in org_admins:
                saml_sso_failed.send(sender=None, to_user=org_admin.email, error_msg=error_msg)
        else:
            admins = User.objects.get_superusers()
            for admin in admins:
                saml_sso_failed.send(sender=None, to_user=admin.email, error_msg=error_msg)
        return render_error(request, _('Login failed: Bad response from ADFS/SAML service. '
                                       'Please report to your organization (company) administrator.'))

    try:
        sp_config = get_config(None, request)
    except RuntimeError as e:
        logger.error(e)
        # send error msg to admin
        error_msg = 'ADFS/SAML service error. Please check and fix the ADFS/SAML service.'
        if org:
            org_admins = get_org_admins(org)
            for org_admin in org_admins:
                saml_sso_failed.send(sender=None, to_user=org_admin.email, error_msg=error_msg)
        else:
            admins = User.objects.get_superusers()
            for admin in admins:
                saml_sso_failed.send(sender=None, to_user=admin.email, error_msg=error_msg)
        return render_error(request, _('Login failed: ADFS/SAML service error. '
                                       'Please report to your organization (company) administrator.'))
    except Exception as e:
        logger.error(e)
        return render_error(request, _('Internal server error. Please contact system administrator.'))

    saml_client = Saml2Client(sp_config, identity_cache=IdentityCache(request.saml_session))
    oq_cache = OutstandingQueriesCache(request.saml_session)
    oq_cache.sync()
    outstanding_queries = oq_cache.outstanding_queries()
    try:
        authn_response = saml_client.parse_authn_request_response(saml_resp, BINDING_HTTP_POST, outstanding_queries)
    except StatusInvalidNameidPolicy as e:
        logger.error('SAMLResponse Error: %s' % e)
        # send error msg to admin
        error_msg = 'ADFS/SAML nameID policy error. Please check the nameID format and ensure all available users\' email are available.'
        if org:
            org_admins = get_org_admins(org)
            for org_admin in org_admins:
                saml_sso_failed.send(sender=None, to_user=org_admin.email, error_msg=error_msg)
        else:
            admins = User.objects.get_superusers()
            for admin in admins:
                saml_sso_failed.send(sender=None, to_user=admin.email, error_msg=error_msg)
        return render_error(request, _('Login failed: Bad response from ADFS/SAML service. '
                                       'Please make sure your SSO account has verified email and retry later, or report to your organization (company) administrator.'))
    except Exception as e:
        logger.error('SAMLResponse Error: %s' % e)
        # send error msg to admin
        error_msg = 'ADFS/SAML service error. Please check and fix the ADFS/SAML service.'
        if org:
            org_admins = get_org_admins(org)
            for org_admin in org_admins:
                saml_sso_failed.send(sender=None, to_user=org_admin.email, error_msg=error_msg)
        else:
            admins = User.objects.get_superusers()
            for admin in admins:
                saml_sso_failed.send(sender=None, to_user=admin.email, error_msg=error_msg)
        return render_error(request, _('Login failed: Bad response from ADFS/SAML service. '
                                       'Please report to your organization (company) administrator.'))

    if not authn_response:
        logger.error('Invalid SAML Assertion received.')
        # send error msg to admin
        error_msg = 'ADFS/SAML service error. Please check and fix the ADFS/SAML service.'
        if org:
            org_admins = get_org_admins(org)
            for org_admin in org_admins:
                saml_sso_failed.send(sender=None, to_user=org_admin.email, error_msg=error_msg)
        else:
            admins = User.objects.get_superusers()
            for admin in admins:
                saml_sso_failed.send(sender=None, to_user=admin.email, error_msg=error_msg)
        return render_error(request, _('Login failed: Bad response from ADFS/SAML service. '
                                       'Please report to your organization (company) administrator.'))

    try:
        user_identity = authn_response.get_identity()
    except Exception as e:
        logger.error(e)
        # send error msg to admin
        error_msg = 'ADFS/SAML service error. Please check and fix the ADFS/SAML service.'
        if org:
            org_admins = get_org_admins(org)
            for org_admin in org_admins:
                saml_sso_failed.send(sender=None, to_user=org_admin.email, error_msg=error_msg)
        else:
            admins = User.objects.get_superusers()
            for admin in admins:
                saml_sso_failed.send(sender=None, to_user=admin.email, error_msg=error_msg)
        return render_error(request, _('Login failed: Bad response from ADFS/SAML service. '
                                       'Please report to your organization (company) administrator.'))

    if not user_identity:
        logger.error('Invalid SAML Assertion received.')
        # send error msg to admin
        error_msg = 'ADFS/SAML service error. Please check the configurations of SAML protocol mapping.'
        if org:
            org_admins = get_org_admins(org)
            for org_admin in org_admins:
                saml_sso_failed.send(sender=None, to_user=org_admin.email, error_msg=error_msg)
        else:
            admins = User.objects.get_superusers()
            for admin in admins:
                saml_sso_failed.send(sender=None, to_user=admin.email, error_msg=error_msg)
        return render_error(request, _('Login failed: Bad response from ADFS/SAML service. '
                                       'Please report to your organization (company) administrator.'))

    # saml connect
    relay_state = request.POST.get('RelayState', '/saml/complete/')
    is_saml_connect = parse_qs(urlparse(unquote(relay_state)).query).get('is_saml_connect', [''])[0]
    if is_saml_connect == 'true':
        if not request.user.is_authenticated:
            return render_error(request, _('Failed to bind SAML, please login first.'))

        # get uid and other attrs from user_identity
        uid, contact_email, nickname, id_in_org, user_role = parse_user_identity(user_identity)
        if not uid:
            logger.error('saml user uid not found.')
            logger.error('user_identity: %s' % user_identity)
            # send error msg to admin
            error_msg = 'ADFS/SAML service error. Please check and fix the ADFS/SAML service.'
            if org:
                org_admins = get_org_admins(org)
                for org_admin in org_admins:
                    saml_sso_failed.send(sender=None, to_user=org_admin.email, error_msg=error_msg)
            else:
                admins = User.objects.get_superusers()
                for admin in admins:
                    saml_sso_failed.send(sender=None, to_user=admin.email, error_msg=error_msg)
            return render_error(request, _('Login failed: Bad response from ADFS/SAML service. '
                                           'Please report to your organization (company) administrator.'))

        saml_user = SocialAuthUser.objects.get_by_provider_and_uid(SAML_PROVIDER_IDENTIFIER, uid)
        if saml_user:
            logger.error('The SAML user has already been bound to another account.')
            return render_error(request, _('Internal server error. Please contact system administrator.'))

        # bind saml user
        username = request.user.username
        SocialAuthUser.objects.add(username, SAML_PROVIDER_IDENTIFIER, uid)

        # update user's profile
        try:
            update_user_profile(username, nickname, contact_email, org_id, id_in_org, user_role)
        except Exception as e:
            logger.warning('Failed to update user\'s profile, error: %s' % e)

        # set subject_id, saml single logout need this
        _set_subject_id(request.saml_session, authn_response.session_info()["name_id"])

        return HttpResponseRedirect(relay_state)

    # get uid and other attrs from user_identity
    uid, contact_email, nickname, id_in_org, user_role = parse_user_identity(user_identity)
    if not uid:
        logger.error('saml user uid not found.')
        logger.error('user_identity: %s' % user_identity)
        # send error msg to admin
        error_msg = 'ADFS/SAML service error. Please check and fix the ADFS/SAML service.'
        if org:
            org_admins = get_org_admins(org)
            for org_admin in org_admins:
                saml_sso_failed.send(sender=None, to_user=org_admin.email, error_msg=error_msg)
        else:
            admins = User.objects.get_superusers()
            for admin in admins:
                saml_sso_failed.send(sender=None, to_user=admin.email, error_msg=error_msg)
        return render_error(request, _('Login failed: Bad response from ADFS/SAML service. '
                                       'Please report to your organization (company) administrator.'))

    saml_user = SocialAuthUser.objects.get_by_provider_and_uid(SAML_PROVIDER_IDENTIFIER, uid)
    if saml_user:
        username = saml_user.username
        is_new_user = False
    else:
        # check if contact email exists or not
        if Profile.objects.filter(contact_email = contact_email).exists():
            return render_error(request, _('This email address is already used by an existing account.'
                                           'You can connect both accounts from the personal settings of your local account.'))
        username = None
        is_new_user = True

        # check user number limit by license
        if user_number_over_limit():
            logger.error('The number of users exceeds the license limit.')
            # send error msg to admin
            error_msg = 'The number of users exceeds the license limit.'
            admins = User.objects.get_superusers()
            for admin in admins:
                saml_sso_failed.send(sender=None, to_user=admin.email, error_msg=error_msg)
            return render_error(request, _('The number of users exceeds the limit.'))

        # check user number limit by org member quota
        if org:
            org_members = len(ccnet_api.get_org_emailusers(org.url_prefix, -1, -1))
            if ORG_MEMBER_QUOTA_ENABLED:
                from seahub.organizations.models import OrgMemberQuota
                org_members_quota = OrgMemberQuota.objects.get_quota(org_id)
                if org_members_quota is not None and org_members >= org_members_quota:
                    logger.error('The number of users exceeds the organization quota.')
                    # send error msg to admin
                    error_msg = 'Failed to create new user: the number of users exceeds the organization quota.'
                    org_admins = get_org_admins(org)
                    for org_admin in org_admins:
                        saml_sso_failed.send(sender=None, to_user=org_admin.email, error_msg=error_msg)
                    return render_error(request, _('Failed to create new user: '
                                                   'the number of users exceeds the organization quota. '
                                                   'Please report to your organization (company) administrator.'))

    user = auth.authenticate(saml_username=username, org_id=org_id)
    if not user:
        logger.error('ADFS/SAML single sign-on failed: failed to create user.')
        # send error msg to admin
        error_msg = 'ADFS/SAML single sign-on failed: failed to create user.'
        if org:
            org_admins = get_org_admins(org)
            for org_admin in org_admins:
                saml_sso_failed.send(sender=None, to_user=org_admin.email, error_msg=error_msg)
        else:
            admins = User.objects.get_superusers()
            for admin in admins:
                saml_sso_failed.send(sender=None, to_user=admin.email, error_msg=error_msg)
        return render_error(request, _('Login failed: failed to create user. '
                                       'Please report to your organization (company) administrator.'))

    username = user.username
    if is_new_user:
        SocialAuthUser.objects.add(username, SAML_PROVIDER_IDENTIFIER, uid)

    # update user's profile
    try:
        update_user_profile(username, nickname, contact_email, org_id, id_in_org, user_role)
    except Exception as e:
        logger.warning('Failed to update user\'s profile, error: %s' % e)

    if not user.is_active:
        logger.error('ADFS/SAML single sign-on failed: user %s is deactivated.' % user.username)
        # send error msg to admin
        error_msg = 'ADFS/SAML single sign-on failed: user % is deactivated.' % user.username
        if org:
            org_admins = get_org_admins(org)
            for org_admin in org_admins:
                saml_sso_failed.send(sender=None, to_user=org_admin.email, error_msg=error_msg)
        else:
            admins = User.objects.get_superusers()
            for admin in admins:
                saml_sso_failed.send(sender=None, to_user=admin.email, error_msg=error_msg)
        return render_error(request, _('Login failed: user is deactivated. '
                                       'Please report to your organization (company) administrator.'))

    # User is valid. Set request.user and persist user in the session by logging the user in.
    request.user = user
    auth.login(request, user)
    _set_subject_id(request.saml_session, authn_response.session_info()["name_id"])

    if not relay_state:
        logger.warning('The RelayState parameter exists but is empty')
        relay_state = '/saml/complete/'
    return HttpResponseRedirect(relay_state)


def login(request, org_id=None):
    org = None
    if org_id and int(org_id) > 0:
        org_id = int(org_id)
        org = ccnet_api.get_org_by_id(org_id)
        if not org:
            logger.error('Cannot find an organization related to org_id %s.' % org_id)
            return render_error(request, _('Internal server error. Please contact system administrator.'))

        if not can_org_use_saml(org):
            logger.error('Feature is not enabled.')
            return render_error(request, _('Internal server error. Please contact system administrator.'))

    next_url = request.GET.get('next', '/saml/complete/')
    try:
        if 'next=' in unquote(next_url):
            next_url = parse_qs(urlparse(unquote(next_url)).query)['next'][0]
    except Exception as e:
        logger.warning(e)
    if not url_has_allowed_host_and_scheme(next_url, None):
        next_url = '/saml/complete/'

    try:
        sp_config = get_config(None, request)
    except RuntimeError as e:
        logger.error(e)
        # send error msg to admin
        error_msg = 'ADFS/SAML service error. Please check and fix the ADFS/SAML service.'
        if org:
            org_admins = get_org_admins(org)
            for org_admin in org_admins:
                saml_sso_failed.send(sender=None, to_user=org_admin.email, error_msg=error_msg)
        else:
            admins = User.objects.get_superusers()
            for admin in admins:
                saml_sso_failed.send(sender=None, to_user=admin.email, error_msg=error_msg)
        return render_error(request, _('Login failed: ADFS/SAML service error. '
                                       'Please report to your organization (company) administrator.'))
    except Exception as e:
        logger.error(e)
        return render_error(request, _('Internal server error. Please contact system administrator.'))

    saml_client = Saml2Client(sp_config, identity_cache=IdentityCache(request.saml_session))
    reqid, info = saml_client.prepare_for_authenticate(relay_state=next_url)
    oq_cache = OutstandingQueriesCache(request.saml_session)
    oq_cache.set(reqid, next_url)

    redirect_url = None
    for key, value in info['headers']:
        if key == 'Location':
            redirect_url = value
            break

    return HttpResponseRedirect(redirect_url)


@login_required
def saml_connect(request, org_id=None):
    org = None
    if org_id and int(org_id) > 0:
        org_id = int(org_id)
        org = ccnet_api.get_org_by_id(org_id)
        if not org:
            logger.error('Cannot find an organization related to org_id %s.' % org_id)
            return render_error(request, _('Internal server error. Please contact system administrator.'))

        if not can_org_use_saml(org):
            logger.error('Feature is not enabled.')
            return render_error(request, _('Internal server error. Please contact system administrator.'))

        if request.user.org.org_id != org_id:
            logger.error('User %s does not belong to this organization: %s.' % (request.user.username, org.org_id))
            return render_error(request, _('Internal server error. Please contact system administrator.'))

    next_url = request.GET.get(auth.REDIRECT_FIELD_NAME, LOGIN_REDIRECT_URL)
    if not url_has_allowed_host_and_scheme(next_url, None):
        next_url = LOGIN_REDIRECT_URL
    next_url = next_url + '?is_saml_connect=true'

    try:
        sp_config = get_config(None, request)
    except RuntimeError as e:
        logger.error(e)
        # send error msg to admin
        error_msg = 'ADFS/SAML service error. Please check and fix the ADFS/SAML service.'
        if org:
            org_admins = get_org_admins(org)
            for org_admin in org_admins:
                saml_sso_failed.send(sender=None, to_user=org_admin.email, error_msg=error_msg)
        else:
            admins = User.objects.get_superusers()
            for admin in admins:
                saml_sso_failed.send(sender=None, to_user=admin.email, error_msg=error_msg)
        return render_error(request, _('Login failed: ADFS/SAML service error. '
                                       'Please report to your organization (company) administrator.'))
    except Exception as e:
        logger.error(e)
        return render_error(request, _('Failed to get ADFS/SAML config, please check your ADFS/SAML service.'))

    saml_client = Saml2Client(sp_config, identity_cache=IdentityCache(request.saml_session))
    reqid, info = saml_client.prepare_for_authenticate(relay_state=next_url)
    oq_cache = OutstandingQueriesCache(request.saml_session)
    oq_cache.set(reqid, next_url)

    redirect_url = None
    for key, value in info['headers']:
        if key == 'Location':
            redirect_url = value
            break

    return HttpResponseRedirect(redirect_url)


@login_required
def saml_disconnect(request, org_id=None):
    if org_id and int(org_id) > 0:
        org_id = int(org_id)
        org = ccnet_api.get_org_by_id(org_id)
        if not org:
            logger.error('Cannot find an organization related to org_id %s.' % org_id)
            return render_error(request, _('Internal server error. Please contact system administrator.'))

        if not can_org_use_saml(org):
            logger.error('Feature is not enabled.')
            return render_error(request, _('Internal server error. Please contact system administrator.'))

        if request.user.org.org_id != org_id:
            logger.error('User %s does not belong to this organization: %s.' % (request.user.username, org.org_id))
            return render_error(request, _('Internal server error. Please contact system administrator.'))

    username = request.user.username
    if request.user.enc_password == '!':
        return render_error(request, 'Failed to unbind SAML, please set a password first.')
    profile = Profile.objects.get_profile_by_user(username)
    if not profile or not (profile.contact_email or profile.phone):
        return render_error(request, 'Failed to unbind SAML, please set a contact email first.')

    SocialAuthUser.objects.delete_by_username_and_provider(username, SAML_PROVIDER_IDENTIFIER)
    next_url = request.GET.get(auth.REDIRECT_FIELD_NAME, LOGIN_REDIRECT_URL)
    return HttpResponseRedirect(next_url)


@login_required
def saml_complete(request):
    from seahub.api2.utils import get_token_v1, get_token_v2
    # generate token_v2 using information in request params
    keys = (
        'platform',
        'device_id',
        'device_name',
        'client_version',
        'platform_version',
    )
    if all(['shib_' + key in request.GET for key in keys]):
        platform = request.GET['shib_platform']
        device_id = request.GET['shib_device_id']
        device_name = request.GET['shib_device_name']
        client_version = request.GET['shib_client_version']
        platform_version = request.GET['shib_platform_version']
        token = get_token_v2(
            request, request.user.username, platform, device_id,
            device_name, client_version, platform_version)
    elif all(['shib_' + key in request.session for key in keys]):
        platform = request.session['shib_platform']
        device_id = request.session['shib_device_id']
        device_name = request.session['shib_device_name']
        client_version = request.session['shib_client_version']
        platform_version = request.session['shib_platform_version']
        token = get_token_v2(
            request, request.user.username, platform, device_id,
            device_name, client_version, platform_version)
    else:
        token = get_token_v1(request.user.username)

    resp = HttpResponseRedirect(reverse('dtable'))
    resp.set_cookie('seahub_auth', request.user.username + '@' + token.key)

    if request.user.is_authenticated:
        if request.user.is_staff:
            update_sudo_mode_ts(request)

    return resp


class SamlLogoutView(LogoutView):
    def do_logout_service(self, request, data, binding, *args, **kwargs):
        return super(SamlLogoutView, self).do_logout_service(request, data, binding)
