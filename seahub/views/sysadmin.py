# Copyright (c) 2012-2016 Seafile Ltd.
# encoding: utf-8

import os
from io import BytesIO
from types import FunctionType
import logging
import json
import re
import datetime
import time
import shutil
from constance import config
from openpyxl import load_workbook

from django.db.models import Q
from django.conf import settings as dj_settings
from django.urls import reverse
from django.contrib import messages
from django.http import HttpResponse, Http404, HttpResponseRedirect, HttpResponseNotAllowed, \
    HttpResponseForbidden, FileResponse
from django.shortcuts import render, get_object_or_404
from django.utils import timezone
from django.utils.translation import gettext as _
from urllib.parse import quote

import seaserv
from seaserv import ccnet_threaded_rpc, seafserv_threaded_rpc, \
    seafile_api, get_group, get_group_members, ccnet_api, \
    get_related_users_by_org_repo
from pysearpc import SearpcError

from seahub.base.accounts import User
from seahub.base.models import UserLastLogin
from seahub.base.decorators import sys_staff_required, require_POST
from seahub.base.sudo_mode import update_sudo_mode_ts
from seahub.base.templatetags.seahub_tags import tsstr_sec, email2nickname, \
    email2contact_email
from seahub.auth import authenticate
from seahub.auth.decorators import login_required, login_required_ajax
from seahub.auth.models import UserQuota
from seahub.constants import GUEST_USER, DEFAULT_USER, DEFAULT_ADMIN, \
        SYSTEM_ADMIN, DAILY_ADMIN, AUDIT_ADMIN, HASH_URLS
from seahub.dtable.models import DTables, Workspaces, IdInOrgTuple
from seahub.dtable.utils import get_users_rows_count
from seahub.invitations.models import Invitation
from seahub.role_permissions.utils import get_available_roles, \
        get_available_admin_roles, get_enabled_role_permissions_by_role
from seahub.role_permissions.models import AdminRole
from seahub.two_factor.models import default_device
from seahub.utils import IS_EMAIL_CONFIGURED, string2list, is_valid_username, \
    is_pro_version, send_html_email, \
    get_server_id, get_max_upload_file_size, \
    get_site_name, render_error, get_inner_fileserver_root, gen_file_get_url 
from seahub.utils.ip import get_remote_ip
from seahub.utils.file_size import get_file_size_unit, byte_to_mb, get_quota_from_string
from seahub.utils.ldap import get_ldap_info
from seahub.utils.licenseparse import parse_license, user_number_over_limit
from seahub.utils.rpc import mute_seafile_api
from seahub.utils.sysinfo import get_platform_name
from seahub.utils.mail import send_html_email_with_dj_template
from seahub.utils.ms_excel import write_xls
from seahub.utils.user_permissions import get_basic_user_roles, \
        get_user_role, get_basic_admin_roles
from seahub.utils.auth import get_login_bg_image_path
from seahub.utils.repo import get_related_users_by_repo, get_repo_owner
from seahub.views import get_system_default_repo_id
from seahub.options.models import UserOptions
from seahub.profile.models import Profile
from seahub.signals import repo_deleted
from seahub.admin_log.signals import admin_operation
from seahub.admin_log.models import USER_DELETE, USER_ADD
from seahub.role_permissions.models import AdminRole
import seahub.settings as settings
from seahub.settings import INIT_PASSWD, SITE_ROOT, IS_SHOW_UNIT, \
    SEND_EMAIL_ON_ADDING_SYSTEM_MEMBER, SEND_EMAIL_ON_RESETTING_USER_PASSWD, \
    ENABLE_GUEST_INVITATION, SEATABLE_MARKET_URL, USE_INNER_FILESERVER_FOR_DTABLE_SERVER, \
    DISABLE_ADDRESSBOOK_V1
try:
    from seahub.settings import MULTI_TENANCY
    from seahub.organizations.models import OrgSettings
except ImportError:
    MULTI_TENANCY = False
try:
    from seahub.settings import ENABLE_SYSADMIN_EXTRA
except ImportError:
    ENABLE_SYSADMIN_EXTRA = False
from seahub.utils.two_factor_auth import has_two_factor_auth
from seahub.work_weixin.settings import ENABLE_WORK_WEIXIN
from seahub.ccnet_db.ccnet.organizations import get_users_org_ids
from seahub.seafile_db.seafile.repo import get_users_storage


logger = logging.getLogger(__name__)
FILE_TYPE = '.dtable'

@login_required
@sys_staff_required
def sysadmin_react_fake_view(request, **kwargs):

    try:
        expire_days = seafile_api.get_server_config_int('library_trash', 'expire_days')
    except Exception as e:
        logger.error(e)
        expire_days = -1

    return render(request, 'sysadmin/sysadmin_react_app.html', {
        'constance_enabled': dj_settings.CONSTANCE_ENABLED,
        'seatable_market_url': SEATABLE_MARKET_URL,
        'is_show_unit': IS_SHOW_UNIT,
        'multi_tenancy': MULTI_TENANCY,
        'multi_institution': getattr(dj_settings, 'MULTI_INSTITUTION', False),
        'send_email_on_adding_system_member': SEND_EMAIL_ON_ADDING_SYSTEM_MEMBER,
        'sysadmin_extra_enabled': ENABLE_SYSADMIN_EXTRA,
        'enable_guest_invitation': ENABLE_GUEST_INVITATION,
        'enable_work_weixin': ENABLE_WORK_WEIXIN,
        'trash_repos_expire_days': expire_days if expire_days > 0 else 30,
        'available_roles': get_available_roles(),
        'available_admin_roles': get_available_admin_roles(),
        'enable_abuse_report': dj_settings.ENABLE_ABUSE_REPORT,
        'two_factor_auth_enabled': has_two_factor_auth(),
        'trash_clean_expire_days': dj_settings.TRASH_CLEAN_AFTER_DAYS,
        'disable_addressbook_v1': DISABLE_ADDRESSBOOK_V1,
        'enable_address_book_v2': dj_settings.ENABLE_ADDRESSBOOK_V2
    })


def can_view_sys_admin_repo(repo):
    default_repo_id = get_system_default_repo_id()
    is_default_repo = True if repo.id == default_repo_id else False

    if is_default_repo:
        return True
    elif repo.encrypted:
        return False
    elif is_pro_version():
        return True
    else:
        return False

def populate_user_info(user):
    """Populate contact email and name to user.
    """
    user.contact_email = email2contact_email(user.email)
    user.name = email2nickname(user.email)

def _populate_user_quota_usage(user):
    """Populate space/share quota to user.

    Arguments:
    - `user`:
    """
    orgs = ccnet_api.get_orgs_by_user(user.email)
    try:
        if orgs:
            user.org = orgs[0]
            org_id = user.org.org_id
            user.space_usage = seafile_api.get_org_user_quota_usage(org_id, user.email)
            user.space_quota = seafile_api.get_org_user_quota(org_id, user.email)
        else:
            user.space_usage = seafile_api.get_user_self_usage(user.email)
            user.space_quota = seafile_api.get_user_quota(user.email)
    except SearpcError as e:
        logger.error(e)
        user.space_usage = -1
        user.space_quota = -1



def email_user_on_activation(user):
    """Send an email to user when admin activate his/her account.
    """
    send_to = user.username
    profile = Profile.objects.get_profile_by_user(user.username)
    if profile and profile.contact_email:
        send_to = profile.contact_email

    c = {
        'username': send_to,
        }
    send_html_email(_('Your account on %s is activated') % get_site_name(),
            'sysadmin/user_activation_email.html', c, None, [send_to])


def send_user_reset_email(request, email, password):
    """
    Send email when reset user password.
    """

    c = {
        'email': email,
        'password': password,
        }
    send_html_email(_('Password has been reset on %s') % get_site_name(),
            'sysadmin/user_reset_email.html', c, None, [email])

def send_user_add_mail(request, email, password):
    """Send email when add new user."""
    c = {
        'user': request.user.username,
        'org': request.user.org,
        'email': email,
        'password': password,
        }
    send_html_email(_('You are invited to join %s') % get_site_name(),
            'sysadmin/user_add_email.html', c, None, [email])

def sys_get_org_base_info(org_id):

    org = ccnet_threaded_rpc.get_org_by_id(org_id)

    # users
    users = ccnet_threaded_rpc.get_org_emailusers(org.url_prefix, -1, -1)
    users_count = len(users)

    # groups
    groups = ccnet_threaded_rpc.get_org_groups(org_id, -1, -1)
    groups_count = len(groups)

    # quota
    total_quota = seafserv_threaded_rpc.get_org_quota(org_id)
    quota_usage = seafserv_threaded_rpc.get_org_quota_usage(org_id)

    return {
            "org": org,
            "users": users,
            "users_count": users_count,
            "groups": groups,
            "groups_count": groups_count,
            "total_quota": total_quota,
            "quota_usage": quota_usage,
           }


@login_required
def sys_sudo_mode(request):
    if request.method not in ('GET', 'POST'):
        return HttpResponseNotAllowed

    # here we can't use @sys_staff_required
    if not request.user.is_staff:
        raise Http404

    next_page = request.GET.get('next', reverse('sys_info'))
    password_error = False
    if request.method == 'POST':
        password = request.POST.get('password')
        username = request.user.username
        ip = get_remote_ip(request)
        if password:
            user = authenticate(username=username, password=password)
            if user:
                update_sudo_mode_ts(request)

                from seahub.auth.utils import clear_login_failed_attempts
                clear_login_failed_attempts(request, username)

                return HttpResponseRedirect(next_page)
        password_error = True

        from seahub.auth.utils import get_login_failed_attempts, incr_login_failed_attempts
        failed_attempt = get_login_failed_attempts(username=username, ip=ip)
        if failed_attempt >= config.LOGIN_ATTEMPT_LIMIT:
            # logout user
            from seahub.auth import logout
            logout(request)
            return HttpResponseRedirect(reverse('auth_login'))
        else:
            incr_login_failed_attempts(username=username, ip=ip)

    enable_shib_login = getattr(settings, 'ENABLE_SHIB_LOGIN', False)
    enable_saml_login = getattr(settings, 'ENABLE_SAML', False)

    login_bg_image_path = get_login_bg_image_path()

    return render(request,
        'sysadmin/sudo_mode.html', {
            'password_error': password_error,
            'enable_sso': enable_shib_login or enable_saml_login,
            'next': next_page,
            'login_bg_image_path': login_bg_image_path,
        })

@login_required
@sys_staff_required
def sys_useradmin_export_excel(request):
    """ Export all users from database to excel
    """
    if not request.user.admin_permissions.can_manage_user():
        return HttpResponseForbidden()

    next_page = request.META.get('HTTP_REFERER', None)
    if not next_page:
        next_page = SITE_ROOT

    try:
        users = ccnet_api.get_emailusers('DB', -1, -1) + \
                ccnet_api.get_emailusers('LDAPImport', -1, -1)
    except Exception as e:
        logger.error(e)
        messages.error(request, _('Failed to export Excel'))
        return HttpResponseRedirect(next_page)

    if is_pro_version():
        is_pro = True
    else:
        is_pro = False

    if is_pro:
        head = [_("Username"), _("Name"), _("Contact email"), _("ID"), _("Status"), _("Role"), _("Rows used"),
                _("Space usage") + "(MB)", _("Space quota") + "(MB)",
                _("Create at"), _("Last login"), _("Admin"), _("Admin role"),]
    else:
        head = [_("Username"), _("Name"), _("Contact email"), _("ID"), _("Status"), _("Rows used"),
                _("Space usage") + "(MB)", _("Space quota") + "(MB)",
                _("Create at"), _("Last login"), _("Admin"), _("Admin role"),]

    # only operate 100 users for every `for` loop
    looped = 0
    limit = 100
    data_list = []
    while looped < len(users):

        current_users = users[looped:looped+limit]

        email_list = [user.email for user in current_users]
        email2id_in_org = IdInOrgTuple.objects.gen_virtual_id2id_in_org_dict(email_list)
        rows_count_dict = get_users_rows_count(email_list)

        last_logins = UserLastLogin.objects.filter(username__in=[x.email \
                for x in current_users])
        user_profiles = Profile.objects.filter(user__in=[x.email \
                for x in current_users])

        org_ids_dict = get_users_org_ids(email_list)
        storages_dict = get_users_storage(email_list)
        quotas_dict = {item.username: item.asset_quota for item in UserQuota.objects.filter(username__in=email_list)}

        for user in current_users:
            # populate name and contact email
            user.contact_email = ''
            user.name = ''
            for profile in user_profiles:
                if profile.user == user.email:
                    user.contact_email = profile.contact_email
                    user.name = profile.nickname

            ID = email2id_in_org.get(user.email, '--')

            # populate space usage and quota
            MB = get_file_size_unit('MB')

            rows_used = rows_count_dict.get(user.email, 0)

            # storage usage and quota
            space_usage_MB = round(float(storages_dict.get(user.email, 0)) / MB, 2)
            if user.email in quotas_dict and user.email not in org_ids_dict:
                if quotas_dict[user.email] > 0:
                    space_quota_MB = byte_to_mb(quotas_dict[user.email])
                else:
                    space_quota_MB = ''
            else:
                if user.email not in org_ids_dict:
                    role_quota = get_enabled_role_permissions_by_role(user.role).get('role_asset_quota', '')
                    space_quota_MB = get_quota_from_string(role_quota) if role_quota else ''
                else:
                    space_quota_MB = ''

            # populate user last login time
            user.last_login = None
            for last_login in last_logins:
                if last_login.username == user.email:
                    user.last_login = last_login.last_login

            if user.is_active:
                status = _('Active')
            else:
                status = _('Inactive')

            create_at = tsstr_sec(user.ctime) if user.ctime else ''
            last_login = user.last_login.strftime("%Y-%m-%d %H:%M:%S") if \
                user.last_login else ''

            if user.is_staff:
                is_admin = _('Yes')
                try:
                    admin_role = AdminRole.objects.get_admin_role(user.email).role
                except:
                    admin_role = DEFAULT_ADMIN
            else:
                is_admin = _('No')
                admin_role = '--'

            if is_pro:
                if user.email not in org_ids_dict:
                    if user.role:
                        if user.role == GUEST_USER:
                            role = _('Guest')
                        elif user.role == DEFAULT_USER:
                            role = _('Default')
                        else:
                            role = user.role
                    else:
                        role = _('Default')
                else:
                    role = "--"

                row = [user.email, user.name, user.contact_email, ID, status, role, rows_used,
                        space_usage_MB, space_quota_MB, create_at,
                        last_login, is_admin, admin_role]
            else:
                row = [user.email, user.name, user.contact_email, ID, status, rows_used,
                        space_usage_MB, space_quota_MB, create_at,
                        last_login, is_admin, admin_role]

            data_list.append(row)

        # update `looped` value when `for` loop finished
        looped += limit

    wb = write_xls('users', head, data_list)
    if not wb:
        messages.error(request, _('Failed to export Excel'))
        return HttpResponseRedirect(next_page)

    response = HttpResponse(content_type='application/ms-excel')
    response['Content-Disposition'] = 'attachment; filename=users.xlsx'
    wb.save(response)
    return response


@login_required
@sys_staff_required
def sys_group_admin_export_excel(request):
    """ Export all groups to excel
    """

    next_page = request.META.get('HTTP_REFERER', None)
    if not next_page:
        next_page = SITE_ROOT

    try:
        groups = ccnet_threaded_rpc.get_all_groups(-1, -1)
    except Exception as e:
        logger.error(e)
        messages.error(request, _('Failed to export Excel'))
        return HttpResponseRedirect(next_page)

    head = [_("Name"), _("Creator"), _("Create at")]
    data_list = []
    for grp in groups:
        create_at = tsstr_sec(grp.timestamp) if grp.timestamp else ''
        row = [grp.group_name, grp.creator_name, create_at]
        data_list.append(row)

    wb = write_xls('groups', head, data_list)
    if not wb:
        messages.error(request, _('Failed to export Excel'))
        return HttpResponseRedirect(next_page)

    response = HttpResponse(content_type='application/ms-excel')
    response['Content-Disposition'] = 'attachment; filename=groups.xlsx'
    wb.save(response)
    return response

@login_required
@sys_staff_required
def sys_dtable_admin_export_dtable(request):
    if not request.user.admin_permissions.can_manage_base():
        return HttpResponseForbidden()

    task_id = request.GET.get('task_id', '')
    if not task_id:
        error_msg = 'task_id invalid.'
        return render_error(request, error_msg)

    dtable_uuid = request.GET.get('dtable_uuid', '')
    if not dtable_uuid:
        error_msg = 'dtable_uuid invalid.'
        return render_error(request, error_msg)

    dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
    if not dtable:
        error_msg = 'Base not found.'
        return render_error(request, error_msg)

    tmp_zip_path = os.path.join('/tmp/dtable-io', str(dtable.uuid), 'zip_file') + '.zip'
    if not os.path.exists(tmp_zip_path):
        error_msg = 'Internal Server Error'
        return render_error(request, error_msg)

    response = FileResponse(open(tmp_zip_path, 'rb'), content_type="application/x-zip-compressed", as_attachment=True)
    response['Content-Disposition'] = 'attachment;filename*=UTF-8\'\'' + quote(dtable.dtable_name) + '.dtable'

    tmp_dir = os.path.join('/tmp/dtable-io', str(dtable.uuid))
    if os.path.exists(tmp_dir):
        shutil.rmtree(tmp_dir)

    return response

@login_required
@sys_staff_required
def batch_add_user_example(request):
    """ get example file.
    """
    next_page = request.META.get('HTTP_REFERER', None)
    if not next_page:
        next_page = SITE_ROOT
    data_list = []
    head = [_('Contact email'), _('Password'), 'ID' + '(' + _('Optional') + ')', _('Name')+ '(' + _('Optional') + ')',
            _('Role') + '(' + _('Optional') + ')', _('Space quota') + '(MB, ' + _('Optional') + ')', _('Row quota') + '(' + _('Optional') + ')']
    for i in range(5):
        username = "test" + str(i) +"@example.com"
        password = "123456"
        id_in_org = "%03d" % i
        name = "test" + str(i)
        role = "default"
        quota = "1000"
        row_quota = "5000"
        data_list.append([username, password, id_in_org, name, role, quota, row_quota])

    wb = write_xls('sample', head, data_list)
    if not wb:
        messages.error(request, _('Failed to export Excel'))
        return HttpResponseRedirect(next_page)

    response = HttpResponse(content_type='application/ms-excel')
    response['Content-Disposition'] = 'attachment; filename=users.xlsx'
    wb.save(response)
    return response


def dtable_download_view(request):

    if not bool(request.user.is_authenticated and request.user.is_staff):
        error_msg = 'Permission denied.'
        return render_error(request, error_msg)
    dtable_name = request.GET.get('dtable_name', None)

    repo_id = request.GET.get('repo_id')
    table_name = dtable_name.split(".")[0]
    repo = seafile_api.get_repo(repo_id)
    if not repo:
        error_msg = 'Library %s not found.' % repo_id
        return render_error(request, error_msg)

    username = request.user.username
    table_file_name = table_name + FILE_TYPE
    try:
        file_path = '/' + table_file_name
        file_id = seafile_api.get_file_id_by_path(repo_id, file_path)
        if not file_id:
            error_msg = 'file %s not found.' % table_file_name
            return render_error(request, error_msg)

        token = seafile_api.get_fileserver_access_token(repo_id, file_id, 'download',
                                                        username, use_onetime=False)
    except Exception as e:
        logger.error(e)
        error_msg = 'Internal Server Error'
        return render_error(request, error_msg)

    if USE_INNER_FILESERVER_FOR_DTABLE_SERVER:
        download_link = '%s/files/%s/%s' % (get_inner_fileserver_root(), token, quote(table_name))
    else:
        download_link = gen_file_get_url(token, table_name)

    return HttpResponseRedirect(download_link)
