# Copyright (c) 2012-2019 Seafile Ltd.

import logging
import json

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.models import DTableExternalApps, DTables
from seahub.dtable.utils import restore_trash_dtable_names
from seahub.utils import uuid_str_to_36_chars
from seahub.ccnet_db.ccnet.organizations import get_orgs_base_info
from seahub.dtable_apps.universal_app.signals import external_app_deleted


logger = logging.getLogger(__name__)

class AdminExternalApps(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request):

        try:
            current_page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '25'))
        except ValueError:
            current_page = 1
            per_page = 25
        start = (current_page - 1) * per_page
        end = start + per_page

        external_app_list = list()
        try:
            external_apps_count = DTableExternalApps.objects.all().count()
            external_apps = DTableExternalApps.objects.all().order_by('-created_at')[start: end]
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if external_apps_count > end:
            has_next_page = True
        else:
            has_next_page = False

        page_info = {
            'has_next_page': has_next_page,
            'current_page': current_page
        }
        for external_app in external_apps:
            obj_dict = external_app.to_dict()
            external_app_list.append(obj_dict)

        dtable_uuid_list = []
        org_id_list = []
        for external_app in external_app_list:
            if external_app['dtable_uuid'] not in dtable_uuid_list:
                dtable_uuid_list.append(external_app['dtable_uuid'])
            if external_app['org_id'] != -1 and external_app['org_id'] not in org_id_list:
                org_id_list.append(external_app['org_id'])

        try:
            dtables = DTables.objects.filter(uuid__in=dtable_uuid_list)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        table_dict = {str(v.uuid): v for v in dtables}
        orgs = get_orgs_base_info(org_id_list)

        for external_app in external_app_list:
            if uuid_str_to_36_chars(external_app['dtable_uuid']) not in table_dict:
                external_app['dtable_deleted'] = True
                external_app['dtable_name'] = '_deleted'
                continue
            dtable = table_dict[uuid_str_to_36_chars(external_app['dtable_uuid'])]
            if not dtable.deleted:
                external_app['dtable_name'] = dtable.name
                external_app['dtable_deleted'] = False
            else:
                external_app['dtable_deleted'] = True
                external_app['dtable_name'] = restore_trash_dtable_names(dtable)[0]
            if external_app['org_id'] != -1:
                if external_app['org_id'] in orgs:
                    external_app['org_name'] = orgs[external_app['org_id']]['org_name']
                else:
                    logger.warning(f'Organization not found with id {external_app["org_id"]}')
        return Response({"external_app_list": external_app_list, 'page_info': page_info}, status=status.HTTP_200_OK)

class AdminSearchExternalApps(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def get(self, request):
        query_str = request.GET.get('query', '')
        if not query_str:
            error_msg = 'query invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        
        # now only support uuid search
        external_app = DTableExternalApps.objects.get_external_app_by_uuid(query_str)
        results = []
        if external_app:
            external_app = external_app.to_dict()
            dtable = DTables.objects.filter(uuid=external_app['dtable_uuid']).first()
            if dtable:
                if not dtable.deleted:
                    external_app['dtable_name'] = dtable.name
                    external_app['dtable_deleted'] = False
                else:
                    external_app['dtable_deleted'] = True
                    external_app['dtable_name'] = restore_trash_dtable_names(dtable)[0]
            else:
                external_app['dtable_deleted'] = True
                external_app['dtable_name'] = '_deleted'
            if external_app['org_id'] != -1:
                orgs = get_orgs_base_info([external_app['org_id']])
                if external_app['org_id'] in orgs:
                    external_app['org_name'] = orgs[external_app['org_id']]['org_name']
                else:
                    logger.warning(f'Organization not found with id {external_app["org_id"]}')
            results.append(external_app)

        return Response({
            'apps': results,
            'count': len(results)
        })

def _check_admin_can_manage_app(func):
    def wrapper(self, request, app_uuid):
        if not request.user.admin_permissions.can_manage_app():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        return func(self, request, app_uuid)
    return wrapper


class AdminExternalApp(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    @_check_admin_can_manage_app
    def put(self, request, app_uuid):
        inactive = request.data.get('inactive', False)
        if type(inactive) is not bool:
            error_msg = 'Invalid inactive'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            external_app = DTableExternalApps.objects.get(app_uuid=app_uuid)
            external_app.inactive = inactive
            external_app.save()
        except DTableExternalApps.DoesNotExist:
            return api_error(status.HTTP_404_NOT_FOUND, 'App not found')
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})

    @_check_admin_can_manage_app
    def delete(self, _, app_uuid):
        try:
            external_app = DTableExternalApps.objects.get(app_uuid=app_uuid)
            external_app_type = external_app.app_type
            external_app_id = external_app.pk
            external_app.delete()

            external_app_deleted.send(
                None,
                app_id=external_app_id,
                app_type=external_app_type
            )
        except DTableExternalApps.DoesNotExist:
            return api_error(status.HTTP_404_NOT_FOUND, 'App not found')
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})
        
class AdminExternalAppOpenAccess(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,) 

    @_check_admin_can_manage_app
    def put(self, request, app_uuid):
        enabled = request.data.get('enabled', False)
        if type(enabled) is not bool:
            error_msg = 'Invalid enabled'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            external_app = DTableExternalApps.objects.get(app_uuid=app_uuid)
            external_app_config = json.loads(external_app.app_config)
            external_app_config['can_anonymous_access'] = enabled
            external_app.app_config = json.dumps(external_app_config)
            external_app.save()
        except DTableExternalApps.DoesNotExist:
            return api_error(status.HTTP_404_NOT_FOUND, 'App not found')
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)
        
        return Response({'success': True})
