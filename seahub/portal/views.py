# -*- coding: utf-8 -*-
import logging
import jwt

from django.shortcuts import render, redirect
from django.http import HttpResponse
from django.utils.translation import gettext as _
from django.http import HttpResponseRedirect, Http404
from django.utils import timezone

from seahub.auth import REDIRECT_FIELD_NAME
from seahub.auth import logout as auth_logout
from seahub.auth import views as auth_views
from seahub.portal.models import PortalExternalInvitation, ProjectExternalUser, PortalExternalSSOProvider
from seahub.portal.visitor_session import (
    ensure_visitor_cookie,
)
from seahub.portal.utils import can_preview_portal, get_portal_external_username, get_portal_preview_username, get_request_project_and_portal_settings, \
    load_portal_preview_token, portal_path, set_portal_login_session
from seahub.portal.custom_domain import is_request_using_portal_domain
from seahub import settings
from seahub.project.utils import check_project_admin_permission, check_same_org_permission
from seahub.organizations.models import OrgUser
from seahub.profile.models import Profile
from seahub.base.accounts import User
from seahub.utils import render_error, is_valid_email
from seahub.utils.auth import gen_user_virtual_id
from seahub.auth.decorators import login_required
from seahub.settings import MEDIA_URL

SEAQA_VERSION = getattr(settings, 'SEAQA_VERSION', 'Dev')

logger = logging.getLogger(__name__)

PORTAL_EXTERNAL_SSO_TOKEN_MAX_LIFETIME = 300


def _render_portal_external_sso_error(request, message):
    response = render_error(request, message)
    response['Cache-Control'] = 'no-store'
    response['Referrer-Policy'] = 'no-referrer'
    return response


def _get_portal_login_context(request, project, portal_settings):
    return {
        'project_uuid': str(project.uuid),
        'project_name': project.name,
        'portal_name': portal_settings.get('portal_name', ''),
        'portal_logo': portal_settings.get('portal_logo', ''),
        'media_url': MEDIA_URL,
    }


def portal_accounts_login_view(request):
    redirect_to = request.GET.get(REDIRECT_FIELD_NAME, '') or request.POST.get(REDIRECT_FIELD_NAME, '')
    if getattr(request.user, 'is_authenticated', False):
        return redirect(redirect_to or '/')

    if getattr(settings, 'ENABLE_CUSTOM_AUTH', False):
        return auth_views.custom_login(request, template_name='registration/login.html')

    return auth_views.login(request, template_name='registration/login.html')


def portal_view(request, project_uuid, children_id=None, session_uuid=None, issue_id=None):
    project, portal_settings = get_request_project_and_portal_settings(request, project_uuid)
    if not project:
        return render_error(request, _('This project does not exist'))
    allow_anonymous = portal_settings['allow_anonymous']
    enable_password_protection = portal_settings['enable_password_protection']
    show_kb_in_portal = portal_settings['show_kb_in_portal']
    enable_portal = portal_settings['enable_portal']
    streaming_response = portal_settings['streaming_response']
    
    if not enable_portal:
        return render_error(request, _('Portal is not enabled'))

    ext_username = get_portal_external_username(request, project_uuid)
    ext_is_valid = bool(ext_username)
    preview_username = get_portal_preview_username(request, project_uuid)
    is_authenticated_user = bool(getattr(request, 'user', None) and request.user.is_authenticated)

    same_org = False
    if is_authenticated_user:
        try:
            same_org = check_same_org_permission(request.user, project.workspace)
        except Exception:
            same_org = False

    has_ticket_access = bool(preview_username) or ext_is_valid or same_org
    # Treat invited users from other orgs as external portal users even when
    # they also have a normal site login in the current browser.
    is_external_user = bool(ext_is_valid and not same_org)

    if not allow_anonymous and not has_ticket_access:
        return render(request, 'portal_login.html', _get_portal_login_context(request, project, portal_settings))

    is_anonymous = allow_anonymous and (not has_ticket_access)

    if has_ticket_access:
        if preview_username:
            username = preview_username
        elif is_external_user:
            username = ext_username
        elif is_authenticated_user:
            username = request.user.username
        else:
            username = ext_username
    else:
        username = ''

    return_dict = {
        'version': SEAQA_VERSION,
        'project_name': project.name,
        'project_uuid': project_uuid,
        'media_url': MEDIA_URL,
        'is_edit_mode': False,
        'workspace_id': project.workspace_id,
        'is_anonymous': is_anonymous,
        'is_external_user': is_external_user,
        'is_preview_user': bool(preview_username),
        'username': username,
        'portal': {
            'allow_anonymous': allow_anonymous,
            'enable_password_protection': enable_password_protection,
            'show_kb_in_portal': show_kb_in_portal,
            'streaming_response': streaming_response,
            'portal_name': portal_settings.get('portal_name', ''),
            'portal_logo': portal_settings.get('portal_logo', ''),
        },
        'is_portal_domain': is_request_using_portal_domain(request, project_uuid),
        'portal_base_url': portal_path(request, project_uuid).rstrip('/') or '/',
    }
    if not has_ticket_access:
        need_password = False
        if enable_password_protection and allow_anonymous:
            encoded_password = portal_settings.get('password')
            verified_token = request.session.get(f'portal_verified_token_{project_uuid}')
            need_password = not (verified_token and encoded_password and verified_token == encoded_password)

        if need_password:
            return redirect(portal_path(request, project_uuid, 'anonymous-validate'))

        return_dict['need_password'] = need_password

    response = render(request, 'portal_view_react.html', return_dict)
    if is_anonymous:
        response = ensure_visitor_cookie(request, response)
    return response


def portal_login_view(request, project_uuid):
    project, portal_settings = get_request_project_and_portal_settings(request, project_uuid)
    if not project:
        return render_error(request, _('This project does not exist'))
    if not portal_settings.get('enable_portal'):
        return render_error(request, _('Portal is not enabled'))
    return render(request, 'portal_login.html', _get_portal_login_context(request, project, portal_settings))


def portal_preview_view(request, token):
    payload = load_portal_preview_token(token)
    if not payload:
        return render_error(request, _('Preview link is invalid or expired.'))

    project_uuid = payload['project_uuid']
    project, portal_settings = get_request_project_and_portal_settings(request, project_uuid)
    if not project:
        return render_error(request, _('This project does not exist'))
    if not portal_settings.get('enable_portal'):
        return render_error(request, _('Portal is not enabled'))
    if not can_preview_portal(payload['username'], project):
        return render_error(request, _('Permission denied'))

    set_portal_login_session(request, project_uuid, payload['username'])
    return redirect(portal_path(request, project_uuid))


def portal_external_logout_view(request, project_uuid):
    auth_logout(request)
    return redirect(portal_path(request, project_uuid))

def portal_anonymous_validate(request, project_uuid):
    project, portal_settings = get_request_project_and_portal_settings(request, project_uuid)
    if not project:
        return render_error(request, _('This project does not exist'))
    allow_anonymous = portal_settings['allow_anonymous']
    enable_password_protection = portal_settings['enable_password_protection']
    enable_portal = portal_settings['enable_portal']
    
    if not enable_portal:
        return render_error(request, _('Portal is not enabled'))

    # Only meaningful when anonymous and password protection is on
    if not (allow_anonymous and enable_password_protection):
        return redirect(portal_path(request, project_uuid))

    # Determine if password is still needed based on session token
    encoded_password = portal_settings.get('password')
    verified_token = request.session.get(f'portal_verified_token_{project_uuid}')
    need_password = not (verified_token and encoded_password and verified_token == encoded_password)

    if request.method == 'GET':
        if not need_password:
            return redirect(portal_path(request, project_uuid))
        return_dict = {
            'version': SEAQA_VERSION,
            'project_name': project.name,
            'project_uuid': project_uuid,
            'media_url': MEDIA_URL,
            'is_edit_mode': False,
            'username': '',
            'portal': {
                'allow_anonymous': allow_anonymous,
                'enable_password_protection': enable_password_protection,
                'portal_name': portal_settings.get('portal_name', ''),
                'portal_logo': portal_settings.get('portal_logo', ''),
            },
            'need_password': True,
            'is_portal_domain': is_request_using_portal_domain(request, project_uuid),
            'portal_base_url': portal_path(request, project_uuid).rstrip('/') or '/',
        }
        return render(request, 'portal_view_react.html', return_dict)

    password = request.POST.get('password', '')
    if not encoded_password or not password:
        return HttpResponse(_('Password invalid'), status=400)

    from seahub.utils.hasher import AESPasswordHasher
    cryptor = AESPasswordHasher()
    if not cryptor.verify(password, encoded_password):
        return HttpResponse(_('Password invalid'), status=400)

    request.session[f'portal_verified_token_{project_uuid}'] = encoded_password
    return redirect(portal_path(request, project_uuid))


def portal_external_invitation_accept_view(request, token, project_uuid):

    invitation = PortalExternalInvitation.objects.get_by_token(token)
    if not invitation or invitation.project_uuid != project_uuid:
        return render_error(request, _('Invitation link is invalid or expired.'))
    if invitation.accepted_at:
        redirect_url = portal_path(request, project_uuid, 'login')
        return HttpResponseRedirect(redirect_url)
    if invitation.is_expired():
        return render_error(request, _('Invitation link is invalid or expired.'))

    project, portal_settings = get_request_project_and_portal_settings(request, project_uuid)
    if not project:
        raise Http404
    if not portal_settings.get('enable_portal'):
        return render_error(request, _('Portal is not enabled'))

    invitation.accepted_at = timezone.now()
    invitation.save(update_fields=['accepted_at'])

    try:
        ext_user = ProjectExternalUser.objects.filter(email=invitation.email, project_uuid=project_uuid).first()
        if ext_user and not getattr(ext_user, 'activated', False):
            ext_user.activated = True
            ext_user.save(update_fields=['activated'])
    except Exception:
        ext_user = None

    if ext_user and getattr(ext_user, 'username', None):
        set_portal_login_session(request, project_uuid, ext_user.username, is_external_user=True)
        redirect_url = portal_path(request, project_uuid)
    else:
        redirect_url = portal_path(request, project_uuid, 'login')

    return HttpResponseRedirect(redirect_url)


def portal_external_sso_login_view(request, provider_id, project_uuid):
    project, portal_settings = get_request_project_and_portal_settings(request, project_uuid)
    if not project:
        response = _render_portal_external_sso_error(request, _('This project does not exist'))
        response.status_code = 404
        return response
    if not portal_settings.get('enable_portal'):
        return _render_portal_external_sso_error(request, _('Portal is not enabled'))

    provider = PortalExternalSSOProvider.objects.filter(project_uuid=project_uuid, provider_id=provider_id).first()
    if not provider or not provider.enabled:
        return _render_portal_external_sso_error(request, _('This login provider is unavailable.'))

    login_token = request.GET.get('token', '')
    if not login_token or len(login_token) > 4096:
        return _render_portal_external_sso_error(request, _('Login link is invalid.'))

    try:
        payload = jwt.decode(
            login_token,
            provider.get_secret(),
            algorithms=['HS256'],
            issuer=provider.provider_id,
            leeway=30,
            options={
                'require': ['iss', 'email', 'iat', 'exp'],
                'verify_aud': False,
            },
        )
    except jwt.ExpiredSignatureError:
        return _render_portal_external_sso_error(request, _('Login link has expired. Please return to the source system and try again.'))
    except jwt.PyJWTError:
        logger.warning('Portal external SSO token validation failed: project=%s provider=%s',project_uuid, provider.provider_id)
        return _render_portal_external_sso_error(request, _('Login link is invalid.'))
    except Exception:
        logger.exception('Failed to load portal external SSO provider secret: project=%s provider=%s',project_uuid, provider.provider_id)
        return _render_portal_external_sso_error(request, _('Unable to sign in. Please try again later.'))

    raw_email = payload.get('email')
    issued_at = payload.get('iat')
    expires_at = payload.get('exp')
    if not isinstance(raw_email, str):
        return _render_portal_external_sso_error(request, _('Login link is invalid.'))
    if not isinstance(issued_at, int) or not isinstance(expires_at, int) or \
            expires_at <= issued_at or expires_at - issued_at > PORTAL_EXTERNAL_SSO_TOKEN_MAX_LIFETIME:
        return _render_portal_external_sso_error(request, _('Login link is invalid.'))
    email = raw_email.strip().lower()
    if not is_valid_email(email):
        return _render_portal_external_sso_error(request, _('Login link is invalid.'))

    request.session.cycle_key()
    team_username = Profile.objects.convert_login_str_to_username(email)
    org_id = getattr(project.workspace, 'org_id', -1)
    if org_id != -1 and OrgUser.objects.org_user_exists(org_id, team_username):
        try:
            team_user = User.objects.get(email=team_username)
        except User.DoesNotExist:
            return _render_portal_external_sso_error(request, _('This account is unavailable.'))
        if not team_user.is_active:
            return _render_portal_external_sso_error(request, _('This account is unavailable.'))
        set_portal_login_session(request, project_uuid, team_username)
    else:
        try:
            ext_user, _created = ProjectExternalUser.objects.get_or_create(
                email=email, project_uuid=project_uuid,
                defaults={'username': gen_user_virtual_id(),
                          'activated': True,},
            )
            if not ext_user.activated:
                ext_user.activated = True
                ext_user.save(update_fields=['activated'])
        except Exception:
            logger.exception('Failed to create portal external user from SSO: project=%s provider=%s',project_uuid, provider.provider_id)
            return _render_portal_external_sso_error(request, _('Unable to sign in. Please try again later.'))

        set_portal_login_session(request, project_uuid, ext_user.username, is_external_user=True)
    response = redirect(portal_path(request, project_uuid))
    response['Cache-Control'] = 'no-store'
    response['Referrer-Policy'] = 'no-referrer'
    return response


@login_required
def portal_edit_view(request, project_uuid, page=None, children_id=None, session_uuid=None):
    project, portal_settings = get_request_project_and_portal_settings(request, project_uuid)
    if not project:
        return render_error(request, _('This project does not exist'))

    # permission check - only admins can access edit mode
    username = request.user.username
    workspace = project.workspace
    if not check_project_admin_permission(username, workspace.owner):
        return render_error(request, _('Permission denied'))

    streaming_response = portal_settings['streaming_response']
    show_kb_in_portal = portal_settings['show_kb_in_portal']
    allow_anonymous = portal_settings['allow_anonymous']
    enable_password_protection = portal_settings['enable_password_protection']
    enable_portal = portal_settings['enable_portal']
    
    if not enable_portal:
        return render_error(request, _('Portal is not enabled'))

    if allow_anonymous and enable_password_protection:
        encoded_password = portal_settings.get('password')
        if encoded_password:
            request.session[f'portal_verified_token_{project_uuid}'] = encoded_password

    return_dict = {
        'version': SEAQA_VERSION,
        'project_name': project.name,
        'project_uuid': project_uuid,
        'media_url': MEDIA_URL,
        'is_edit_mode': True,
        'workspace_id': project.workspace_id,
        'username': request.user.username,
        'is_external_user': False,
        'portal': {
            'show_kb_in_portal': show_kb_in_portal,
            'streaming_response': streaming_response,
            'portal_name': portal_settings.get('portal_name', ''),
            'portal_logo': portal_settings.get('portal_logo', ''),
        },
        'is_portal_domain': False,
        'portal_base_url': portal_path(request, project_uuid, is_edit_mode=True).rstrip('/'),
    }
    return render(request, 'portal_view_react.html', return_dict)
