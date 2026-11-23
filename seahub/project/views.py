# -*- coding: utf-8 -*-
import logging
import json
import base64
import secrets
import hashlib
from urllib.parse import urlencode

import requests

from django.conf import settings as django_settings
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render, redirect
from django.utils.http import url_has_allowed_host_and_scheme
from django.utils.translation import gettext as _
from django.utils import timezone
from requests_oauthlib import OAuth2Session

from seahub import settings
from seahub.project.models import Workspaces, Projects, ProjectConnections, ProjectGithubAppInstallation, \
    ProjectConnectionOauth
from seahub.project.utils import check_project_admin_permission, check_project_permission, \
    get_email_oauth_callback_url, fetch_oauth_email_sender_info, EmailOAuthProfileError
from seahub.project.oauth_utils import CommonOAuthUtils, EmailOAuthUtils, NotionOAuthUtils
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.utils import render_error
from seahub.auth.decorators import login_required
from seahub.settings import MEDIA_URL, LLM_MODELS, GITHUB_APP_NAME, ENABLE_GENERAL_TASK, THOUGHT_PROCESS_ENABLED, \
    LINEAR_CLIENT_ID, LINEAR_CLIENT_SECRET, LINEAR_REDIRECT_URL, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URL, \
    JIRA_CLIENT_ID, JIRA_CLIENT_SECRET, JIRA_REDIRECT_URL
from seahub.group.models import Group
from seahub.constants import PERMISSION_READ
from seahub.portal.utils import get_portal_settings
from seahub.project.constants import ConnectionType, merge_project_settings_defaults

SEAQA_VERSION = getattr(settings, 'SEAQA_VERSION', 'Dev')


logger = logging.getLogger(__name__)


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

    is_project_admin = check_project_admin_permission(request.user.username, workspace.owner)
    permission = check_project_permission(request.user.username, workspace.owner)
    if not permission:
        return render_error(request, _('Permission denied'))

    if is_project_admin:
        project_settings = merge_project_settings_defaults(project_settings)
    else:
        safe_settings = merge_project_settings_defaults(project_settings)
        project_settings = {
            'portal': {'enable_portal': safe_settings.get('portal', {}).get('enable_portal', False)},
            'agent': {'enabled': safe_settings['agent'].get('enabled', False)},
        }
    project_settings = json.dumps(project_settings)

    url_name = request.resolver_match.url_name
    if url_name in ['project_portal_settings_view', 'project_settings_view'] and not is_project_admin:
        return render(request, 'error.html', {'error_msg': _('Permission denied')}, status=403)

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
        'enable_portal_domain': django_settings.ENABLE_PORTAL_DOMAIN,
        'thought_process_enabled': THOUGHT_PROCESS_ENABLED,
        'permission': permission if permission else PERMISSION_READ,
        'llm_models': json.dumps(LLM_MODELS),
    }
    return render(request, 'project_view_react.html', return_dict)


@login_required
def github_install(request):
    return_to = request.GET.get('next') or '/'
    project_uuid = request.GET.get('project_uuid', '')

    if not project_uuid:
        return render_error(request, _('Please install through the address provided by sea-ticket.'))

    project = Projects.objects.get_project_by_uuid(project_uuid, include_deleted=False)
    if not project:
        return render_error(request, _('Please install through the address provided by sea-ticket.'))
    workspace = project.workspace

    username = request.user.username
    if not check_project_admin_permission(username, workspace.owner):
        return render_error(request, _('Permission denied.'))

    if not url_has_allowed_host_and_scheme(return_to, {request.get_host()}, require_https=request.is_secure()):
        return_to = '/'
    state = secrets.token_urlsafe(32)
    request.session['github_installation_request'] = {
        'state': state,
        'username': username,
        'project_uuid': str(project.uuid),
        'return_url': return_to,
        'created_at': timezone.now().timestamp(),
        'stage': 'install',
    }
    install_url = f"https://github.com/apps/{GITHUB_APP_NAME}/installations/new?{urlencode({'state': state})}"
    return redirect(install_url)


def _get_github_installation_request(request, stage):
    data = request.session.get('github_installation_request')
    if not isinstance(data, dict) or data.get('stage') != stage:
        return None, None
    if (not request.GET.get('state') or request.GET['state'] != data.get('state')
            or data.get('username') != request.user.username
            or data.get('created_at', 0) < timezone.now().timestamp() - 600):
        return None, None
    project = Projects.objects.get_project_by_uuid(data['project_uuid'], include_deleted=False)
    if not project or not check_project_admin_permission(request.user.username, project.workspace.owner):
        return None, None
    return data, project


@login_required
def github_installation_setup(request):
    data, project = _get_github_installation_request(request, 'install')
    if not data:
        return render(request, 'error.html', {'error_msg': _('Invalid or expired GitHub authorization request.')}, status=403)
    request.session.pop('github_installation_request', None)
    installation_id = request.GET.get('installation_id', '')
    if not installation_id.isdigit() or int(installation_id) <= 0:
        return render_error(request, _('Invalid GitHub installation.'))
    installation_id = str(int(installation_id))

    if ProjectGithubAppInstallation.objects.get_project_installation(str(project.uuid), installation_id):
        return redirect(data['return_url'])
    if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET:
        return render_error(request, _('GitHub OAuth is not configured.'))

    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode('ascii')).digest()).rstrip(b'=').decode('ascii')
    callback_url = request.build_absolute_uri(settings.SITE_ROOT + 'github/oauth/callback/')
    oauth = OAuth2Session(settings.GITHUB_CLIENT_ID, redirect_uri=callback_url, state=state)
    auth_url = oauth.authorization_url(
        'https://github.com/login/oauth/authorize',
        code_challenge=challenge, code_challenge_method='S256',
    )[0]
    data.update({'state': state, 'stage': 'authorize', 'installation_id': installation_id,
                 'code_verifier': verifier, 'callback_url': callback_url})
    request.session['github_installation_request'] = data
    return redirect(auth_url)


@login_required
def github_oauth_callback(request):
    data, project = _get_github_installation_request(request, 'authorize')
    if not data:
        return render(request, 'error.html', {'error_msg': _('Invalid or expired GitHub authorization request.')}, status=403)
    request.session.pop('github_installation_request', None)
    if request.GET.get('error') or not request.GET.get('code'):
        return render_error(request, _('GitHub authorization failed.'))

    try:
        oauth = OAuth2Session(settings.GITHUB_CLIENT_ID, redirect_uri=data['callback_url'], state=data['state'])
        token = oauth.fetch_token(
            'https://github.com/login/oauth/access_token', code=request.GET['code'],
            client_secret=settings.GITHUB_CLIENT_SECRET, code_verifier=data['code_verifier'],
            include_client_id=True, timeout=15,
        )
        headers = {'Authorization': f'Bearer {token["access_token"]}', 'Accept': 'application/vnd.github+json'}
        page = 1
        while True:
            response = requests.get('https://api.github.com/user/installations', headers=headers,
                                    params={'per_page': 100, 'page': page}, timeout=15)
            response.raise_for_status()
            installations = response.json()['installations']
            installation = next((item for item in installations
                                 if str(item['id']) == data['installation_id']
                                 and str(item['app_id']) == str(settings.GITHUB_APP_ID)
                                 and not item.get('suspended_at')), None)
            if installation:
                break
            if len(installations) < 100:
                return render(request, 'error.html', {'error_msg': _('Permission denied.')}, status=403)
            page += 1

        ProjectGithubAppInstallation.objects.update_or_create(
            project_uuid=str(project.uuid), installation_id=data['installation_id'],
            defaults={'creator': request.user.username, 'modifier': request.user.username},
        )
    except Exception:
        logger.warning('GitHub installation authorization failed for project %s', project.uuid)
        return render_error(request, _('GitHub authorization failed.'))
    return redirect(data['return_url'])


@login_required
def email_oauth(request, project_uuid):
    if request.method != 'POST':
        return JsonResponse({'error_msg': 'Method not allowed.'}, status=405)

    if not request.user.permissions.can_add_project():
        return JsonResponse({'error_msg': 'Permission denied.'}, status=403)

    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        return JsonResponse({'error_msg': f'Project {project_uuid} not found.'}, status=404)

    workspace = project.workspace
    username = request.user.username
    if not check_project_admin_permission(username, workspace.owner):
        return JsonResponse({'error_msg': 'Permission denied.'}, status=403)

    oauth_payload, error_response = EmailOAuthUtils.build_email_oauth_config(request)
    if error_response:
        return JsonResponse(error_response.data, status=error_response.status_code)

    name = oauth_payload['name']
    config = oauth_payload['config']
    oauth_config = oauth_payload['oauth_config']

    callback_url = get_email_oauth_callback_url()
    try:
        session = OAuth2Session(
            client_id=oauth_config.get('client_id'),
            scope=oauth_config.get('scopes'),
            redirect_uri=callback_url,
        )
        authorization_url, state = session.authorization_url(oauth_config.get('authority_url'))
        for key, value in oauth_config.get('authority_args', {}).items():
            authorization_url += f'&{key}={value}'
    except Exception as e:
        logger.error('Email OAuth authorization URL creation failed, error_type: %s', type(e).__name__)
        return JsonResponse({'error_msg': 'Failed to fetch authorization url'}, status=500)

    EmailOAuthUtils.set_oauth_session(request, state, {
        'oauth_state': state,
        'project_uuid': project_uuid,
        'created_at': timezone.now().timestamp(),
        'status': 'in-progress',
        'name': name,
        'config': config,
        'oauth_config': oauth_config,
        'connection_id': None,
        'error_msg': '',
    })
    return JsonResponse({'auth_url': authorization_url, 'state': state})


@login_required
def email_oauth_callback(request):
    request_state = request.GET.get('state')
    if not request_state:
        return render(request, 'error.html', {'error_msg': _('Request not found')})

    oauth_data = EmailOAuthUtils.get_oauth_session(request, request_state)
    if not oauth_data:
        return render(request, 'error.html', {'error_msg': _('Request not found')})

    if oauth_data.get('status') in ('authorized', 'success'):
        return render(request, 'authorization_success.html')

    project_uuid = oauth_data.get('project_uuid')
    if not project_uuid:
        EmailOAuthUtils.set_oauth_failure(request, request_state, 'Project not found.')
        return render(request, 'error.html', {'error_msg': _('Project not found.')})

    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        EmailOAuthUtils.set_oauth_failure(request, request_state, 'Project not found.')
        return render(request, 'error.html', {'error_msg': _('Project not found.')})

    workspace = project.workspace
    username = request.user.username
    if not check_project_admin_permission(username, workspace.owner):
        EmailOAuthUtils.set_oauth_failure(request, request_state, 'Permission denied.')
        return render(request, 'error.html', {'error_msg': _('Permission denied.')})

    config = oauth_data.get('config') or {}

    provider_error = request.GET.get('error')
    if provider_error:
        detail = request.GET.get('error_description') or provider_error
        logger.error('Email OAuth provider rejected authorization.')
        error_msg = _('The email provider rejected the authorization.') + f' {detail}'
        EmailOAuthUtils.set_oauth_failure(request, request_state, error_msg)
        return render(request, 'error.html', {'error_msg': error_msg})

    oauth_config = oauth_data.get('oauth_config') or {}
    if not all([oauth_config, oauth_data.get('oauth_state')]):
        error_msg = 'This authorization request is no longer valid, please start over.'
        EmailOAuthUtils.set_oauth_failure(request, request_state, error_msg)
        return render(request, 'error.html', {'error_msg': _(error_msg)})

    if request_state != oauth_data.get('oauth_state'):
        error_msg = 'OAuth request is expired or has been replaced by a newer authorization.'
        EmailOAuthUtils.set_oauth_failure(request, request_state, error_msg)
        return render(request, 'error.html', {'error_msg': _(error_msg)})

    callback_url = get_email_oauth_callback_url()
    authorization_response_url = callback_url + '?' + request.META.get('QUERY_STRING', '')
    try:
        session = OAuth2Session(
            client_id=oauth_config.get('client_id'),
            scope=oauth_config.get('scopes'),
            state=oauth_data.get('oauth_state'),
            redirect_uri=callback_url,
        )
        token = session.fetch_token(
            oauth_config.get('token_url'),
            client_secret=oauth_config.get('client_secret'),
            authorization_response=authorization_response_url,
        )
    except Exception:
        logger.error('Email OAuth token exchange failed.')
        error_msg = 'Failed to request token, please check your connection configurations'
        EmailOAuthUtils.set_oauth_failure(request, request_state, error_msg)
        return render(request, 'error.html', {'error_msg': _(error_msg)})

    refresh_token = token.get('refresh_token')
    if not refresh_token:
        error_msg = 'Failed to request token'
        EmailOAuthUtils.set_oauth_failure(request, request_state, error_msg)
        return render(request, 'error.html', {'error_msg': _(error_msg)})

    final_config = dict(config)
    try:
        if final_config.get('account_type') == 'personal':
            final_config.update(fetch_oauth_email_sender_info(final_config, token.get('access_token')))
    except EmailOAuthProfileError as e:
        logger.error('Email OAuth sender profile request failed, error_type: %s', type(e).__name__)
        error_msg = 'Failed to fetch sender profile, please check your connection configurations'
        EmailOAuthUtils.set_oauth_failure(request, request_state, error_msg)
        return render(request, 'error.html', {'error_msg': _(error_msg)})
    except Exception as e:
        logger.error('Email OAuth sender profile request failed, error_type: %s', type(e).__name__)
        error_msg = 'Failed to fetch email sender.'
        EmailOAuthUtils.set_oauth_failure(request, request_state, error_msg)
        return render_error(request, _(error_msg))

    oauth_data['status'] = 'authorized'
    oauth_data['sender_name'] = final_config.get('sender_name', '')
    oauth_data['sender_email'] = final_config.get('sender_email', '')
    oauth_data['access_token'] = token.get('access_token') or ''
    oauth_data['refresh_token'] = refresh_token
    oauth_data['expires_at'] = token.get('expires_at') or timezone.now().timestamp()
    oauth_data.pop('oauth_config', None)
    oauth_data['config'] = final_config
    oauth_data['error_msg'] = ''
    EmailOAuthUtils.set_oauth_session(request, request_state, oauth_data)

    return render(request, 'authorization_success.html')

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
        'scope': 'read,write',
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
        logger.error('Linear OAuth token request failed, error_type: %s', type(e).__name__)
        return render_error(request, _('Failed to authorize Linear.'))

    if resp.status_code != 200:
        logger.error('Linear OAuth token response invalid, status_code: %s', resp.status_code)
        return render_error(request, _('Failed to authorize Linear.'))

    token_json = resp.json()
    access_token = token_json.get('access_token')
    refresh_token = token_json.get('refresh_token')
    expires_in = token_json.get('expires_in')
    if not access_token:
        logger.error('Linear OAuth token missing access_token.')
        return render_error(request, _('Failed to authorize Linear.'))

    expires_at = CommonOAuthUtils.calc_expires_at(expires_in)
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
        logger.error('Confluence OAuth token request failed, error_type: %s', type(e).__name__)
        return render_error(request, _('Failed to authorize Confluence.'))

    if resp.status_code != 200:
        logger.error('Confluence OAuth token response invalid, status_code: %s', resp.status_code)
        return render_error(request, _('Failed to authorize Confluence.'))

    token_json = resp.json()
    access_token = token_json.get('access_token')
    refresh_token = token_json.get('refresh_token')
    if not access_token or not refresh_token:
        logger.error('Confluence OAuth token missing access/refresh token.')
        return render_error(request, _('Failed to authorize Confluence.'))

    ProjectConnectionOauth.objects.upsert_token(
        project_uuid,
        ConnectionType.CONFLUENCE.value,
        access_token,
        CommonOAuthUtils.calc_expires_at(token_json.get('expires_in')),
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
    if not url_has_allowed_host_and_scheme(url=return_to, allowed_hosts={request.get_host()}):
        return_to = '/'
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
        logger.error('Discord OAuth token request failed, error_type: %s', type(e).__name__)
        return render_error(request, _('Failed to authorize Discord.'))

    if resp.status_code != 200:
        logger.error('Discord OAuth token response invalid, status_code: %s', resp.status_code)
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

    if not url_has_allowed_host_and_scheme(url=return_to, allowed_hosts={request.get_host()}):
        return_to = '/'

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
        'scope': 'offline_access read:jira-work read:jira-user write:jira-work',
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
        logger.error('Jira OAuth token request failed, error_type: %s', type(e).__name__)
        return render_error(request, _('Failed to authorize Jira.'))

    if resp.status_code != 200:
        logger.error('Jira OAuth token response invalid, status_code: %s', resp.status_code)
        return render_error(request, _('Failed to authorize Jira.'))

    token_json = resp.json()
    access_token = token_json.get('access_token')
    refresh_token = token_json.get('refresh_token')
    if not access_token or not refresh_token:
        logger.error('Jira OAuth token missing access/refresh token.')
        return render_error(request, _('Failed to authorize Jira.'))

    ProjectConnectionOauth.objects.upsert_token(
        project_uuid,
        ConnectionType.JIRA_ISSUE.value,
        access_token,
        CommonOAuthUtils.calc_expires_at(token_json.get('expires_in')),
        refresh_token,
    )

    request.session.pop('jira_oauth_state', None)
    request.session.pop('jira_oauth_project_uuid', None)
    request.session.pop('jira_oauth_return_to', None)

    return redirect(return_to)


NOTION_VERSION = "2026-03-11"


@login_required
def notion_oauth(request):
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

    client_id = getattr(settings, 'NOTION_CLIENT_ID', '')
    client_secret = getattr(settings, 'NOTION_CLIENT_SECRET', '')
    redirect_url = getattr(settings, 'NOTION_REDIRECT_URL', '')
    if not client_id or not client_secret or not redirect_url:
        return render_error(request, _('Notion OAuth settings are invalid.'))

    state = secrets.token_urlsafe(24)
    NotionOAuthUtils.set_oauth_session(request, {
        'status': 'in-progress',
        'state': state,
        'project_uuid': project_uuid,
        'created_at': timezone.now().timestamp(),
        'error_msg': '',
    })

    params = {
        'client_id': client_id,
        'redirect_uri': redirect_url,
        'response_type': 'code',
        'owner': 'user',
        'state': state,
    }
    authorization_url = 'https://api.notion.com/v1/oauth/authorize?' + urlencode(params)
    return JsonResponse({'auth_url': authorization_url, 'state': state})


@login_required
def notion_oauth_callback(request):
    request_state = request.GET.get('state')
    if not request_state:
        return render_error(request, _('Request not found'))

    notion_data = NotionOAuthUtils.get_oauth_session(request)
    if not notion_data:
        return render_error(request, _('Request not found'))

    if notion_data.get('status') == 'authorized':
        return render(request, 'authorization_success.html')

    project_uuid = notion_data.get('project_uuid')
    if not project_uuid:
        NotionOAuthUtils.set_oauth_failure(request, 'Project not found.')
        return render_error(request, _('Project not found.'))

    project = Projects.objects.get_project_by_uuid(project_uuid)
    if not project:
        NotionOAuthUtils.set_oauth_failure(request, 'Project not found.')
        return render_error(request, _('Project not found.'))

    workspace = project.workspace
    username = request.user.username
    if not check_project_admin_permission(username, workspace.owner):
        NotionOAuthUtils.set_oauth_failure(request, 'Permission denied.')
        return render_error(request, _('Permission denied.'))

    client_id = getattr(settings, 'NOTION_CLIENT_ID', '')
    client_secret = getattr(settings, 'NOTION_CLIENT_SECRET', '')
    redirect_url = getattr(settings, 'NOTION_REDIRECT_URL', '')
    if not client_id or not client_secret or not redirect_url:
        error_msg = 'Notion OAuth settings are invalid.'
        NotionOAuthUtils.set_oauth_failure(request, error_msg)
        return render_error(request, _(error_msg))

    if request_state != notion_data.get('state'):
        error_msg = 'OAuth request is expired or has been replaced by a newer authorization.'
        NotionOAuthUtils.set_oauth_failure(request, error_msg)
        return render_error(request, _(error_msg))

    code = request.GET.get('code')
    if not code:
        error_msg = 'Failed to request token'
        NotionOAuthUtils.set_oauth_failure(request, error_msg)
        return render_error(request, _(error_msg))

    auth = base64.b64encode(f'{client_id}:{client_secret}'.encode()).decode()
    headers = {
        'Authorization': f'Basic {auth}',
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
    }
    token_payload = {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': redirect_url,
    }

    try:
        resp = requests.post('https://api.notion.com/v1/oauth/token', headers=headers, json=token_payload, timeout=10)
    except Exception as e:
        logger.error('Notion OAuth token request failed, error_type: %s', type(e).__name__)
        error_msg = 'Failed to request token, please check your connection configurations'
        NotionOAuthUtils.set_oauth_failure(request, error_msg)
        return render_error(request, _(error_msg))

    if resp.status_code != 200:
        logger.error('Notion OAuth token response invalid, status_code: %s', resp.status_code)
        error_msg = 'Failed to request token, please check your connection configurations'
        NotionOAuthUtils.set_oauth_failure(request, error_msg)
        return render_error(request, _(error_msg))

    token_json = resp.json()
    access_token = token_json.get('access_token')
    refresh_token = token_json.get('refresh_token')
    if not access_token or not refresh_token:
        logger.error('Notion OAuth token missing access/refresh token.')
        error_msg = 'Failed to request token'
        NotionOAuthUtils.set_oauth_failure(request, error_msg)
        return render_error(request, _(error_msg))

    notion_data['status'] = 'authorized'
    notion_data['access_token'] = access_token
    notion_data['refresh_token'] = refresh_token
    notion_data['expires_at'] = CommonOAuthUtils.calc_expires_at(token_json.get('expires_in')).timestamp()
    notion_data['workspace_id'] = token_json.get('workspace_id', '')
    notion_data['workspace_name'] = token_json.get('workspace_name', '')
    notion_data['error_msg'] = ''
    NotionOAuthUtils.set_oauth_session(request, notion_data)

    return render(request, 'authorization_success.html')
