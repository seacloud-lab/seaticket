# -*- coding: utf-8 -*-
import logging
import json
import base64
from urllib.parse import unquote
import secrets
import datetime
from urllib.parse import urlencode

import requests

from django.shortcuts import render, redirect
from django.http import HttpResponse
from django.utils.translation import gettext as _

from seahub import settings
from seahub.project.models import Workspaces, Projects, ProjectGithubAppInstallation, ProjectLinearOauth
from seahub.project.utils import check_project_admin_permission, check_project_permission
from seahub.utils import render_error
from seahub.auth.decorators import login_required
from seahub.settings import MEDIA_URL, LLM_MODELS, GITHUB_APP_NAME, ENABLE_GENERAL_TASK, THOUGHT_PROCESS_ENABLED, \
    LINEAR_CLIENT_ID, LINEAR_CLIENT_SECRET, LINEAR_REDIRECT_URL
from seahub.group.models import Group
from seahub.constants import PERMISSION_READ
from seahub.portal.views import _get_portal_settings

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
        project_settings = getattr(project, 'settings', '{}') or '{}'
    except:
        project_settings = '{}'

    is_project_admin = check_project_admin_permission(request.user.username, workspace.owner)
    permission = check_project_permission(request.user.username, workspace.owner)
    if not permission:
        return render_error(request, _('Permission denied'))

    portal_settings = _get_portal_settings(project)
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

    expires_in = timezone.now() + datetime.timedelta(seconds=int(expires_in))

    ProjectLinearOauth.objects.upsert_token(project_uuid, access_token, expires_in, refresh_token, username)

    request.session.pop('linear_oauth_state', None)
    request.session.pop('linear_oauth_project_uuid', None)
    request.session.pop('linear_oauth_return_to', None)

    response_html = f"""
    <html>
      <head><title>Linear OAuth</title></head>
      <body>
        <script>
          try {{
            if (window.opener) {{
              window.opener.postMessage({{ type: 'linear_oauth', status: 'success' }}, '*');
              window.close();
            }} else {{
              window.location.href = {json.dumps(return_to)};
            }}
          }} catch (e) {{
            window.location.href = {json.dumps(return_to)};
          }}
        </script>
      </body>
    </html>
    """
    return HttpResponse(response_html)
