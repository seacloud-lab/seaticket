import time
import logging
import json
from urllib.parse import urlencode, urljoin
import jwt
from django.db.models import F
from django.conf import settings
from django.http import HttpResponseRedirect, Http404
from django.urls import reverse
from django.shortcuts import render
from django.utils.translation import gettext as _

from seahub.auth import SESSION_MOBILE_LOGIN_KEY
from seahub.auth.decorators import login_required
from seahub.constants import PERMISSION_READ_WRITE
from seahub.dtable.models import DTableExternalApps, DTables, Workspaces, DTableExternalAppsUserStatistics, \
    DTableExternalAppsOrgStatistics, IdInOrgTuple
from seahub.dtable.utils import check_dtable_admin_permission, check_share_link_common, \
    clean_app_users_cache, can_use_advanced_customization_by_dtable, can_use_advanced_permissions_by_dtable
from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.dtable_apps.universal_app.models import DTableAppUsers, DTableAppInviteLinks, \
    AppAnonymousUser, DTableAppSnapshot, DTableAPPAnonymousAccessPassword
from seahub.dtable_apps.workflow.models import DTableWorkflows
from seahub.dtable_apps.workflow.utils import get_table_id_from_config
from seahub.settings import POWERED_BY_LINK, DTABLE_PRIVATE_KEY, DTABLE_APPS_CONFIG, DTABLE_SERVER_URL, \
    DTABLE_SOCKET_URL, DTABLE_BAIDU_MAP_KEY, DTABLE_MINE_MAP_KEY, ENABLE_WORKFLOW, USE_PHONE_REGISTRATION_BY_DEFAULT, \
    USE_EXTERNAL_TEAM_ADMIN, DTABLE_GOOGLE_MAP_KEY, BIG_DATA_SCREENS_APP_SUPPORT_REFRESH
from seahub.utils import get_inner_dtable_server_url, render_error, render_permission_error, uuid_str_to_36_chars
from seahub.utils.auth import get_login_bg_image_path
from seahub.utils.hasher import AESPasswordHasher
from seahub.auth.models import AnonymousUser
from seahub.department_v2.utils import get_departments_map_by_request_dtable
from seahub.utils.utils_etcd import enable_dtable_server_cluster, get_server_by_dtable_uuid
from seahub.dtable_apps.universal_app.utils import get_custom_pages, app_page_can_read, get_custom_pages_in_snapshot, \
    get_single_record_pages, get_single_record_pages_in_snapshot


logger = logging.getLogger(__name__)

def _update_external_app_statistics(external_app):
    import datetime
    org_id = external_app.org_id
    if not org_id:
        return

    creator = external_app.creator

    dt_now = datetime.datetime.now()
    current_month_date = datetime.datetime(year=dt_now.year, month=dt_now.month, day=1)
    if org_id == -1:
        obj, created = DTableExternalAppsUserStatistics.objects.get_or_create(
            username=creator,
            visit_date = current_month_date
        )
    else:
        obj, created = DTableExternalAppsOrgStatistics.objects.get_or_create(
            org_id = org_id,
            visit_date= current_month_date
        )

    if not created:
        obj.visit_count += 1
        obj.latest_visit_at = dt_now
        obj.save()

def check_universal_app_users(username, workspace_owner, universal_app, can_anonymous_access=False):
    app_user = DTableAppUsers.objects.filter(
        username=username,
        app=universal_app,
    ).first()
    if app_user:
        if not app_user.is_active:
            if can_anonymous_access:
                return AppAnonymousUser()
            else:
                return None
        return app_user
    elif check_dtable_admin_permission(username, workspace_owner):
        app_user = DTableAppUsers.objects.create_app_user_by_role(username, universal_app, 'admin')
        return app_user

    open_registration, authed_role = universal_app.open_registration_auth()
    if open_registration and authed_role:
        if username and username != 'anonymous':
            app_user = DTableAppUsers.objects.create(
                app=universal_app,
                username=username,
                role=authed_role
            )
            return app_user

    if can_anonymous_access:
        return AppAnonymousUser()

    return None


def dtable_external_app_login_view(request, app_uuid):
    external_app = DTableExternalApps.objects.get_external_app_by_uuid(app_uuid)
    if not external_app:
        return render_error(request, _('App does not exist.'))
    if external_app.inactive:
        return render_error(request, _('App is not available.'))
    dtable = DTables.objects.get_dtable_by_uuid(external_app.dtable_uuid, include_deleted=False)
    if not dtable:
        return render_error(request, _('Base does not exist.'))

    source = request.GET.get('from', None)
    invite_link_token = request.GET.get('invite_link_token', None)
    custom_url = request.GET.get('custom_url', None)
    app_name, app_icon, icon_color_index, use_custom_icon, custom_app_icon = '', 'default', 0, False, ''
    try:
        app_config = json.loads(external_app.app_config)
        app_name = app_config.get('app_name', '')
        app_icon = app_config.get('icon_class_name', 'default').rstrip()
        icon_color_index = app_config.get('icon_color_index', 0)
        use_custom_icon = app_config.get('use_custom_icon', False)
        custom_app_icon = app_config.get('app_icon', '')
    except Exception as e:
        logger.error(e)

    login_bg_image_path = get_login_bg_image_path()

    page_id = request.GET.get('page_id')
    record_id = request.GET.get('record_id')
    query_params = {k: v for k, v in {'page_id': page_id, 'record_id': record_id}.items() if v}
    next_url = urljoin('/external-apps/%s/' % app_uuid, f"?{urlencode(query_params)}") if query_params else '/external-apps/%s/' % app_uuid
    if external_app.custom_url:
        next_url = urljoin('/apps/custom/%s/' % external_app.custom_url, f"?{urlencode(query_params)}") if query_params else '/apps/custom/%s/' % external_app.custom_url
    if source == 'invite_link' and invite_link_token:
        next_url = '/dtable/universal-app/links/%s/' % invite_link_token
    if source == 'custom_link' and custom_url:
        next_url = urljoin('/apps/custom/%s/' % custom_url, f"?{urlencode(query_params)}") if query_params else '/apps/custom/%s/' % custom_url

    return render(request, 'dtable_external_app_login_react.html', {
        'app_name': app_name,
        'next': next_url,
        'login_bg_image_path': login_bg_image_path,
        'powered_by_link': POWERED_BY_LINK,
        'og_title': app_name,
        'og_description': 'Powered by SeaTable',
        'icon_color_index': icon_color_index,
        'app_icon': app_icon,
        'use_custom_icon': use_custom_icon,
        'custom_app_icon': custom_app_icon,
        'use_phone_registration_by_default': USE_PHONE_REGISTRATION_BY_DEFAULT
    })

def universal_app_invite_link_view(request, token):
    dsl = DTableAppInviteLinks.objects.filter(token=token).first()
    if not dsl:
        return render_error(request, _('The invite link does not exist'))
    if dsl.app.inactive:
        return render_error(request, _('App is not available.'))
    if dsl.is_expired():
        return render_error(request, _('The invite link has expired'))

    login_bg_image_path = get_login_bg_image_path()
    universal_app = dsl.app
    app_role = dsl.role
    app_uuid = dsl.app.app_uuid

    if isinstance(request.user, AnonymousUser):
        redirect_url = reverse('dtable:dtable_external_app_login_view', args=(app_uuid, ))
        redirect_url = "%s?from=invite_link&invite_link_token=%s" % (redirect_url, token)
        return HttpResponseRedirect(redirect_url)


    password_check, err_msg = check_share_link_common(request, dsl)
    if not password_check:
        d = {'token': token, 'view_name': 'dtable:dtable_universal_app_invite_link_view', 'err_msg': err_msg}
        return render(request, 'share_access_validation.html', d)

    # resource check
    dtable_uuid = uuid_str_to_36_chars(universal_app.dtable_uuid)

    dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid, include_deleted=False)
    if not dtable:
        raise Http404

    workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace.id)
    if not workspace:
        raise Http404


    current_username = request.user.username
    try:
         app_user = DTableAppUsers.objects.filter(
            app = universal_app,
            username = current_username
            ).first()
         if not app_user:
             DTableAppUsers.objects.create(
                 app=universal_app,
                 username = current_username,
                 role = app_role
             )
             clean_app_users_cache(dtable_uuid)
    except Exception as e:
        logger.error('take user: %s to app: %s app-uuid: %s share-list error: %s',
                     current_username, dsl.app.app_name, app_uuid, e)
        return render_error(request, _('Internal Server Error'))
    custom_url = universal_app.custom_url
    if custom_url:
        return HttpResponseRedirect(reverse('dtable:dtable_universal_app_custom_view', args=(custom_url, )))

    return HttpResponseRedirect(reverse('dtable:dtable_external_app_view', args=(app_uuid, )))


def dtable_external_app_anonymous_validate_view(request, app_uuid):
    """
    Permission:
    all users
    """
    # resource check
    external_app = DTableExternalApps.objects.get_external_app_by_uuid(app_uuid)
    if not external_app:
        return render_error(request, _('App does not exist.'))

    if external_app.inactive:
        return render_error(request, _('App is not available.'))

    if external_app.app_type != 'universal-app':
        return render_error(request, 'App is not an universal app')

    if not external_app.can_anonymous_access:
        return HttpResponseRedirect(reverse('dtable:dtable_external_app_view', args=(app_uuid,)))

    dtable = DTables.objects.get_dtable_by_uuid(external_app.dtable_uuid, include_deleted=False)
    if not dtable:
        return render_error(request, _('Base does not exist.'))

    username = request.user.username
    is_anonymous = False
    if isinstance(request.user, AnonymousUser):
        is_anonymous = True
    else:
        app_user = check_universal_app_users(username, dtable.workspace.owner, external_app, False)
        is_anonymous = not app_user

    app_name, app_icon, use_custom_icon, custom_app_icon = '', '', False, ''
    login_bg_image_path = get_login_bg_image_path()
    try:
        app_config = json.loads(external_app.app_config)
        app_icon = app_config.get('icon_class_name', 'default').rstrip()
        app_name = app_config.get('app_name', '')
        use_custom_icon = app_config.get('use_custom_icon', False)
        custom_app_icon = app_config.get('app_icon', '')
    except Exception as e:
        logger.error(e)
    
    context = {
        'login_bg_image_path': login_bg_image_path,
        'app_name': app_name,
        'app_icon': app_icon,
        'custom_app_icon': custom_app_icon,
        'use_custom_icon': use_custom_icon,
    }

    if is_anonymous:
        hasher = AESPasswordHasher()
        session_key = f'app_access_{app_uuid}'
        if external_app.is_anonymous_need_password:
            app_anonymous_access_password = DTableAPPAnonymousAccessPassword.objects.filter(app_id=external_app.id).first()
            password_in_session = request.session.get(session_key)
            if not app_anonymous_access_password or hasher.verify(password_in_session, app_anonymous_access_password.password):
                return HttpResponseRedirect(reverse('dtable:dtable_external_app_view', args=(app_uuid,)))

            source = request.GET.get('from')
            custom_url = request.GET.get('custom_url')
            if source == 'custom_link':
                context['from'] = 'custom_link'
                context['custom_url'] = custom_url

            if request.method == 'POST':
                password_in_form = request.POST.get('password')
                source = request.POST.get('from')
                custom_url = request.POST.get('custom_url')
                if source == 'custom_link':
                    if not custom_url:
                        return render_error(request, _('App not found'))
                    external_app = DTableExternalApps.objects.filter(app_uuid=app_uuid, custom_url=custom_url).first()
                    if not external_app:
                        return render_error(request, _('App not found'))
                if not password_in_form:
                    context['err_msg'] = _("Password can\'t be empty")
                    return render(request, 'app_access_validation.html', context)
                if hasher.verify(password_in_form, app_anonymous_access_password.password):
                    request.session[session_key] = password_in_form
                    if source == 'custom_link':
                        app_url = reverse('dtable:dtable_universal_app_custom_view', args=(custom_url,))
                    else:
                        app_url = reverse('dtable:dtable_external_app_view', args=(app_uuid,))
                    return HttpResponseRedirect(app_url)
                context['err_msg'] = _("Please enter a correct password.")
                return render(request, 'app_access_validation.html', context)

            return render(request, 'app_access_validation.html', context)

    return HttpResponseRedirect(reverse('dtable:dtable_external_app_view', args=(app_uuid,)))


def dtable_external_app_view(request, app_uuid):
    """
    Permission:
    all users
    """
    # resource check
    external_app = DTableExternalApps.objects.get_external_app_by_uuid(app_uuid)
    if not external_app:
        return render_error(request, _('App does not exist.'))

    if external_app.inactive:
        return render_error(request, _('App is not available.'))

    app_name, app_icon, icon_color_index, use_custom_icon, custom_app_icon = '', 'default', 0, False, ''
    try:
        app_config = json.loads(external_app.app_config)
        app_name = app_config.get('app_name', '')
        app_icon = app_config.get('icon_class_name', 'default').rstrip()
        icon_color_index = app_config.get('icon_color_index', 0)
        use_custom_icon = app_config.get('use_custom_icon', False)
        custom_app_icon = app_config.get('app_icon', '')
    except Exception as e:
        logger.error(e)

    can_anonymous_access = external_app.can_anonymous_access
    if external_app.app_type == 'universal-app' and isinstance(request.user, AnonymousUser):
        if not can_anonymous_access:
            redirect_url = reverse('dtable:dtable_external_app_login_view', args=(app_uuid,))
            page_id = request.GET.get('page_id')
            record_id = request.GET.get('record_id')
            query_params = {k: v for k, v in {'page_id': page_id, 'record_id': record_id}.items() if v is not None}
            redirect_url = urljoin(redirect_url, f"?{urlencode(query_params)}") if query_params else redirect_url
            return HttpResponseRedirect(redirect_url)

    dtable_uuid = external_app.dtable_uuid
    dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
    if not dtable:
        return render_error(request, _('Base does not exist.'))

    if dtable.deleted:
        return render_error(request, _('Base does not exist.'))

    workspace_id = dtable.workspace_id
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        return render_error(request, 'Workspace does not exist.')

    username = request.user.username
    is_org_staff = request.user.org.is_staff if request.user.org else False
    id_in_org_tuple = IdInOrgTuple.objects.filter(virtual_id=username)
    id_in_org = id_in_org_tuple[0].id_in_org if id_in_org_tuple else ''
    permission, custom_permission, permission_detail, role_id = None, None, None, None
    is_admin = False
    open_registration = False
    universal_app_dict = {}
    if external_app.app_type == 'universal-app':
        app_user = check_universal_app_users(username, workspace.owner, external_app, can_anonymous_access)
        if external_app.is_anonymous_need_password and isinstance(app_user, AppAnonymousUser):
            session_key = f'app_access_{app_uuid}'
            password_in_session = request.session.get(session_key)
            app_anonymous_access_password = DTableAPPAnonymousAccessPassword.objects.filter(app_id=external_app.id).first()
            hasher = AESPasswordHasher()
            if app_anonymous_access_password and not hasher.verify(password_in_session, app_anonymous_access_password.password):
                return HttpResponseRedirect(reverse('dtable:dtable_external_app_anonymous_validate_view', args=(app_uuid,)))
        if not app_user:
            error_msg = _("You don't have permission to the application %(app_name)s on the SeaTable. Please contact the creator of the application for an invitation link.") % {'app_name': app_name}
            return render(request, 'dtable_external_app_permission_react.html', {
                'app_name': app_name,
                'no_access_logo': 'img/no-access.png',
                'powered_by_link': POWERED_BY_LINK,
                'error_msg': error_msg,
                'og_description': 'Powered by SeaTable',
                'og_title': app_name,
                'app_icon': app_icon,
                'icon_color_index': icon_color_index,
                'use_custom_icon': use_custom_icon,
                'custom_app_icon': custom_app_icon,
            })
        open_registration, authed_role = external_app.open_registration_auth()
        user_role = app_user.role
        permission_detail = user_role and user_role.role_permission_detail or None
        permission = user_role and user_role.role_permission or 'r'
        is_admin = user_role and user_role.role_name == 'admin' or False
        role_id = user_role and user_role.id or None
        custom_permission = permission_detail and json.loads(permission_detail) or None
        payload = {
            'exp': int(time.time()) + 3600 * 24 * 3,
            'app_uuid': app_uuid,
            'username': app_user.username,
            'user_role_name': user_role and user_role.role_name or '',
            'permission': permission,
            'custom_permission': custom_permission,
            'role_id': role_id,
        }

        page_id = request.GET.get('page_id')
        # app_config = json.loads(external_app.app_config)
        pages = app_config.get('settings').get('pages') or []
        if page_id:
            try:
                page = [page for page in pages if page.get('id') == page_id][0]
            except IndexError:
                error_msg = 'page %s not found.' % page_id
                return render_error(request, error_msg)

            if not app_page_can_read(payload, page):
                error_msg = 'Permission denied.'
                return render_error(request, error_msg)

        assistant_pages_access_tokens = {}
        assistant_payload = {
            'exp': int(time.time()) + 3600 * 24 * 3,
            'username': app_user.username,
        }
        for page in pages:
            page_type = page.get('type')
            p_id = page.get('id')
            if page_type == 'ai_assistant':
                assistant_uuid = page.get('assistant_uuid')
                assistant_payload['assistant_uuid'] = assistant_uuid
                assistant_pages_access_tokens[p_id] = jwt.encode(assistant_payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
        universal_app_dict['assistant_pages_access_tokens'] = json.dumps(assistant_pages_access_tokens)

    else:
        payload = {
            'exp': int(time.time()) + 3600 * 24 * 3,
            'app_uuid': app_uuid,
            'username': username,
            'permission': PERMISSION_READ_WRITE,
        }

    try:
        access_token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    except Exception as e:
        logger.error(e)
        return render_error(request, _('Internal Server Error'))

    request.session['external_app'] = {'asset_access_token': access_token, 'dtable_uuid': dtable.uuid.hex, 'app_type': external_app.app_type}
    mobile_login = request.session.get(SESSION_MOBILE_LOGIN_KEY, False)

    version = '0.0.1'
    try:
        for x in DTABLE_APPS_CONFIG:
            if x.get('app_type', '') == external_app.app_type:
                version = x.get('version', '')
    except Exception as e:
        logger.error(e)
        return render_error(request, _('Internal Server Error'))

    try:
        DTableExternalApps.objects.filter(app_uuid=app_uuid).update(visit_times=F('visit_times') + 1)
        _update_external_app_statistics(external_app)
    except Exception as e:
        logger.error(e)

    if enable_dtable_server_cluster:
        dtable_server_url = get_server_by_dtable_uuid(str(dtable.uuid))
        dtable_socket_url = dtable_server_url
    else:
        dtable_server_url = DTABLE_SERVER_URL
        dtable_socket_url = DTABLE_SOCKET_URL

    owner_can_use_advanced_permissions = can_use_advanced_permissions_by_dtable(dtable)
    owner_can_use_advanced_customization = can_use_advanced_customization_by_dtable(dtable)

    user_department_ids_map = get_departments_map_by_request_dtable(request, dtable)
    custom_pages = get_custom_pages(app_config, workspace.repo_id, dtable_uuid)
    single_record_pages = get_single_record_pages(app_config, workspace.repo_id, dtable_uuid)
    can_use_ai_assistant = bool(settings.SEATABLE_AI_SERVER_URL)

    return_dict = {
        'workspace_id': workspace_id,
        'dtable_name': dtable.name,
        'app_uuid': app_uuid,
        'dtable_uuid': str(dtable.uuid),
        'app_id': external_app.id,
        'app_type': external_app.app_type,
        'app_name': app_name,
        'app_version': version,
        'app_config': json.dumps(app_config),
        'custom_pages': json.dumps(custom_pages),
        'single_record_pages': json.dumps(single_record_pages),
        'access_token': access_token,
        'dtable_server': dtable_server_url,
        'dtable_socket': dtable_socket_url,
        'dtable_baidu_map_key': DTABLE_BAIDU_MAP_KEY,
        'dtable_mine_map_key': DTABLE_MINE_MAP_KEY,
        'dtable_google_map_key': DTABLE_GOOGLE_MAP_KEY,
        'role_id': role_id or '',
        'id_in_org': id_in_org,
        'is_admin': is_admin,
        'permission': permission or '',
        'custom_permission': permission_detail or '',
        'og_title': app_name,
        'og_description': 'Powered by SeaTable',
        'is_open_registration': open_registration,
        'owner_can_use_advanced_permissions': owner_can_use_advanced_permissions,
        'owner_can_use_advanced_customization': owner_can_use_advanced_customization,
        'use_external_team_admin': USE_EXTERNAL_TEAM_ADMIN,
        'is_org_staff': is_org_staff,
        'mobile_login': mobile_login,
        'app_name_display': app_name,
        'user_department_ids_map': user_department_ids_map,
        'can_use_ai_assistant': can_use_ai_assistant,
        'big_data_screens_app_support_refresh': BIG_DATA_SCREENS_APP_SUPPORT_REFRESH,
    }

    return_dict.update(universal_app_dict)

    if external_app.app_type in ('gallery', 'map-cn'):
        dtable_server_api = DTableServerAPI('dtable-web', str(dtable.uuid), get_inner_dtable_server_url())
        try:
            metadata = dtable_server_api.get_metadata()
        except:
            return render_error(request, 'Internal Server Error')
        app_settings = app_config.get('settings', {})
        app_table_name, app_view_name = app_settings.get('table_name'), app_settings.get('view_name')
        try:
            app_table = [table for table in metadata['tables'] if table['name'] == app_table_name][0]
            app_view = [view for view in app_table['views'] if view['name'] == app_view_name][0]
            columns = [col for col in app_table['columns'] if col['key'] not in app_view.get('hidden_columns', [])]
        except:
            return render_error(request, 'App table or view not found')
        return_dict['columns'] = json.dumps(columns)

    return render(request, 'dtable_external_app_view_react.html', return_dict)


def dtable_universal_app_custom_view(request, custom_url):
    """
    Permission:
    all users
    """
    # resource check
    external_app = DTableExternalApps.objects.filter(custom_url=custom_url).first()
    if not external_app:
        return render_error(request, _('Page not found.'))

    if external_app.inactive:
        return render_error(request, _('App is not available.'))

    app_uuid = external_app.app_uuid
    app_name, app_icon, icon_color_index = '', 'default', 0
    try:
        app_config = json.loads(external_app.app_config)
        app_name = app_config.get('app_name', '')
        app_icon = app_config.get('icon_class_name', 'default')
        icon_color_index = app_config.get('icon_color_index', 0)
    except Exception as e:
        logger.error(e)

    can_anonymous_access = external_app.can_anonymous_access
    if isinstance(request.user, AnonymousUser):
        if not can_anonymous_access:
            redirect_url = reverse('dtable:dtable_external_app_login_view', args=(app_uuid,))
            redirect_url = "%s?from=custom_link&custom_url=%s" % (redirect_url, custom_url)
            page_id = request.GET.get('page_id')
            record_id = request.GET.get('record_id')
            query_params = {k: v for k, v in {'page_id': page_id, 'record_id': record_id}.items() if v is not None}
            redirect_url = f"{redirect_url}&{urlencode(query_params)}" if query_params else redirect_url
            return HttpResponseRedirect(redirect_url)
        else:
            if external_app.is_anonymous_need_password:
                session_key = f'app_access_{app_uuid}'
                password_in_session = request.session.get(session_key)
                app_anonymous_access_password = DTableAPPAnonymousAccessPassword.objects.filter(app_id=external_app.id).first()
                hasher = AESPasswordHasher()
                if app_anonymous_access_password and not hasher.verify(password_in_session, app_anonymous_access_password.password):
                    validate_url = reverse('dtable:dtable_external_app_anonymous_validate_view', args=(app_uuid,))
                    validate_url += f'?from=custom_link&custom_url={custom_url}'
                    return HttpResponseRedirect(validate_url)

    dtable_uuid = external_app.dtable_uuid
    dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
    if not dtable:
        return render_error(request, _('Base does not exist.'))

    if dtable.deleted:
        return render_error(request, _('Base does not exist.'))

    username = request.user.username
    id_in_org_tuple = IdInOrgTuple.objects.filter(virtual_id=username)
    id_in_org = id_in_org_tuple[0].id_in_org if id_in_org_tuple else ''

    app_user = check_universal_app_users(username, dtable.workspace.owner, external_app, can_anonymous_access)
    if not app_user:
        error_msg = _("You don't have permission to visit application %(app_name)s. Please contact the creator of the application for an invitation link.") % {'app_name': app_name}
        return render(request, 'dtable_external_app_permission_react.html', {
            'app_name': app_name,
            'no_access_logo': 'img/no-access.png',
            'powered_by_link': POWERED_BY_LINK,
            'error_msg': error_msg,
            'og_description': 'Powered by SeaTable',
            'og_title': app_name,
            'app_icon': app_icon,
            'icon_color_index': icon_color_index
        })
    open_registration, authed_role = external_app.open_registration_auth()
    user_role = app_user.role
    permission_detail = user_role and user_role.role_permission_detail or None
    permission = user_role and user_role.role_permission or 'r'
    is_admin = user_role and user_role.role_name == 'admin' or False
    role_id = user_role and user_role.id or None
    custom_permission = permission_detail and json.loads(permission_detail) or None
    payload = {
        'exp': int(time.time()) + 3600 * 24 * 3,
        'app_uuid': app_uuid,
        'username': app_user.username,
        'user_role_name': user_role and user_role.role_name or '',
        'permission': permission,
        'custom_permission': custom_permission,
        'role_id': role_id,
    }

    page_id = request.GET.get('page_id')
    if page_id:
        app_config = json.loads(external_app.app_config)
        pages = app_config.get('settings').get('pages')
        try:
            page = [page for page in pages if page.get('id') == page_id][0]
        except IndexError:
            error_msg = 'page %s not found.' % page_id
            return render_error(request, error_msg)

        if not app_page_can_read(payload, page):
            error_msg = 'Permission denied.'
            return render_error(request, error_msg)

    try:
        access_token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    except Exception as e:
        logger.error(e)
        return render_error(request, _('Internal Server Error'))

    request.session['external_app'] = {'asset_access_token': access_token, 'dtable_uuid': dtable.uuid.hex, 'app_type': external_app.app_type}

    version = '0.0.1'
    try:
        for x in DTABLE_APPS_CONFIG:
            if x.get('app_type', '') == external_app.app_type:
                version = x.get('version', '')
    except Exception as e:
        logger.error(e)
        return render_error(request, _('Internal Server Error'))

    try:
        DTableExternalApps.objects.filter(app_uuid=app_uuid).update(visit_times=F('visit_times') + 1)
        _update_external_app_statistics(external_app)
    except Exception as e:
        logger.error(e)

    if enable_dtable_server_cluster:
        dtable_server_url = get_server_by_dtable_uuid(str(dtable.uuid))
        dtable_socket_url = dtable_server_url
    else:
        dtable_server_url = DTABLE_SERVER_URL
        dtable_socket_url = DTABLE_SOCKET_URL

    owner_can_use_advanced_permissions = can_use_advanced_permissions_by_dtable(dtable)
    owner_can_use_advanced_customization = can_use_advanced_customization_by_dtable(dtable)
    mobile_login = request.session.get(SESSION_MOBILE_LOGIN_KEY, False)

    user_department_ids_map = get_departments_map_by_request_dtable(request, dtable)
    custom_pages = get_custom_pages(app_config, dtable.workspace.repo_id, dtable_uuid)
    single_record_pages = get_single_record_pages(app_config, dtable.workspace.repo_id, dtable_uuid)
    can_use_ai_assistant = bool(settings.SEATABLE_AI_SERVER_URL)

    return_dict = {
        'workspace_id': dtable.workspace.id,
        'dtable_name': dtable.name,
        'app_uuid': app_uuid,
        'dtable_uuid': str(dtable.uuid),
        'app_id': external_app.id,
        'app_type': external_app.app_type,
        'app_name': app_name,
        'app_version': version,
        'app_config': external_app.app_config,
        'custom_pages': json.dumps(custom_pages),
        'single_record_pages': json.dumps(single_record_pages),
        'access_token': access_token,
        'dtable_server': dtable_server_url,
        'dtable_socket': dtable_socket_url,
        'dtable_baidu_map_key': DTABLE_BAIDU_MAP_KEY,
        'dtable_mine_map_key': DTABLE_MINE_MAP_KEY,
        'dtable_google_map_key': DTABLE_GOOGLE_MAP_KEY,
        'role_id': role_id or '',
        'is_admin': is_admin,
        'permission': permission or '',
        'custom_permission': permission_detail or '',
        'og_title': app_name,
        'id_in_org': id_in_org,
        'og_description': 'Powered by SeaTable',
        'is_open_registration': open_registration,
        'owner_can_use_advanced_permissions': owner_can_use_advanced_permissions,
        'owner_can_use_advanced_customization': owner_can_use_advanced_customization,
        'mobile_login': mobile_login,
        'app_name_display': app_name,
        'user_department_ids_map': user_department_ids_map,
        'can_use_ai_assistant': can_use_ai_assistant,
    }

    return render(request, 'dtable_external_app_view_react.html', return_dict)


@login_required
def dtable_external_app_edit(request, app_uuid):
    """
    Permission:
    1. owner
    2. group member
    3. shared user with `rw` permission
    """
    if not request.user.permissions.can_use_external_app():
        render_error(request, _('Feature is not enabled.'))

    # resource check
    external_app = DTableExternalApps.objects.get_external_app_by_uuid(app_uuid)
    if not external_app:
        return render_error(request, _('App does not exist.'))

    if external_app.inactive:
        return render_error(request, _('App is not available.'))

    dtable_uuid = external_app.dtable_uuid
    dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
    if not dtable:
        return render_error(request, _('Base does not exist.'))

    if dtable.deleted:
        return render_error(request, _('Base does not exist.'))

    workspace_id = dtable.workspace_id
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        return render_error(request, 'Workspace does not exist.')

    # permission check
    username = request.user.username
    is_org_staff = request.user.org.is_staff if request.user.org else False
    id_in_org_tuple = IdInOrgTuple.objects.filter(virtual_id=username)
    id_in_org = id_in_org_tuple[0].id_in_org if id_in_org_tuple else ''

    permission, permission_detail, role_id = PERMISSION_READ_WRITE, None, None
    is_admin = False
    if external_app.app_type == 'universal-app':
        app_user = check_universal_app_users(username, workspace.owner, external_app)
        if not app_user:
            return render_permission_error(request, 'Permission denied.')

        if not check_dtable_admin_permission(username, workspace.owner):
            if app_user.role.role_name == 'admin':
                err_msg = 'Your admin permission of the app has been revoked.'
                app_user.set_default_role()
            else:
                err_msg = 'Permission denied.'
            return render_permission_error(request, err_msg)
        elif app_user.role.role_name != 'admin':
                app_user.set_admin_role()
        user_role = app_user.role
        permission_detail = user_role.role_permission_detail
        permission = user_role.role_permission
        is_admin = user_role.role_name == 'admin'
        role_id = user_role.id
        payload = {
            'exp': int(time.time()) + 3600 * 24 * 3,
            'app_uuid': app_uuid,
            'username': app_user.username,
            'user_role_name': user_role.role_name,
            'role_id': role_id,
            'permission': permission or '',
            'custom_permission': permission_detail or ''
        }
    else:
        # generate json web token
        payload = {
            'exp': int(time.time()) + 3600 * 6,
            'app_uuid': app_uuid,
            'username': username,
            'permission': permission,
        }

    if not check_dtable_admin_permission(username, workspace.owner):
        return render_permission_error(request, 'Permission denied.')

    try:
        access_token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    except Exception as e:
        logger.error(e)
        return render_error(request, _('Internal Server Error'))

    version = '0.0.1'
    try:
        for x in DTABLE_APPS_CONFIG:
            if x.get('app_type', '') == external_app.app_type:
                version = x.get('version', '')
    except Exception as e:
        logger.error(e)
        return render_error(request, _('Internal Server Error'))

    if enable_dtable_server_cluster:
        dtable_server_url = get_server_by_dtable_uuid(str(dtable.uuid))
        dtable_socket_url = dtable_server_url
    else:
        dtable_server_url = DTABLE_SERVER_URL
        dtable_socket_url = DTABLE_SOCKET_URL

    app_name = ''
    app_config = {}
    try:
        app_config = json.loads(external_app.app_config)
        app_name = app_config.get('app_name', '')

        if ENABLE_WORKFLOW:
            workflows = list(DTableWorkflows.objects.get_workflows_by_dtable_uuid(dtable_uuid))
            pages = app_config.get('settings', {}).get('pages', [])
            table_to_workflow_dict = {get_table_id_from_config(workflow.workflow_config): workflow for workflow in workflows}

            for page in pages:
                trigger_workflow_option = page.get('trigger_workflow_option', {})
                trigger_workflow_option['can_trigger_workflow'] = False

                app_table_id = page.get('table_id')
                workflow = table_to_workflow_dict.get(app_table_id)
                if workflow:
                    trigger_workflow_option['workflow_name'] = json.loads(workflow.workflow_config).get('workflow_name')
                    if trigger_workflow_option.get('workflow_token') != workflow.token:
                        trigger_workflow_option['is_trigger_workflow'] = False
                    trigger_workflow_option['workflow_token'] = workflow.token
                    trigger_workflow_option['can_trigger_workflow'] = True

                page['trigger_workflow_option'] = trigger_workflow_option

    except Exception as e:
        logger.error(e)

    owner_can_use_advanced_permissions = can_use_advanced_permissions_by_dtable(dtable)
    owner_can_use_advanced_customization = can_use_advanced_customization_by_dtable(dtable)
    mobile_login = request.session.get(SESSION_MOBILE_LOGIN_KEY, False)

    user_department_ids_map = get_departments_map_by_request_dtable(request, dtable)
    custom_pages = get_custom_pages(app_config, workspace.repo_id, dtable_uuid)
    single_record_pages = get_single_record_pages(app_config, workspace.repo_id, dtable_uuid)
    can_use_ai_assistant = bool(settings.SEATABLE_AI_SERVER_URL)

    return_dict = {
        'workspace_id': workspace_id,
        'dtable_name': dtable.name,
        'app_uuid': app_uuid,
        'dtable_uuid': str(dtable.uuid),
        'app_id': external_app.id,
        'app_type': external_app.app_type,
        'app_name': app_name,
        'app_version': version,
        'app_config': json.dumps(app_config),
        'custom_pages': json.dumps(custom_pages),
        'single_record_pages': json.dumps(single_record_pages),
        'access_token': access_token,
        'dtable_server': dtable_server_url,
        'dtable_socket': dtable_socket_url,
        'dtable_baidu_map_key': DTABLE_BAIDU_MAP_KEY,
        'dtable_mine_map_key': DTABLE_MINE_MAP_KEY,
        'dtable_google_map_key': DTABLE_GOOGLE_MAP_KEY,
        'role_id': role_id,
        'id_in_org': id_in_org,
        'is_admin': is_admin,
        'permission': permission or '',
        'custom_permission': permission_detail or '',
        'custom_url': external_app.custom_url,
        'owner_can_use_advanced_permissions': owner_can_use_advanced_permissions,
        'owner_can_use_advanced_customization': owner_can_use_advanced_customization,
        'use_external_team_admin': USE_EXTERNAL_TEAM_ADMIN,
        'is_org_staff': is_org_staff,
        'mobile_login': mobile_login,
        'enable_addressbook_v2': settings.ENABLE_ADDRESSBOOK_V2,
        'app_name_display': app_name,
        'user_department_ids_map': user_department_ids_map,
        'can_use_ai_assistant': can_use_ai_assistant,
        'big_data_screens_app_support_refresh': BIG_DATA_SCREENS_APP_SUPPORT_REFRESH,
        'share_link_password_min_length': settings.SHARE_LINK_PASSWORD_MIN_LENGTH
    }

    return render(request, 'dtable_external_app_edit_react.html', return_dict)

def dtable_external_app_snapshot_view(request, app_uuid, snapshot_id):
    """
    Permission:
    all users
    """
    # resource check
    external_app = DTableExternalApps.objects.get_external_app_by_uuid(app_uuid)
    if not external_app:
        return render_error(request, _('App does not exist.'))

    if external_app.inactive:
        return render_error(request, _('App is not available.'))


    app_snapshot = DTableAppSnapshot.objects.filter(
        app=external_app,
        pk = snapshot_id
    ).first()

    if not app_snapshot:
        return render_error(request, _('Snapshot does not exist.'))

    app_name = ''
    try:
        app_config = json.loads(app_snapshot.app_config)
        app_name = app_config.get('app_name', '')
    except Exception as e:
        logger.error(e)

    dtable_uuid = external_app.dtable_uuid
    dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
    if not dtable:
        return render_error(request, _('Base does not exist.'))

    if dtable.deleted:
        return render_error(request, _('Base does not exist.'))

    workspace_id = dtable.workspace_id
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        return render_error(request, 'Workspace does not exist.')

    username = request.user.username
    if not check_dtable_admin_permission(username, workspace.owner):
        return render_error(request, 'Permission denied.')

    is_org_staff = request.user.org.is_staff if request.user.org else False
    id_in_org_tuple = IdInOrgTuple.objects.filter(virtual_id=username)
    id_in_org = id_in_org_tuple[0].id_in_org if id_in_org_tuple else ''
    permission_detail, role_id = None, None
    is_admin = True
    open_registration = False
    payload = {
        'exp': int(time.time()) + 3600 * 24 * 3,
        'app_uuid': app_uuid,
        'username': username,
        'permission': PERMISSION_READ_WRITE,
        'user_role_name': 'admin'
    }

    try:
        access_token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    except Exception as e:
        logger.error(e)
        return render_error(request, _('Internal Server Error'))

    request.session['external_app'] = {'asset_access_token': access_token, 'dtable_uuid': dtable.uuid.hex,
                                       'app_type': external_app.app_type}

    version = '0.0.1'
    try:
        for x in DTABLE_APPS_CONFIG:
            if x.get('app_type', '') == external_app.app_type:
                version = x.get('version', '')
    except Exception as e:
        logger.error(e)
        return render_error(request, _('Internal Server Error'))

    if enable_dtable_server_cluster:
        dtable_server_url = get_server_by_dtable_uuid(str(dtable.uuid))
        dtable_socket_url = dtable_server_url
    else:
        dtable_server_url = DTABLE_SERVER_URL
        dtable_socket_url = DTABLE_SOCKET_URL

    owner_can_use_advanced_permissions = can_use_advanced_permissions_by_dtable(dtable)
    owner_can_use_advanced_customization = can_use_advanced_customization_by_dtable(dtable)

    user_department_ids_map = get_departments_map_by_request_dtable(request, dtable)
    custom_pages = get_custom_pages_in_snapshot(app_config, workspace.repo_id, dtable_uuid, snapshot_id)
    single_record_pages = get_single_record_pages_in_snapshot(app_config, workspace.repo_id, dtable_uuid, snapshot_id)
    can_use_ai_assistant = bool(settings.SEATABLE_AI_SERVER_URL)

    return_dict = {
        'workspace_id': workspace_id,
        'dtable_name': dtable.name,
        'app_uuid': app_uuid,
        'dtable_uuid': str(dtable.uuid),
        'app_id': external_app.id,
        'app_type': external_app.app_type,
        'app_name': app_name,
        'app_version': version,
        'app_config': json.dumps(app_config),
        'custom_pages': json.dumps(custom_pages),
        'single_record_pages': json.dumps(single_record_pages),
        'access_token': access_token,
        'dtable_server': dtable_server_url,
        'dtable_socket': dtable_socket_url,
        'dtable_baidu_map_key': DTABLE_BAIDU_MAP_KEY,
        'dtable_mine_map_key': DTABLE_MINE_MAP_KEY,
        'dtable_google_map_key': DTABLE_GOOGLE_MAP_KEY,
        'role_id': role_id or '',
        'id_in_org': id_in_org,
        'is_admin': is_admin,
        'permission': 'r',
        'custom_permission': permission_detail or '',
        'og_title': app_name,
        'og_description': 'Powered by SeaTable',
        'is_open_registration': open_registration,
        'owner_can_use_advanced_permissions': owner_can_use_advanced_permissions,
        'owner_can_use_advanced_customization': owner_can_use_advanced_customization,
        'use_external_team_admin': USE_EXTERNAL_TEAM_ADMIN,
        'is_org_staff': is_org_staff,
        'snapshot_id': app_snapshot.id,
        'app_name_display': '%s (Version %s)' % (app_name, app_snapshot.app_version),
        'user_department_ids_map': user_department_ids_map,
        'can_use_ai_assistant': can_use_ai_assistant,
    }


    return render(request, 'dtable_external_app_snapshot_view_react.html', return_dict)
