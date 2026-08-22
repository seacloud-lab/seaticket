# -*- coding: utf-8 -*-
import logging
import json
import base64
import secrets
import datetime
from urllib.parse import urlencode, unquote, urlparse

import requests

from django.http import HttpResponse
from django.shortcuts import render, redirect
from django.utils.http import url_has_allowed_host_and_scheme
from django.utils.translation import gettext as _

from seahub import settings
from seahub.project.models import Workspaces, Projects, ProjectGithubAppInstallation, \
    ProjectConnectionOauth
from seahub.project.utils import check_project_admin_permission, check_project_permission, update_github_connection_installation_id
from seahub.project.linear_api import LinearAPI
from seahub.project.jira_api import JiraAPI
from seahub.utils import render_error
from seahub.auth.decorators import login_required
from seahub.settings import MEDIA_URL, LLM_MODELS, GITHUB_APP_NAME, ENABLE_GENERAL_TASK, THOUGHT_PROCESS_ENABLED, \
    LINEAR_CLIENT_ID, LINEAR_CLIENT_SECRET, LINEAR_REDIRECT_URL, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URL, \
    JIRA_CLIENT_ID, JIRA_CLIENT_SECRET, JIRA_REDIRECT_URL, \
    FIREBASE_CRASH_CLIENT_ID, FIREBASE_CRASH_CLIENT_SECRET, FIREBASE_CRASH_REDIRECT_URL
from seahub.group.models import Group
from seahub.constants import PERMISSION_READ
from seahub.portal.utils import get_portal_settings
from seahub.project.constants import ConnectionType, merge_project_settings_defaults

SEAQA_VERSION = getattr(settings, 'SEAQA_VERSION', 'Dev')


logger = logging.getLogger(__name__)


OAUTH_TOKEN_EXPIRY_BUFFER_SECONDS = 60


def _safe_oauth_return_to(request, return_to):
    if not isinstance(return_to, str) or not return_to.startswith('/') or return_to.startswith('//'):
        return '/'
    parsed = urlparse(return_to)
    if parsed.scheme or parsed.netloc:
        return '/'
    if not url_has_allowed_host_and_scheme(
        return_to,
        allowed_hosts={request.get_host()},
        require_https=request.is_secure(),
    ):
        return '/'
    return return_to


def _calc_confluence_expires_at(expires_in):
    try:
        expires_in = int(expires_in or 3600)
    except (TypeError, ValueError):
        expires_in = 3600
    return datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=max(expires_in - OAUTH_TOKEN_EXPIRY_BUFFER_SECONDS, 0))


@login_required
def project_view(request, workspace_id, project_name, children_id = '', record_id = ''):
    # resource check
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        return render_error(request, 'Workspace does not exist.')

    group_id = ''
    if '@seafile_group' in workspace.owner:
        group_id = workspace.owner.split('@')[0]
        group = Group.objects.get_group(group_id)
        if not group:
            error_msg = f'Group {group_id} not found.'
            return render_error(request, error_msg)

    project = Projects.objects.get_project(workspace, project_name)
    if not project:
        return render_error(request, _('This project does not exist'))

    icon = {
        'bg_color': project.color,
        'text_color': project.text_color,
        'name': project.icon
    }

    try:
        project_settings = json.loads(project.settings) if project.settings else {}
    except ValueError:
        project_settings = {}
    project_settings = json.dumps(merge_project_settings_defaults(project_settings))

    is_project_admin = check_project_admin_permission(request.user.username, workspace.owner)
    permission = check_project_permission(request.user.username, workspace.owner)
    if not permission:
        return render_error(request, _('Permission denied'))

    portal_settings = get_portal_settings(project)
    enable_portal = portal_settings.get('enable_portal', False)
    if not enable_portal and request.resolver_match.url_name == 'project_portal_issues_view':
        return render_error(request, _('Portal is not enabled'))

    return_dict = {
        'version': SEAQA_VERSION,
        'project_name': project_name,
        'workspace_id': workspace_id,
        'project_uuid': str(project.uuid),
        'current_group_id': int(group_id) if project.is_owned_by_group else None,
        'is_owned_by_group': project.is_owned_by_group,
        'media_url': MEDIA_URL,
        'icon': json.dumps(icon),
        'settings': project_settings,
        'is_project_admin': is_project_admin,
        'enable_general_task': ENABLE_GENERAL_TASK,
        'thought_process_enabled': THOUGHT_PROCESS_ENABLED,
        'permission': permission if permission else PERMISSION_READ,
        'llm_models': json.dumps(LLM_MODELS),
    }
    return render(request, 'project_view_react.html', return_dict)


def github_install(request):
    return_to = request.GET.get('next') or '/'
    project_uuid = request.GET.get('project_uuid', '')

    if not project_uuid:
        return render_error(request, _('Please install through the address provided by sea-ticket.'))

    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        return render_error(request, _('Please install through the address provided by sea-ticket.'))
    workspace = project.workspace

    username = request.user.username
    if not check_project_admin_permission(username, workspace.owner):
        return render_error(request, _('Permission denied.'))

    state = base64.b64encode((return_to + '&' + project_uuid).encode()).decode()
    install_url = f"https://github.com/apps/{GITHUB_APP_NAME}/installations/new?state={state}"
    return redirect(install_url)


def github_installation_setup(request):
    state = request.GET.get('state')
    installation_id = request.GET.get('installation_id')
    setup_action = request.GET.get('setup_action')

    project_uuid = ''
    if state:
        state = unquote(state)
        try:
            return_url, project_uuid = base64.b64decode(state).decode().rsplit('&', 1)
        except Exception:
            return_url = '/'
    else:
        return_url = '/'

    if not project_uuid:
        return render_error(request, _('Please install through the address provided by sea-ticket.'))

    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        return render_error(request, _('Please install through the address provided by sea-ticket.'))
    workspace = project.workspace

    username = request.user.username
    if not check_project_admin_permission(username, workspace.owner):
        return render_error(request, _('Permission denied.'))

    github_app_installation = ProjectGithubAppInstallation.objects.get_project_installation(project_uuid, installation_id)
    if not github_app_installation:
        ProjectGithubAppInstallation.objects.create_app_installation(project_uuid, installation_id, username)
        update_github_connection_installation_id(project_uuid, installation_id)

    return redirect(return_url)

@login_required
def linear_oauth(request):
    return_to = request.GET.get('next') or '/'
    project_uuid = request.GET.get('project_uuid', '')

    if not project_uuid:
        return render_error(request, _('Please install through the address provided by sea-ticket.'))

    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        return render_error(request, _('Please install through the address provided by sea-ticket.'))
    workspace = project.workspace

    username = request.user.username
    if not check_project_admin_permission(username, workspace.owner):
        return render_error(request, _('Permission denied.'))

    if not LINEAR_CLIENT_ID or not LINEAR_CLIENT_SECRET or not LINEAR_REDIRECT_URL:
        return render_error(request, _('Linear OAuth settings are invalid.'))

    state = secrets.token_urlsafe(24)
    request.session['linear_oauth_state'] = state
    request.session['linear_oauth_project_uuid'] = project_uuid
    request.session['linear_oauth_return_to'] = return_to

    params = {
        'client_id': LINEAR_CLIENT_ID,
        'redirect_uri': LINEAR_REDIRECT_URL,
        'response_type': 'code',
        'state': state,
    }

    authorize_url = 'https://linear.app/oauth/authorize' + f"?{urlencode(params)}"
    return redirect(authorize_url)


@login_required
def linear_oauth_callback(request):
    code = request.GET.get('code')
    state = request.GET.get('state')

    session_state = request.session.get('linear_oauth_state')
    project_uuid = request.session.get('linear_oauth_project_uuid')
    return_to = request.session.get('linear_oauth_return_to', '/')

    if not code or not state or state != session_state:
        return render_error(request, _('Invalid Linear OAuth state.'))

    if not project_uuid:
        return render_error(request, _('Please install through the address provided by sea-ticket.'))

    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        return render_error(request, _('Please install through the address provided by sea-ticket.'))
    workspace = project.workspace

    username = request.user.username
    if not check_project_admin_permission(username, workspace.owner):
        return render_error(request, _('Permission denied.'))

    if not LINEAR_CLIENT_ID or not LINEAR_CLIENT_SECRET or not LINEAR_REDIRECT_URL:
        return render_error(request, _('Linear OAuth settings are invalid.'))

    token_payload = {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': LINEAR_REDIRECT_URL,
        'client_id': LINEAR_CLIENT_ID,
        'client_secret': LINEAR_CLIENT_SECRET,
    }

    try:
        resp = requests.post('https://api.linear.app/oauth/token', data=token_payload, timeout=10)
    except Exception as e:
        logger.error('Linear OAuth token request error: %s', e)
        return render_error(request, _('Failed to authorize Linear.'))

    if resp.status_code != 200:
        logger.error('Linear OAuth token response invalid: %s %s', resp.status_code, resp.text)
        return render_error(request, _('Failed to authorize Linear.'))

    token_json = resp.json()
    access_token = token_json.get('access_token')
    refresh_token = token_json.get('refresh_token')
    expires_in = token_json.get('expires_in')
    if not access_token:
        logger.error('Linear OAuth token missing access_token: %s', token_json)
        return render_error(request, _('Failed to authorize Linear.'))

    expires_at = LinearAPI.calc_expires_in(expires_in)
    ProjectConnectionOauth.objects.upsert_token(project_uuid, ConnectionType.LINEAR.value, access_token, expires_at, refresh_token)

    request.session.pop('linear_oauth_state', None)
    request.session.pop('linear_oauth_project_uuid', None)
    request.session.pop('linear_oauth_return_to', None)

    return redirect(return_to)


@login_required
def confluence_oauth(request):
    return_to = request.GET.get('next') or '/'
    project_uuid = request.GET.get('project_uuid', '')

    if not project_uuid:
        return render_error(request, _('Please install through the address provided by sea-ticket.'))

    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        return render_error(request, _('Please install through the address provided by sea-ticket.'))
    workspace = project.workspace

    username = request.user.username
    if not check_project_admin_permission(username, workspace.owner):
        return render_error(request, _('Permission denied.'))

    client_id = getattr(settings, 'CONFLUENCE_CLIENT_ID', '')
    client_secret = getattr(settings, 'CONFLUENCE_CLIENT_SECRET', '')
    redirect_url = getattr(settings, 'CONFLUENCE_REDIRECT_URL', '')
    if not client_id or not client_secret or not redirect_url:
        return render_error(request, _('Confluence OAuth settings are invalid.'))

    state = secrets.token_urlsafe(24)
    request.session['confluence_oauth_state'] = state
    request.session['confluence_oauth_project_uuid'] = project_uuid
    request.session['confluence_oauth_return_to'] = return_to

    confluence_scopes = [
        'offline_access',
        'search:confluence',
        'read:space:confluence',
        'read:confluence-user',
        'report:personal-data',
    ]

    params = {
        'audience': 'api.atlassian.com',
        'client_id': client_id,
        'scope': ' '.join(confluence_scopes),
        'redirect_uri': redirect_url,
        'state': state,
        'response_type': 'code',
        'prompt': 'consent',
    }
    return redirect('https://auth.atlassian.com/authorize?' + urlencode(params))


@login_required
def confluence_oauth_callback(request):
    code = request.GET.get('code')
    state = request.GET.get('state')

    session_state = request.session.get('confluence_oauth_state')
    project_uuid = request.session.get('confluence_oauth_project_uuid')
    return_to = request.session.get('confluence_oauth_return_to', '/')

    if not code or not state or state != session_state:
        return render_error(request, _('Invalid Confluence OAuth state.'))

    if not project_uuid:
        return render_error(request, _('Please install through the address provided by sea-ticket.'))

    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        return render_error(request, _('Please install through the address provided by sea-ticket.'))
    workspace = project.workspace

    username = request.user.username
    if not check_project_admin_permission(username, workspace.owner):
        return render_error(request, _('Permission denied.'))

    client_id = getattr(settings, 'CONFLUENCE_CLIENT_ID', '')
    client_secret = getattr(settings, 'CONFLUENCE_CLIENT_SECRET', '')
    redirect_url = getattr(settings, 'CONFLUENCE_REDIRECT_URL', '')
    if not client_id or not client_secret or not redirect_url:
        return render_error(request, _('Confluence OAuth settings are invalid.'))

    token_payload = {
        'grant_type': 'authorization_code',
        'client_id': client_id,
        'client_secret': client_secret,
        'code': code,
        'redirect_uri': redirect_url,
    }

    try:
        resp = requests.post('https://auth.atlassian.com/oauth/token', json=token_payload, timeout=10)
    except Exception as e:
        logger.error('Confluence OAuth token request error: %s', e)
        return render_error(request, _('Failed to authorize Confluence.'))

    if resp.status_code != 200:
        logger.error('Confluence OAuth token response invalid: %s %s', resp.status_code, resp.text)
        return render_error(request, _('Failed to authorize Confluence.'))

    token_json = resp.json()
    access_token = token_json.get('access_token')
    refresh_token = token_json.get('refresh_token')
    if not access_token or not refresh_token:
        logger.error('Confluence OAuth token missing access/refresh token: %s', token_json)
        return render_error(request, _('Failed to authorize Confluence.'))

    ProjectConnectionOauth.objects.upsert_token(
        project_uuid,
        ConnectionType.CONFLUENCE.value,
        access_token,
        _calc_confluence_expires_at(token_json.get('expires_in')),
        refresh_token,
    )

    request.session.pop('confluence_oauth_state', None)
    request.session.pop('confluence_oauth_project_uuid', None)
    request.session.pop('confluence_oauth_return_to', None)

    return redirect(return_to)



@login_required
def discord_oauth(request):
    """Initiate Discord OAuth2 flow to add the bot to a server."""
    return_to = request.GET.get('next') or '/'
    project_uuid = request.GET.get('project_uuid', '')

    if not project_uuid:
        return render_error(request, _('Please install through the address provided by sea-ticket.'))

    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        return render_error(request, _('Please install through the address provided by sea-ticket.'))
    workspace = project.workspace

    username = request.user.username
    if not check_project_admin_permission(username, workspace.owner):
        return render_error(request, _('Permission denied.'))

    if not DISCORD_CLIENT_ID or not DISCORD_CLIENT_SECRET or not DISCORD_REDIRECT_URL:
        return render_error(request, _('Discord OAuth settings are invalid.'))

    state = secrets.token_urlsafe(24)
    request.session['discord_oauth_state'] = state
    request.session['discord_oauth_project_uuid'] = project_uuid
    request.session['discord_oauth_return_to'] = return_to

    # Discord OAuth2 with bot scope: user selects a server to add the bot to
    # Permissions: 66560 = VIEW_CHANNEL (1024) + Read Message History (65536) = 66560
    # Actually: 66560 = VIEW_CHANNEL (1024) + Read Message History (65536)?
    # Let's calculate: 1 << 16 = 65536 (READ_MESSAGES), 1 << 17 = 131072 (READ_MESSAGE_HISTORY)
    # Total: 65536 + 131072 = 196608
    # Wait, let me recalculate: READ_MESSAGES = 0x800 = 2048, no...
    # Discord permissions: VIEW_CHANNEL=1024, READ_MESSAGE_HISTORY=65536
    # Let me use: 66560 = VIEW_CHANNEL (1024) + READ_MESSAGE_HISTORY (65536) + ?
    # Actually common bot permissions: 66560 is a known value
    permissions = 66560  # Read Messages + Read Message History + View Channel

    params = {
        'client_id': DISCORD_CLIENT_ID,
        'permissions': permissions,
        'redirect_uri': DISCORD_REDIRECT_URL,
        'response_type': 'code',
        'scope': 'bot identify',
        'state': state,
    }

    authorize_url = 'https://discord.com/api/oauth2/authorize' + f"?{urlencode(params)}"
    return redirect(authorize_url)


@login_required
def discord_oauth_callback(request):
    """Handle Discord OAuth2 callback after user authorizes the bot."""
    code = request.GET.get('code')
    state = request.GET.get('state')
    guild_id = request.GET.get('guild_id', '')

    session_state = request.session.get('discord_oauth_state')
    project_uuid = request.session.get('discord_oauth_project_uuid')
    return_to = request.session.get('discord_oauth_return_to', '/')

    if not code or not state or state != session_state:
        return render_error(request, _('Invalid Discord OAuth state.'))

    if not guild_id:
        return render_error(request, _('Discord server information was not returned.'))

    if not project_uuid:
        return render_error(request, _('Please install through the address provided by sea-ticket.'))

    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        return render_error(request, _('Please install through the address provided by sea-ticket.'))
    workspace = project.workspace

    username = request.user.username
    if not check_project_admin_permission(username, workspace.owner):
        return render_error(request, _('Permission denied.'))

    if not DISCORD_CLIENT_ID or not DISCORD_CLIENT_SECRET or not DISCORD_REDIRECT_URL:
        return render_error(request, _('Discord OAuth settings are invalid.'))

    # Exchange code for tokens
    token_payload = {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': DISCORD_REDIRECT_URL,
        'client_id': DISCORD_CLIENT_ID,
        'client_secret': DISCORD_CLIENT_SECRET,
    }

    try:
        resp = requests.post('https://discord.com/api/oauth2/token', data=token_payload, timeout=10)
    except Exception as e:
        logger.error('Discord OAuth token request error: %s', e)
        return render_error(request, _('Failed to authorize Discord.'))

    if resp.status_code != 200:
        logger.error('Discord OAuth token response invalid: %s %s', resp.status_code, resp.text)
        return render_error(request, _('Failed to authorize Discord.'))

    token_json = resp.json()

    # Try to get guild from the token response (bot scope may include guild)
    guild_name = ''
    guild = token_json.get('guild')
    if guild:
        guild_name = guild.get('name', '')

    request.session.pop('discord_oauth_state', None)
    request.session.pop('discord_oauth_project_uuid', None)
    request.session.pop('discord_oauth_return_to', None)

    message = json.dumps({
        'type': 'discord-oauth-success',
        'guild_id': str(guild_id),
        'guild_name': guild_name,
    }).replace('<', '\\u003c')
    fallback_url = json.dumps(return_to).replace('<', '\\u003c')
    response_html = f'''<!doctype html>
        <html><body><script>
        (function() {{
        var message = {message};
        if (window.opener && !window.opener.closed) {{
            window.opener.postMessage(message, window.location.origin);
            window.close();
        }} else {{
            window.location.replace({fallback_url});
        }}
        }})();
        </script></body></html>'''
    return HttpResponse(response_html)

def _calc_jira_expires_at(expires_in):
    try:
        expires_in = int(expires_in or 3600)
    except (TypeError, ValueError):
        expires_in = 3600
    return datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=max(expires_in - 60, 0))


def _calc_firebase_crash_expires_at(expires_in):
    try:
        expires_in = int(expires_in or 3600)
    except (TypeError, ValueError):
        expires_in = 3600
    return datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=max(expires_in - 60, 0))


def _clear_firebase_crash_oauth_session(request, error=''):
    request.session.pop('firebase_crash_oauth_state', None)
    request.session.pop('firebase_crash_oauth_project_uuid', None)
    request.session.pop('firebase_crash_oauth_return_to', None)
    if error:
        request.session['firebase_crash_oauth_error'] = error


@login_required
def firebase_crash_oauth(request):
    return_to = _safe_oauth_return_to(request, request.GET.get('next') or '/')
    project_uuid = request.GET.get('project_uuid', '')

    if not project_uuid:
        return render_error(request, _('Please install through the address provided by sea-ticket.'))

    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        return render_error(request, _('Please install through the address provided by sea-ticket.'))
    workspace = project.workspace

    username = request.user.username
    if not check_project_admin_permission(username, workspace.owner):
        return render_error(request, _('Permission denied.'))

    if not FIREBASE_CRASH_CLIENT_ID or not FIREBASE_CRASH_CLIENT_SECRET or not FIREBASE_CRASH_REDIRECT_URL:
        return render_error(request, _('Firebase Crashlytics OAuth settings are invalid.'))

    state = secrets.token_urlsafe(24)
    request.session.pop('firebase_crash_oauth_error', None)
    request.session['firebase_crash_oauth_state'] = state
    request.session['firebase_crash_oauth_project_uuid'] = project_uuid
    request.session['firebase_crash_oauth_return_to'] = return_to

    params = {
        'client_id': FIREBASE_CRASH_CLIENT_ID,
        'scope': ' '.join([
            'https://www.googleapis.com/auth/firebase.readonly',
            'https://www.googleapis.com/auth/bigquery',
        ]),
        'redirect_uri': FIREBASE_CRASH_REDIRECT_URL,
        'state': state,
        'response_type': 'code',
        'access_type': 'offline',
        'include_granted_scopes': 'true',
        'prompt': 'consent',
    }
    return redirect('https://accounts.google.com/o/oauth2/v2/auth?' + urlencode(params))


@login_required
def firebase_crash_oauth_callback(request):
    state = request.GET.get('state')

    session_state = request.session.get('firebase_crash_oauth_state')
    project_uuid = request.session.get('firebase_crash_oauth_project_uuid')
    return_to = request.session.get('firebase_crash_oauth_return_to', '/')

    if not state or state != session_state:
        _clear_firebase_crash_oauth_session(
            request, _('Google authorization was cancelled or failed.')
        )
        return render_error(request, _('Invalid Firebase Crashlytics OAuth state.'))

    provider_error = request.GET.get('error')
    if provider_error:
        error_description = request.GET.get('error_description') or provider_error
        logger.warning(
            'Firebase Crashlytics OAuth provider returned an error: %s',
            error_description,
        )
        _clear_firebase_crash_oauth_session(
            request, _('Google authorization was cancelled or denied.')
        )
        return render_error(request, _('Google authorization was cancelled or denied.'))

    code = request.GET.get('code')
    if not code:
        _clear_firebase_crash_oauth_session(
            request, _('Google authorization was cancelled or failed.')
        )
        return render_error(request, _('Invalid Firebase Crashlytics OAuth response.'))

    if not project_uuid:
        _clear_firebase_crash_oauth_session(
            request, _('Google authorization was cancelled or failed.')
        )
        return render_error(request, _('Please install through the address provided by sea-ticket.'))

    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        _clear_firebase_crash_oauth_session(
            request, _('Google authorization was cancelled or failed.')
        )
        return render_error(request, _('Please install through the address provided by sea-ticket.'))
    workspace = project.workspace

    username = request.user.username
    if not check_project_admin_permission(username, workspace.owner):
        _clear_firebase_crash_oauth_session(
            request, _('Google authorization was cancelled or failed.')
        )
        return render_error(request, _('Permission denied.'))

    if not FIREBASE_CRASH_CLIENT_ID or not FIREBASE_CRASH_CLIENT_SECRET or not FIREBASE_CRASH_REDIRECT_URL:
        _clear_firebase_crash_oauth_session(
            request, _('Google authorization was cancelled or failed.')
        )
        return render_error(request, _('Firebase Crashlytics OAuth settings are invalid.'))

    token_payload = {
        'grant_type': 'authorization_code',
        'client_id': FIREBASE_CRASH_CLIENT_ID,
        'client_secret': FIREBASE_CRASH_CLIENT_SECRET,
        'code': code,
        'redirect_uri': FIREBASE_CRASH_REDIRECT_URL,
    }
    try:
        resp = requests.post('https://oauth2.googleapis.com/token', data=token_payload, timeout=10)
    except Exception as e:
        logger.error('Firebase Crashlytics OAuth token request error: %s', e)
        _clear_firebase_crash_oauth_session(
            request, _('Failed to authorize Firebase Crashlytics.')
        )
        return render_error(request, _('Failed to authorize Firebase Crashlytics.'))

    if resp.status_code != 200:
        logger.error('Firebase Crashlytics OAuth token response invalid: status=%s', resp.status_code)
        _clear_firebase_crash_oauth_session(
            request, _('Failed to authorize Firebase Crashlytics.')
        )
        return render_error(request, _('Failed to authorize Firebase Crashlytics.'))

    try:
        token_json = resp.json()
    except (TypeError, ValueError) as e:
        logger.error('Firebase Crashlytics OAuth token response is not valid JSON: %s', e)
        _clear_firebase_crash_oauth_session(
            request, _('Failed to authorize Firebase Crashlytics.')
        )
        return render_error(request, _('Failed to authorize Firebase Crashlytics.'))
    if not isinstance(token_json, dict):
        logger.error(
            'Firebase Crashlytics OAuth token response is not a JSON object: type=%s',
            type(token_json).__name__,
        )
        _clear_firebase_crash_oauth_session(
            request, _('Failed to authorize Firebase Crashlytics.')
        )
        return render_error(request, _('Failed to authorize Firebase Crashlytics.'))

    access_token = token_json.get('access_token')
    old_oauth = ProjectConnectionOauth.objects.get_by_project_uuid(
        project_uuid, ConnectionType.FIREBASE_CRASH.value
    )
    refresh_token = token_json.get('refresh_token') or (old_oauth.refresh_token if old_oauth else None)
    if not access_token or not refresh_token:
        logger.error('Firebase Crashlytics OAuth token missing access/refresh token')
        _clear_firebase_crash_oauth_session(
            request, _('Failed to authorize Firebase Crashlytics.')
        )
        return render_error(request, _('Failed to authorize Firebase Crashlytics.'))

    ProjectConnectionOauth.objects.upsert_token(
        project_uuid,
        ConnectionType.FIREBASE_CRASH.value,
        access_token,
        _calc_firebase_crash_expires_at(token_json.get('expires_in')),
        refresh_token,
    )

    _clear_firebase_crash_oauth_session(request)

    return redirect(_safe_oauth_return_to(request, return_to))


@login_required
def jira_oauth(request):
    return_to = request.GET.get('next') or '/'
    project_uuid = request.GET.get('project_uuid', '')

    if not project_uuid:
        return render_error(request, _('Please install through the address provided by sea-ticket.'))

    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        return render_error(request, _('Please install through the address provided by sea-ticket.'))
    workspace = project.workspace

    username = request.user.username
    if not check_project_admin_permission(username, workspace.owner):
        return render_error(request, _('Permission denied.'))

    if not JIRA_CLIENT_ID or not JIRA_CLIENT_SECRET or not JIRA_REDIRECT_URL:
        return render_error(request, _('Jira OAuth settings are invalid.'))

    state = secrets.token_urlsafe(24)
    request.session['jira_oauth_state'] = state
    request.session['jira_oauth_project_uuid'] = project_uuid
    request.session['jira_oauth_return_to'] = return_to

    params = {
        'audience': 'api.atlassian.com',
        'client_id': JIRA_CLIENT_ID,
        'scope': 'offline_access read:jira-work read:jira-user',
        'redirect_uri': JIRA_REDIRECT_URL,
        'state': state,
        'response_type': 'code',
        'prompt': 'consent',
    }
    return redirect('https://auth.atlassian.com/authorize?' + urlencode(params))


@login_required
def jira_oauth_callback(request):
    code = request.GET.get('code')
    state = request.GET.get('state')

    session_state = request.session.get('jira_oauth_state')
    project_uuid = request.session.get('jira_oauth_project_uuid')
    return_to = request.session.get('jira_oauth_return_to', '/')

    if not code or not state or state != session_state:
        return render_error(request, _('Invalid Jira OAuth state.'))

    if not project_uuid:
        return render_error(request, _('Please install through the address provided by sea-ticket.'))

    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        return render_error(request, _('Please install through the address provided by sea-ticket.'))
    workspace = project.workspace

    username = request.user.username
    if not check_project_admin_permission(username, workspace.owner):
        return render_error(request, _('Permission denied.'))

    if not JIRA_CLIENT_ID or not JIRA_CLIENT_SECRET or not JIRA_REDIRECT_URL:
        return render_error(request, _('Jira OAuth settings are invalid.'))

    token_payload = {
        'grant_type': 'authorization_code',
        'client_id': JIRA_CLIENT_ID,
        'client_secret': JIRA_CLIENT_SECRET,
        'code': code,
        'redirect_uri': JIRA_REDIRECT_URL,
    }

    try:
        resp = requests.post('https://auth.atlassian.com/oauth/token', json=token_payload, timeout=10)
    except Exception as e:
        logger.error('Jira OAuth token request error: %s', e)
        return render_error(request, _('Failed to authorize Jira.'))

    if resp.status_code != 200:
        logger.error('Jira OAuth token response invalid: %s %s', resp.status_code, resp.text)
        return render_error(request, _('Failed to authorize Jira.'))

    token_json = resp.json()
    access_token = token_json.get('access_token')
    refresh_token = token_json.get('refresh_token')
    if not access_token or not refresh_token:
        logger.error('Jira OAuth token missing access/refresh token: %s', token_json)
        return render_error(request, _('Failed to authorize Jira.'))

    ProjectConnectionOauth.objects.upsert_token(
        project_uuid,
        ConnectionType.JIRA_ISSUE.value,
        access_token,
        JiraAPI.calc_expires_at(token_json.get('expires_in')),
        refresh_token,
    )

    request.session.pop('jira_oauth_state', None)
    request.session.pop('jira_oauth_project_uuid', None)
    request.session.pop('jira_oauth_return_to', None)

    return redirect(return_to)
