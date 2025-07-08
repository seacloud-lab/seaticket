# Copyright (c) 2012-2016 Seafile Ltd.
import logging

from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from seahub import settings
from seahub.utils import is_pro_version
from seahub.utils.licenseparse import parse_license

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.project.models import Projects

try:
    from seahub.settings import MULTI_TENANCY
except ImportError:
    MULTI_TENANCY = False

SEAQA_VERSION = getattr(settings, 'SEAQA_VERSION', 'Dev')
logger = logging.getLogger(__name__)

class SysInfo(APIView):
    """Show system info.
    """
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request, format=None):
        # permission check
        if not request.user.admin_permissions.can_view_system_info():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
        # count groups
        try:
            groups_count = len(ccnet_api.get_all_groups(-1, -1))
        except Exception as e:
            logger.error(e)
            groups_count = 0

        # count orgs
        if MULTI_TENANCY:
            multi_tenancy_enabled = True
            try:
                org_count = ccnet_api.count_orgs()
            except Exception as e:
                logger.error(e)
                org_count = 0
        else:
            multi_tenancy_enabled = False
            org_count = 0

        # count users
        try:
            active_db_users = ccnet_api.count_emailusers('DB')
        except Exception as e:
            logger.error(e)
            active_db_users = 0

        try:
            active_ldap_users = ccnet_api.count_emailusers('LDAP')
        except Exception as e:
            logger.error(e)
            active_ldap_users = 0

        try:
            inactive_db_users = ccnet_api.count_inactive_emailusers('DB')
        except Exception as e:
            logger.error(e)
            inactive_db_users = 0

        try:
            inactive_ldap_users = ccnet_api.count_inactive_emailusers('LDAP')
        except Exception as e:
            logger.error(e)
            inactive_ldap_users = 0

        active_users = active_db_users + active_ldap_users if \
            active_ldap_users > 0 else active_db_users

        inactive_users = inactive_db_users + inactive_ldap_users if \
            inactive_ldap_users > 0 else inactive_db_users

        # get license info
        is_pro = is_pro_version()
        if is_pro:
            license_dict = parse_license()
        else:
            license_dict = {}

        if license_dict:
            with_license = True
            try:
                max_users = int(license_dict.get('MaxUsers', 3))
            except ValueError as e:
                logger.error(e)
                max_users = 0
        else:
            with_license = False
            max_users = 0

        # count projects
        try:
            projects_count = Projects.objects.count()
        except Exception as e:
            logger.error(e)
            projects_count = 0

        info = {
            'version': SEAQA_VERSION,
            'users_count': active_users + inactive_users,
            'active_users_count': active_users,
            'groups_count': groups_count,
            'org_count': org_count,
            'projects_count': projects_count,
            'multi_tenancy_enabled': multi_tenancy_enabled,
            'is_pro': is_pro,
            'with_license': with_license,
            'license_expiration': license_dict.get('Expiration', ''),
            'license_mode': license_dict.get('Mode', ''),
            'license_maxusers': max_users,
            'license_to': license_dict.get('Name', ''),
        }

        return Response(info)
