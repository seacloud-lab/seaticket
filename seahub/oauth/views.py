# -*- coding: utf-8 -*-

import os
import sys
import logging
from django.http import HttpResponseRedirect, HttpResponse
from django.utils.translation import gettext as _

from seahub import auth
from seahub.auth.models import SocialAuthUser
from seahub.profile.models import Profile
from seahub.utils import render_error, uuid_str_to_32_chars
from seahub.project.models import IdInOrgTuple, BoundThirdPartyAccounts, _encrypt_detail
from seahub.base.accounts import User
import seahub.settings as settings
from seahub.api2.utils import get_api_token
from requests_oauthlib import OAuth2Session
from django.shortcuts import render

logger = logging.getLogger(__name__)
#### OAuth Global Settings
OAUTHLIB_INSECURE_TRANSPORT = getattr(settings, 'OAUTH_ENABLE_INSECURE_TRANSPORT', False)
if OAUTHLIB_INSECURE_TRANSPORT:
    os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
os.environ['OAUTHLIB_RELAX_TOKEN_SCOPE'] = '1'

#### OAuth Login to Seatable
ENABLE_OAUTH = getattr(settings, 'ENABLE_OAUTH', False)
IS_PRO_VERSION = getattr(settings, 'IS_PRO_VERSION', False)
if ENABLE_OAUTH and IS_PRO_VERSION:

    # Used for oauth workflow.
    CLIENT_ID = getattr(settings, 'OAUTH_CLIENT_ID', '')
    CLIENT_SECRET = getattr(settings, 'OAUTH_CLIENT_SECRET', '')
    AUTHORIZATION_URL = getattr(settings, 'OAUTH_AUTHORIZATION_URL', '')
    REDIRECT_URL = getattr(settings, 'OAUTH_REDIRECT_URL', '')
    TOKEN_URL = getattr(settings, 'OAUTH_TOKEN_URL', '')
    USER_INFO_URL = getattr(settings, 'OAUTH_USER_INFO_URL', '')
    SCOPE = getattr(settings, 'OAUTH_SCOPE', '')
    ACCESS_TOKEN_IN_URI = getattr(settings, 'OAUTH_ACCESS_TOKEN_IN_URI', False)

    # Used for init an user for SeaTable.
    PROVIDER_DOMAIN = getattr(settings, 'OAUTH_PROVIDER_DOMAIN', '')
    OAUTH_ATTRIBUTE_MAP = getattr(settings, 'OAUTH_ATTRIBUTE_MAP', {})

ENABLE_CUSTOM_OAUTH = getattr(settings, 'ENABLE_CUSTOM_OAUTH', False)
if ENABLE_CUSTOM_OAUTH:
    try:
        current_path = os.path.dirname(os.path.abspath(__file__))
        conf_dir = os.path.join(current_path, '../../../../conf')
        sys.path.append(conf_dir)
        from seatable_custom_functions.custom_oauth import custom_oauth_login, custom_oauth_callback
        ENABLE_CUSTOM_OAUTH = True
    except ImportError:
        ENABLE_CUSTOM_OAUTH = False


def oauth_check(func):
    """ Decorator for check if OAuth valid.
    """

    def _decorated(request):

        error = False
        if not IS_PRO_VERSION or not ENABLE_OAUTH:
            logger.error('OAuth not enabled.')
            error = True
        else:
            if not CLIENT_ID or not CLIENT_SECRET or not AUTHORIZATION_URL \
                    or not REDIRECT_URL or not TOKEN_URL or not USER_INFO_URL \
                    or not OAUTH_ATTRIBUTE_MAP or not PROVIDER_DOMAIN:
                logger.error('OAuth relevant settings invalid.')
                logger.error('CLIENT_ID: %s' % CLIENT_ID)
                logger.error('CLIENT_SECRET: %s' % CLIENT_SECRET)
                logger.error('AUTHORIZATION_URL: %s' % AUTHORIZATION_URL)
                logger.error('REDIRECT_URL: %s' % REDIRECT_URL)
                logger.error('TOKEN_URL: %s' % TOKEN_URL)
                logger.error('USER_INFO_URL: %s' % USER_INFO_URL)
                logger.error('OAUTH_ATTRIBUTE_MAP: %s' % OAUTH_ATTRIBUTE_MAP)
                logger.error('PROVIDER_DOMAIN: %s' % PROVIDER_DOMAIN)
                error = True

        if error:
            return render_error(request,
                                _('Error, please contact administrator.'))

        return func(request)

    return _decorated


# https://requests-oauthlib.readthedocs.io/en/latest/examples/github.html
# https://requests-oauthlib.readthedocs.io/en/latest/examples/google.html
@oauth_check
def oauth_login(request):
    """Step 1: User Authorization.
    Redirect the user/resource owner to the OAuth provider (i.e. Github)
    using an URL with a few key OAuth parameters.
    """
    session = OAuth2Session(client_id=CLIENT_ID,
                            scope=SCOPE,
                            redirect_uri=REDIRECT_URL)

    try:
        authorization_url, state = session.authorization_url(AUTHORIZATION_URL)
    except Exception as e:
        logger.error(e)
        return render_error(request, _('Error, please contact administrator.'))

    request.session['oauth_state'] = state
    request.session['oauth_redirect'] = request.GET.get(
        auth.REDIRECT_FIELD_NAME, '/')
    return HttpResponseRedirect(authorization_url)


# Step 2: User authorization, this happens on the provider.
@oauth_check
def oauth_callback(request):
    """ Step 3: Retrieving an access token.
    The user has been redirected back from the provider to your registered
    callback URL. With this redirection comes an authorization code included
    in the redirect URL. We will use that to obtain an access token.
    """
    session = OAuth2Session(client_id=CLIENT_ID,
                            scope=SCOPE,
                            state=request.session.get('oauth_state', None),
                            redirect_uri=REDIRECT_URL)

    try:
        token = session.fetch_token(
            TOKEN_URL,
            client_secret=CLIENT_SECRET,
            authorization_response=settings.DTABLE_WEB_SERVICE_URL + request.get_full_path().split('/', 1)[1])

        # Remove comment in the next line to get detailed information about "token from IdP" in dtable_web.log
        #logger.error('DEBUG TOKEN: %s' % token)

        if 'user_id' in session._client.__dict__['token']:
            # used for sjtu.edu.cn
            # https://xjq12311.gitbooks.io/sjtu-engtc/content/
            user_id = session._client.__dict__['token']['user_id']
            user_info_resp = session.get(USER_INFO_URL +
                                         '?user_id=%s' % user_id)
        else:
            user_info_url = USER_INFO_URL
            if ACCESS_TOKEN_IN_URI:
                code = request.GET.get('code')
                user_info_url = USER_INFO_URL + '?access_token=%s&code=%s' % (
                    token['access_token'], code)
            user_info_resp = session.get(user_info_url)

    except Exception as e:
        logger.error(e)
        return render_error(request, _('Error, please contact administrator: token might be expired or security code is not valid.'))

    oauth_user_info = {}
    user_info_json = user_info_resp.json()

    # Remove comment in the next line to get detailed information about "oauth session values" in dtable_web.log
    #logger.error('DEBUG OAUTH SESSION: %s' % user_info_json)

    for oauth_key, seatable_key in OAUTH_ATTRIBUTE_MAP.items():
        if seatable_key == 'uid':
            oauth_user_info['uid'] = user_info_json.get(oauth_key, '')
        if seatable_key == 'name':
            oauth_user_info['nickname'] = user_info_json.get(oauth_key, '')
        if seatable_key == 'contact_email':
            oauth_user_info['contact_email'] = user_info_json.get(oauth_key, '')
        if seatable_key == 'user_role':
            oauth_user_info['user_role'] = user_info_json.get(oauth_key, '')
        if seatable_key == 'employee_id':
            oauth_user_info['id_in_org'] = user_info_json.get(oauth_key, '')

    uid = oauth_user_info['uid']
    if not uid:
        logger.error('oauth user uid not found.')
        logger.error('user_info_json: %s' % user_info_json)
        return render_error(request, _('Error, please contact administrator.'))

    oauth_user = SocialAuthUser.objects.get_by_provider_and_uid(PROVIDER_DOMAIN, uid)
    if oauth_user:
        username = oauth_user.username
        is_new_user = False
    else:
        username = None
        is_new_user = True

    try:
        user = auth.authenticate(oauth_username=username)
    except User.DoesNotExist:
        user = None
    except Exception as e:
        logger.error(e)
        return render_error(request, _('Error, please contact administrator.'))

    if not user:
        return render_error(request, _('Error, new user registration is not allowed, please contact administrator.'))

    username = user.username
    if is_new_user:
        SocialAuthUser.objects.add(username, PROVIDER_DOMAIN, uid)

    profile = Profile.objects.get_profile_by_user(username)
    if not profile:
        profile = Profile(user=username)

    # update user's profile with nickname and contact_email
    nickname = oauth_user_info.get('nickname', '')
    contact_email = oauth_user_info.get('contact_email', '')
    try:
        if nickname:
            profile.nickname = nickname.strip()
            profile.save()

        if contact_email:
            profile.contact_email = contact_email.strip()
            profile.save()
    except Exception as e:
        logger.error(e)
        return render_error(request, _('Error, please contact administrator: contact_email must be unique and might already be in use.'))

    # assign user role
    user_role = oauth_user_info.get('user_role', '')
    if user_role:
        User.objects.update_role(username, user_role)

    # assign id_in_org
    id_in_org = oauth_user_info.get('id_in_org', '')
    org_id = -1
    orgs = ccnet_api.get_orgs_by_user(username)
    if orgs:
        org_id = orgs[0].org_id
    if id_in_org:
        IdInOrgTuple.objects.add_or_update(username, id_in_org, org_id)

    if not user.is_active:
        return render_error(
            request, _('Your account is created successfully, please wait for administrator to activate your account.'))

    # User is valid.  Set request.user and persist user in the session
    # by logging the user in.
    request.user = user
    auth.login(request, user)

    # generate auth token for Seafile client
    api_token = get_api_token(request)

    # redirect user to home page
    response = HttpResponseRedirect(request.session['oauth_redirect'])
    response.set_cookie('seahub_auth', user.username + '@' + api_token.key)
    response.set_cookie('via_oauth', 'true')
    return response


### Custom OAuth Login
def custom_oauth_login_view(request):
    if not ENABLE_CUSTOM_OAUTH:
        return render_error(request, _('Feature is not enabled.'))

    if request.user.is_authenticated:
        # already authenticated
        redirect_url = request.GET.get(auth.REDIRECT_FIELD_NAME, settings.LOGIN_REDIRECT_URL)
        return HttpResponseRedirect(redirect_url)

    return custom_oauth_login(request)


def custom_oauth_callback_view(request):
    if not ENABLE_CUSTOM_OAUTH:
        return render_error(request, _('Feature is not enabled.'))

    return custom_oauth_callback(request)

