import os
import jwt
import json
import time
import logging
import requests

from django.conf import settings
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from seaserv import seafile_api, ccnet_api

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, gen_file_get_url
from seahub.auth.models import UserQuota
from seahub.ccnet_db.ccnet.users import get_users_role
from seahub.constants import PERMISSION_READ_WRITE, PERMISSION_READ, PERMISSION_PREFIX
from seahub.dtable.models import DTables, IdInOrgTuple
from seahub.dtable.utils import check_dtable_permission, can_run_python_by_dtable
from seahub.organizations.models import OrgQuota, OrgSettings
from seahub.role_permissions.utils import get_enabled_role_permissions_by_role
try:
    from seahub.settings import MULTI_TENANCY
except ImportError:
    MULTI_TENANCY = False

logger = logging.getLogger(__name__)


PERMISSION_TUPLE = (PERMISSION_READ_WRITE, PERMISSION_READ)

def _get_temp_api_token(dtable_uuid, script_name, username=''):
    # seahub/api2/endpoints/dtable_api_token.py DTableTempAPITokenView
    EXPIRE_TIME = 60 * 60
    temp_api_token = jwt.encode({
        'dtable_uuid': dtable_uuid,
        'app_name': script_name,
        'exp': int(time.time()) + EXPIRE_TIME,
        'username': username
    }, settings.SEATABLE_FAAS_AUTH_TOKEN, algorithm='HS256')

    return temp_api_token


class RunScriptView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, dtable_uuid, script_name):
        """
        run script files, now only python
        """
        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

        # permission check
        if not can_run_python_by_dtable(dtable):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
        username = request.user.username
        permission = check_dtable_permission(username, dtable.workspace, dtable=dtable)
        if not permission or not (permission in PERMISSION_TUPLE or PERMISSION_PREFIX in permission):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        # script check
        repo_id = dtable.workspace.repo_id
        script_path = os.path.join('/asset', str(dtable.uuid), 'scripts', script_name)
        asset_id = seafile_api.get_file_id_by_path(repo_id, script_path)
        if not asset_id:
            return api_error(status.HTTP_404_NOT_FOUND, 'Script not found.')

        token = seafile_api.get_fileserver_access_token(
            repo_id, asset_id, 'download', '', use_onetime=True)
        if not token:
            return api_error(status.HTTP_404_NOT_FOUND, 'Script not found.')

        # script_url
        script_url = gen_file_get_url(token, script_name)

        # temp_api_token
        temp_api_token = _get_temp_api_token(dtable_uuid, script_name, username=username)

        context_data = request.data

        owner = dtable.workspace.owner
        # org_id
        org_id, scripts_running_limit = -1, -1
        if MULTI_TENANCY:
            if '@seafile_group' not in owner:
                orgs = ccnet_api.get_orgs_by_user(owner)
                if orgs:
                    org_id = orgs[0].org_id
            else:
                group_id = owner[:owner.find('@seafile_group')]
                org_id = ccnet_api.get_org_id_by_group(int(group_id))

        if org_id != -1:
            scripts_running_limit = OrgQuota.objects.get_scripts_running_limit(org_id)
        elif org_id == -1 and '@seafile_group' not in owner:
            scripts_running_limit, error = UserQuota.objects.get_scripts_running_limit(owner)
            if error:
                return api_error(status.HTTP_404_NOT_FOUND, error)

        # call faas func, return script_id
        headers = {'Authorization': 'Token ' + settings.SEATABLE_FAAS_AUTH_TOKEN}
        url = settings.SEATABLE_FAAS_URL.strip('/') + '/run-script/'

        id_in_org_tuple = IdInOrgTuple.objects.filter(virtual_id=username)
        id_in_org = id_in_org_tuple[0].id_in_org if id_in_org_tuple else None

        if isinstance(context_data, dict):
            context_data['current_user_id'] = username
            context_data['current_username'] = username
            context_data['current_id_in_org'] = id_in_org

        try:
            response = requests.post(url, json={
                'dtable_uuid': str(dtable.uuid),
                'script_name': script_name,
                'context_data': context_data,
                'owner': owner,  # workspace's owner
                'org_id': org_id,
                'script_url': script_url,
                'temp_api_token': temp_api_token,
                'scripts_running_limit': scripts_running_limit,
            }, headers=headers, timeout=10)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')
        else:
            if response.status_code != 200:
                return api_error(response.status_code, response.text)
            # script_id
            try:
                script = response.json()
            except Exception as err:
                logger.error('run script error: %s, err: %s', err, response.content)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response(script)


class ScriptResultView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, dtable_uuid, script_name, script_id):
        """
        get script result by script_id
        """
        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

        # permission check
        if not can_run_python_by_dtable(dtable):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
        username = request.user.username
        if check_dtable_permission(username, dtable.workspace, dtable=dtable) != PERMISSION_READ_WRITE:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        # get script result
        headers = {'Authorization': 'Token ' + settings.SEATABLE_FAAS_AUTH_TOKEN}
        url = settings.SEATABLE_FAAS_URL.strip('/') + '/run-script/' + str(script_id) + \
            '/?dtable_uuid=' + str(dtable.uuid) + '&script_name=' + script_name
        try:
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code != 200:
                return api_error(response.status_code, response.text)

            # there is a `output`, normal output or error output, and a `return_code`, 0 success 1 fail, in response json
            # just return it
            result = response.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response(result)


class ScriptTaskView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def delete(self, request, dtable_uuid, script_name):
        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

        # permission check
        if not can_run_python_by_dtable(dtable):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
        username = request.user.username
        permission = check_dtable_permission(username, dtable.workspace, dtable=dtable)
        if not permission or not (permission in PERMISSION_TUPLE or PERMISSION_PREFIX in permission):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        # script check
        repo_id = dtable.workspace.repo_id
        script_path = os.path.join('/asset', str(dtable.uuid), 'scripts', script_name)
        asset_id = seafile_api.get_file_id_by_path(repo_id, script_path)
        if not asset_id:
            return Response({'success': True})

        try:
            seafile_api.del_file(repo_id, os.path.dirname(script_path), json.dumps([script_name]), '')
        except Exception as e:
            logger.error('repo: %s path: %s, delete file error: %s', repo_id, script_path, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})


class ScriptTaskLogsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, dtable_uuid, script_name):
        """
        get script task logs
        """

        try:
            current_page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '20'))
        except ValueError:
            current_page = 1
            per_page = 20

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

        # permission check
        if not can_run_python_by_dtable(dtable):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
        username = request.user.username
        if check_dtable_permission(username, dtable.workspace, dtable=dtable) != PERMISSION_READ_WRITE:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        # script check
        repo_id = dtable.workspace.repo_id
        script_path = os.path.join('/asset', str(dtable.uuid), 'scripts', script_name)
        asset_id = seafile_api.get_file_id_by_path(repo_id, script_path)
        if not asset_id:
            return api_error(status.HTTP_404_NOT_FOUND, 'Script not found.')

        # get task logs
        headers = {'Authorization': 'Token ' + settings.SEATABLE_FAAS_AUTH_TOKEN}
        url = settings.SEATABLE_FAAS_URL.strip('/') + '/tasks/' + \
            str(dtable.uuid) + '/' + script_name + '/logs/'
        params = {
            'page': current_page,
            'per_page': per_page,
        }
        try:
            response = requests.get(url, params=params, headers=headers, timeout=10)

            if response.status_code != 200:
                return api_error(response.status_code, response.text)

            task_logs = response.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response(task_logs)


class ScriptTaskLogView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, dtable_uuid, script_name, log_id):
        """
        get script task log output
        """
        order_by = request.GET.get('order_by', '-id')
        if order_by.strip('-') not in ('id',):
            return api_error(status.HTTP_400_BAD_REQUEST, 'order_by invalid.')
        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

        # permission check
        if not can_run_python_by_dtable(dtable):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')
        username = request.user.username
        if check_dtable_permission(username, dtable.workspace, dtable=dtable) != PERMISSION_READ_WRITE:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        # script check
        repo_id = dtable.workspace.repo_id
        script_path = os.path.join('/asset', str(dtable.uuid), 'scripts', script_name)
        asset_id = seafile_api.get_file_id_by_path(repo_id, script_path)
        if not asset_id:
            return api_error(status.HTTP_404_NOT_FOUND, 'Script not found.')

        # get task log
        headers = {'Authorization': 'Token ' + settings.SEATABLE_FAAS_AUTH_TOKEN}
        url = settings.SEATABLE_FAAS_URL.strip('/') + '/tasks/' + \
            str(dtable.uuid) + '/' + script_name + '/logs/' + str(log_id) + '/'
        params = {'order_by': order_by}
        try:
            response = requests.get(url, headers=headers, params=params, timeout=10)

            if response.status_code != 200:
                return api_error(response.status_code, response.text)

            task_log = response.json()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response(task_log)


class ScriptTaskFileView(APIView):
    throttle_classes = (UserRateThrottle,)

    def get(self, request, dtable_uuid, script_name):
        """
        faas-scheduler task get script_file_url and temp_api_token
        """
        # permission check
        request_token = request.META.get('HTTP_AUTHORIZATION', '')
        if request_token != 'Token ' + settings.SEATABLE_FAAS_AUTH_TOKEN:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found.')

        # script check
        extension = script_name.split('.')[-1].lower()
        if extension != 'py':
            return api_error(status.HTTP_400_BAD_REQUEST, 'File type invalid.')

        repo_id = dtable.workspace.repo_id
        script_path = os.path.join('/asset', str(dtable.uuid), 'scripts', script_name)
        asset_id = seafile_api.get_file_id_by_path(repo_id, script_path)
        if not asset_id:
            return api_error(status.HTTP_404_NOT_FOUND, 'Script not found.')

        token = seafile_api.get_fileserver_access_token(
            repo_id, asset_id, 'download', '', use_onetime=True)
        if not token:
            return api_error(status.HTTP_404_NOT_FOUND, 'Script not found.')

        # script_url
        script_url = gen_file_get_url(token, script_name)

        # temp_api_token
        temp_api_token = _get_temp_api_token(dtable_uuid, script_name)

        return Response({
            'script_url': script_url,
            'temp_api_token': temp_api_token,
        })


class ScriptsRunningLimitView(APIView):
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """
        faas-scheduler task get script_file_url and temp_api_token
        """
        # permission check
        request_token = request.META.get('HTTP_AUTHORIZATION', '')
        if request_token != 'Token ' + settings.SEATABLE_FAAS_AUTH_TOKEN:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        username = request.GET.get('username')
        org_id = request.GET.get('org_id')
        if not (username or org_id):
            return api_error(status.HTTP_400_BAD_REQUEST, 'username or org_id invalid.')

        scripts_running_limit = -1
        if username:
            scripts_running_limit, error = UserQuota.objects.get_scripts_running_limit(username)
            if error:
                return api_error(status.HTTP_404_NOT_FOUND, error)
        else:
            scripts_running_limit = OrgQuota.objects.get_scripts_running_limit(org_id)

        return Response({'scripts_running_limit': scripts_running_limit})


class ScriptPermissionsView(APIView):
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        # permission check
        request_token = request.META.get('HTTP_AUTHORIZATION', '')
        if request_token != 'Token ' + settings.SEATABLE_FAAS_AUTH_TOKEN:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        # arguments check
        users = request.data.get('users', [])
        org_ids_raw = request.data.get('org_ids', [])
        if not isinstance(users, list):
            return api_error(status.HTTP_400_BAD_REQUEST, 'users invalid.')
        if not isinstance(org_ids_raw, list):
            return api_error(status.HTTP_400_BAD_REQUEST, 'org_ids invalid.')
        try:
            org_ids = [int(org_id) for org_id in org_ids_raw]
        except:
            return api_error(status.HTTP_400_BAD_REQUEST, 'org_ids invalid.')

        # get user/org roles
        user_role_dict = get_users_role(users)
        org_role_dict = {}
        for org_id, role in OrgSettings.objects.filter(org_id__in=org_ids).values_list('org_id', 'role'):
            org_role_dict[org_id] = role

        # init user/org permission result
        user_permission_dict = {user: {
            'can_run_python_script': False
        } for user in users}
        org_permission_dict = {org_id: {
            'can_run_python_script': False
        } for org_id in org_ids}

        # update user/org permission result
        for username, role in user_role_dict.items():
            user_permission_dict[username] = {
                'can_run_python_script': get_enabled_role_permissions_by_role(role).get('can_run_python_script', False)
            }
        for org_id, role in org_role_dict.items():
            org_permission_dict[org_id] = {
                'can_run_python_script': get_enabled_role_permissions_by_role(role).get('can_run_python_script', False)
            }

        return Response({
            'user_script_permissions': user_permission_dict,
            'org_script_permissions': org_permission_dict
        })
