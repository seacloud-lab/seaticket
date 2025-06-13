# Copyright (c) 2012-2016 Seafile Ltd.
import logging

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from django.utils.crypto import get_random_string

from seahub.constants import ORG_DEFAULT
from seahub.utils.file_size import get_file_size_unit
from seahub.utils.timeutils import timestamp_to_isoformat_timestr
from seahub.utils import is_valid_email
from seahub.base.accounts import User
from seahub.base.templatetags.seahub_tags import email2nickname, \
        email2contact_email
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, to_python_boolean
from seahub.api2.permissions import IsProVersion
from seahub.role_permissions.utils import get_available_roles
from seahub.profile.models import Profile
from seahub.organizations.models import OrgSAMLConfig, Organization, OrgUser, OrgGroup
from seahub.organizations.signals import org_role_updated
from seahub.project.models import Workspaces

try:
    from seahub.settings import ORG_MEMBER_QUOTA_ENABLED
except ImportError:
    ORG_MEMBER_QUOTA_ENABLED= False

if ORG_MEMBER_QUOTA_ENABLED:
    from seahub.organizations.models import OrgMemberQuota

try:
    from seahub.settings import CLOUD_MODE
except ImportError:
    CLOUD_MODE = False

try:
    from seahub.settings import MULTI_TENANCY
    from seahub.organizations.models import OrgSettings, OrgQuota, OrgCorpAuth
except ImportError:
    MULTI_TENANCY = False

try:
    from seahub.settings import ENABLE_MULTI_SAML
except ImportError:
    ENABLE_MULTI_SAML = False

logger = logging.getLogger(__name__)


def get_org_info(org):
    org_id = org.org_id

    org_info = {}
    org_info['bound_dingtalk'] = False
    org_info['bound_workweixin'] = False
    org_info['org_id'] = org_id
    org_info['org_name'] = org.org_name
    org_info['ctime'] = timestamp_to_isoformat_timestr(org.ctime)
    org_info['org_url_prefix'] = org.url_prefix
    org_info['role'] = OrgSettings.objects.get_role_by_org(org)

    corp_auth = OrgCorpAuth.objects.get_by_org_id(org_id)
    if corp_auth:
        if corp_auth.permanent_code:
            org_info['bound_workweixin'] = True
        else:
            org_info['bound_dingtalk'] = True

    creator = org.creator
    org_info['creator_email'] = creator
    org_info['creator_name'] = email2nickname(creator)
    org_info['creator_contact_email'] = email2contact_email(creator)

    return org_info


def get_org_detailed_info(org):
    org_id = org.org_id
    org_info = get_org_info(org)

    # users

    users = ccnet_api.get_org_emailusers(org.url_prefix, -1, -1)
    org_info['users_count'] = len(users)

    active_users_count = len([m for m in users if m.is_active])
    org_info['active_users_count'] = active_users_count

    # groups
    groups = ccnet_api.get_org_groups(org_id, -1, -1)
    org_info['groups_count'] = len(groups)

    # saml config
    org_info['enable_multi_saml'] = False
    if ENABLE_MULTI_SAML:
        org_saml_config = OrgSAMLConfig.objects.get_config_by_org_id(org_id)
        if org_saml_config:
            org_info['enable_multi_saml'] = True
            org_info['metadata_url'] = org_saml_config.metadata_url
            org_info['domain'] = org_saml_config.domain

    return org_info


def gen_org_url_prefix(max_trial=None, length=20):
    """Generate organization url prefix automatically.
    If ``max_trial`` is large than 0, then re-try that times if failed.
    Arguments:
    - `max_trial`:
    Returns:
        Url prefix if succed, otherwise, ``None``.
    """
    def _gen_prefix():
        url_prefix = 'org-' + get_random_string(
            length, allowed_chars='abcdefghijklmnopqrstuvwxyz0123456789')
        if Organization.objects.get_org_by_url_prefix(url_prefix) is not None:
            logger.error("org url prefix, %s is duplicated" % url_prefix)
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

    logger.error("Failed to generate org url prefix, retry: %d" % max_trial)
    return None


def get_orgs_info_by_role(role, page, per_page):
    start = (page - 1) * per_page
    end = page * per_page
    result = []

    org_settings_queryset = OrgSettings.objects.filter(role=role)[start:end]
    org_ids = [org_setting.org_id for org_setting in org_settings_queryset]
    if org_ids:
        orgs_info_dict = get_orgs_base_info(org_ids)
        for org_id in org_ids:
            try:
                org_info = orgs_info_dict.get(org_id)
                org_info['ctime'] = timestamp_to_isoformat_timestr(org_info.get('ctime'))
                org_info['role'] = role
                creator = org_info.get('creator')
                org_info.pop('creator')
                org_info['creator_email'] = creator
                org_info['creator_name'] = email2nickname(creator)
                org_info['creator_contact_email'] = email2contact_email(creator)

                org_info['quota'] = seafile_api.get_org_quota(org_id)
                if ORG_MEMBER_QUOTA_ENABLED:
                    org_info['max_user_number'] = OrgMemberQuota.objects.get_quota(org_id)

                result.append(org_info)
            except Exception as e:
                logger.error(e)
                continue
    return result


class AdminOrganizations(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser, IsProVersion)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """ Get all organizations

        Permission checking:
        1. only admin can perform this action.
        """

        if not (CLOUD_MODE and MULTI_TENANCY):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not request.user.admin_permissions.can_manage_organization():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 25))
        except:
            page = 1
            per_page = 25

        start = (page - 1) * per_page
        role = request.GET.get('role', None)
        if role:
            sql = """SELECT a.org_id, org_name, url_prefix, b.role FROM organization_organization a 
                        INNER JOIN organizations_orgsettings b ON a.org_id=b.org_id WHERE b.role=%s
                        ORDER BY a.ctime desc LIMIT %s OFFSET %s"""

            organizations = Organization.objects.raw(sql, (role, per_page, start))
            result = []
            for org in organizations:
                org_info = get_org_info(org)
                result.append(org_info)

            total_count = OrgSettings.objects.filter(role=role).count()
            return Response({'organizations': result, 'count': total_count})

        try:
            end = start + per_page
            org_objects = Organization.objects.all()

            orgs = org_objects.order_by('-ctime')[start: end]
            total_count = org_objects.count()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        result = []
        # rows_count_dict = get_orgs_rows_count([org.org_id for org in orgs])
        for org in orgs:
            org_info = get_org_info(org)
            result.append(org_info)

        return Response({'organizations': result, 'count': total_count})

    def post(self, request):
        """ Create an organization

        Permission checking:
        1. only admin can perform this action.
        """
        if not (CLOUD_MODE and MULTI_TENANCY):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not request.user.admin_permissions.can_manage_organization():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        org_name = request.data.get('org_name', None)
        if not org_name:
            error_msg = 'org_name invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        admin_email = request.data.get('admin_email', None)
        if not admin_email or not is_valid_email(admin_email):
            error_msg = 'admin_email invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        admin_name = request.data.get('admin_name')

        password = request.data.get('password', None)
        if not password:
            error_msg = 'password invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        url_prefix = gen_org_url_prefix(5, 20)
        if Organization.objects.get_org_by_url_prefix(url_prefix):
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        try:
            User.objects.get(email=admin_email)
        except User.DoesNotExist:
            pass
        else:
            error_msg = "User %s already exists." % admin_email
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # check profile
        if Profile.objects.filter(contact_email=admin_email).exists():
            error_msg = "User %s already exists." % admin_email
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            new_user = User.objects.create_user(admin_email, password,
                                                is_staff=False, is_active=True)
        except User.DoesNotExist as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # update profile nickname
        if admin_name:
            Profile.objects.add_or_update(new_user.username, nickname=admin_name)

        try:
            org = Organization.objects.create_org(org_name, url_prefix, new_user.username)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        OrgSettings.objects.add_or_update(org, ORG_DEFAULT)
        try:
            org_info = get_org_info(org)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        with_workspace = request.data.get('with_workspace', False)
        if with_workspace:
            try:
                workspace = Workspaces.objects.create_workspace(new_user.username, org.org_id)
                org_info['workspace_id'] = workspace.id
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response(org_info)

class AdminOrganization(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser, IsProVersion)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, org_id):
        """ Get base info of a organization

        Permission checking:
        1. only admin can perform this action.
        """

        if not (CLOUD_MODE and MULTI_TENANCY):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not (request.user.admin_permissions.can_manage_organization() or \
                request.user.admin_permissions.can_update_organization()):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        org_id = int(org_id)
        if org_id == 0:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        org = Organization.objects.get_org_by_id(org_id)
        if not org:
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            org_info = get_org_detailed_info(org)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response(org_info)

    def put(self, request, org_id):
        """ Update base info of a organization

        Permission checking:
        1. only admin can perform this action.
        """

        if not (CLOUD_MODE and MULTI_TENANCY):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not (request.user.admin_permissions.can_manage_organization() or \
                request.user.admin_permissions.can_update_organization()):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        org_id = int(org_id)
        if org_id == 0:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        org = ccnet_api.get_org_by_id(org_id)
        if not org:
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # update org name
        new_name = request.data.get('org_name', None)
        if new_name:
            try:
                ccnet_api.set_org_name(org_id, new_name)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # update org max user number
        max_user_number = request.data.get('max_user_number', None)
        if max_user_number and ORG_MEMBER_QUOTA_ENABLED:

            try:
                max_user_number = int(max_user_number)
            except ValueError:
                error_msg = 'max_user_number invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if max_user_number <= 0:
                error_msg = 'max_user_number invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            try:
                OrgMemberQuota.objects.set_quota(org_id, max_user_number)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        quota_mb = request.data.get('quota', None)
        if quota_mb:

            try:
                quota_mb = int(quota_mb)
            except ValueError:
                error_msg = 'quota invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            if quota_mb < 0:
                error_msg = 'quota invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)


            quota = quota_mb * get_file_size_unit('MB')
            try:
                seafile_api.set_org_quota(org_id, quota)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        # check and save
        role = request.data.get('role')
        if role:
            if role not in get_available_roles():
                error_msg = 'Role %s invalid.' % role
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            OrgSettings.objects.add_or_update(org, role=role)
            org_role_updated.send(None, org_id=org_id)

        # row limit and asset quota and big data row limit
        row_limit = request.data.get('row_limit')
        if row_limit:
            try:
                row_limit = int(row_limit)
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'Must be an integer that is greater than or equal to 0.')
            if row_limit < 0:
                return api_error(status.HTTP_400_BAD_REQUEST, 'Row limit is too low (minimum value is 0).')

        # api-calls-count
        monthly_api_call_limit_per_user = request.data.get('monthly_api_call_limit_per_user')
        if monthly_api_call_limit_per_user:
            try:
                monthly_api_call_limit_per_user = int(monthly_api_call_limit_per_user)
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'Must be an integer that is greater than or equal to 0.')
            if monthly_api_call_limit_per_user < 0:
                return api_error(status.HTTP_400_BAD_REQUEST, 'Limit of API calls is too low (minimum value is 0).')

        asset_quota_mb, asset_quota = request.data.get('asset_quota_mb'), None
        if asset_quota_mb:
            try:
                asset_quota_mb = int(asset_quota_mb)
            except ValueError:
                error_msg = "Must be an integer that is greater than or equal to 0."
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            if asset_quota_mb < 0:
                error_msg = "Space quota is too low (minimum value is 0)."
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            asset_quota = asset_quota_mb * get_file_size_unit('MB')

        big_data_storage_quota_mb, big_data_storage_quota = request.data.get('big_data_storage_quota_mb'), None
        if big_data_storage_quota_mb:
            try:
                big_data_storage_quota_mb = int(big_data_storage_quota_mb)
            except ValueError:
                error_msg = "Must be an integer that is greater than or equal to 0."
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            if big_data_storage_quota_mb < 0:
                error_msg = "Space quota is too low (minimum value is 0)."
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            big_data_storage_quota = big_data_storage_quota_mb * get_file_size_unit('MB')
        big_data_row_limit = request.data.get('big_data_row_limit')
        if big_data_row_limit:
            try:
                big_data_row_limit = int(big_data_row_limit)
            except ValueError:
                error_msg = "Must be an integer that is greater than or equal to 0."
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            if big_data_row_limit < 0:
                error_msg = "Big data storage quota is too low (minimum value is 0)."
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        if (row_limit is not None or
            asset_quota_mb is not None or
            big_data_row_limit is not None or
            big_data_storage_quota_mb is not None or
            monthly_api_call_limit_per_user is not None):
            OrgQuota.objects.add_or_update(org,
                                           row_limit=row_limit,
                                           asset_quota=asset_quota,
                                           big_data_row_limit=big_data_row_limit,
                                           big_data_storage_quota=big_data_storage_quota,
                                           monthly_api_call_limit_per_user=monthly_api_call_limit_per_user)

        # perhaps need to update exceed api calls status
        try:
            api_calls_limit = OrgQuota.objects.get_monthly_api_call_limit(org_id)
            api_calls_count = StatsAPIGatewayByTeam.objects.get_month_all_count(org_id)
            exceed_obj = ExceedAPIQuotaTeams.objects.filter(org_id=org_id).first()
            need_publish_redis = False
            if api_calls_limit < 0 or api_calls_count < api_calls_limit:
                if exceed_obj:
                    need_publish_redis = True
                    exceed_obj.delete()
            else:
                if not exceed_obj:
                    ExceedAPIQuotaTeams.objects.create(org_id=org_id, owner_id='', api_limit=api_calls_limit)
                    need_publish_redis = True
        except Exception as e:
            logger.exception('check org_id: %s exceed api quota error: %s', org_id, e)

        org = ccnet_api.get_org_by_id(org_id)
        org_info = get_org_info(org)
        return Response(org_info)

    def delete(self, request, org_id):
        """ Delete an organization

        Permission checking:
        1. only admin can perform this action.
        """

        if not (CLOUD_MODE and MULTI_TENANCY):
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        if not request.user.admin_permissions.can_manage_organization():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        org_id = int(org_id)
        if org_id == 0:
            error_msg = 'org_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        org = Organization.objects.get_org_by_id(org_id=org_id)
        if not org:
            error_msg = 'Organization %s not found.' % org_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            # remove org users
            users = Organization.objects.get_org_users_by_url_prefix(org.url_prefix)
            for u in users:
                OrgUser.objects.remove_org_user(org_id, u.email)
                User.objects.get(email=u.email).delete()

            # remove org groups
            OrgGroup.objects.remove_org_groups(org_id)

            # remove org
            Organization.objects.remove_org(org_id)

            # remove org settings
            OrgSettings.objects.filter(org_id=org_id).delete()

            # # remove org org quota
            # OrgQuota.objects.filter(org_id=org_id).delete()

            # # reset org corp
            OrgCorpAuth.objects.filter(org_id=org_id).update(org_id=None)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})


class AdminSearchOrganization(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser, IsProVersion)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """ Search organization by name.

        Permission checking:
        1. only admin can perform this action.
        """

        if not MULTI_TENANCY:
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        query_str = request.GET.get('query', '').lower().strip()
        if not query_str:
            error_msg = 'query invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        search_by_id = to_python_boolean(request.GET.get('search_by_id', 'false'))
        if search_by_id:
            try:
                query_str = int(query_str)
                org = ccnet_threaded_rpc.get_org_by_id(query_str)
                orgs = org and [org, ] or []
            except ValueError:
                orgs = []
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        else:
            try:
                orgs = ccnet_threaded_rpc.search_orgs(query_str)
            except Exception as e:
                logger.error(e)
                error_msg = 'Internal Server Error'
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        result = []
        for org in orgs:
            org_info = get_org_info(org)
            result.append(org_info)

        return Response({'organization_list': result})

class AdminOrganizationsBaseInfo(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser, IsProVersion)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        '''
        Get base info of organizations in bulk by ids
        '''
        if not MULTI_TENANCY:
            error_msg = 'Feature is not enabled.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        org_ids = request.GET.getlist('org_ids',[])
        include_org_staffs = to_python_boolean(request.GET.get('include_org_staffs', 'false'))
        orgs = []
        for org_id in org_ids:
            try:
                org = ccnet_threaded_rpc.get_org_by_id(int(org_id))
                if not org:
                    continue
            except:
                continue
            base_info = {'org_id': org.org_id, 'org_name': org.org_name}
            if include_org_staffs:
                staffs = get_org_staffs(int(org_id))
                base_info.update({'org_staffs': staffs})
            orgs.append(base_info)
        return Response({'organization_list': orgs})
