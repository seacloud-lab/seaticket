# -*- coding: utf-8 -*-
import os
import json
import logging
import re

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from django.utils.translation import gettext as _

from seaserv import seafile_api

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.permissions import IsProVersion
from seahub.api2.utils import api_error, to_python_boolean
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.ccnet_db.ccnet.groups import get_groups_info
from seahub.ccnet_db.ccnet.organizations import get_orgs_base_info
from seahub.dtable.models import DTables, Workspaces
from seahub.dtable.utils import restore_trash_dtable_names
from seahub.utils import get_virus_files, get_virus_file_by_vid, delete_virus_file, operate_virus_file
from seahub.utils.timeutils import datetime_to_isoformat_timestr

logger = logging.getLogger(__name__)


def fill_virus_file_infos(virus_file_list):
    repo_id_list = []
    dtable_uuid_list = []

    for virus_file in virus_file_list:
        if virus_file['repo_id'] not in repo_id_list:
            repo_id_list.append(virus_file['repo_id'])
        if re.match(r'/asset/[\w-]{36}', virus_file['file_path']):
            dtable_uuid = virus_file['file_path'][len('/asset/'): len('/asset/') + 36]
            if dtable_uuid not in dtable_uuid_list:
                dtable_uuid_list.append(dtable_uuid)

    repo_infos_dict = {}    # {repo_id: {group_id, username, org_id}}
    dtable_infos_dict = {}  # {dtable_uuid: {dtable_name}}

    workspaces = Workspaces.objects.filter(repo_id__in=repo_id_list)
    for workspace in workspaces:
        if '@seafile_group' in workspace.owner:
            repo_infos_dict[workspace.repo_id] = {'group_id': int(workspace.owner.split('@')[0])}
        else:
            repo_infos_dict[workspace.repo_id] = {'username': workspace.owner}
        repo_infos_dict[workspace.repo_id]['org_id'] = workspace.org_id

    dtables = DTables.objects.filter(uuid__in=dtable_uuid_list)
    for dtable in dtables:
        dtable_infos_dict[str(dtable.uuid)] = {'dtable_deleted': dtable.deleted}
        if dtable.deleted:
            dtable_infos_dict[str(dtable.uuid)]['dtable_name'] = restore_trash_dtable_names(dtable)[0]
        else:
            dtable_infos_dict[str(dtable.uuid)]['dtable_name'] = dtable.name

    org_infos_dict = get_orgs_base_info([value['org_id'] for value in repo_infos_dict.values() if value['org_id'] != -1])
    group_infos_dict = get_groups_info([value['group_id'] for value in repo_infos_dict.values() if 'group_id' in value])

    for virus_file in virus_file_list:
        repo_id = virus_file.get('repo_id')

        workspace_info = repo_infos_dict[repo_id]
        if not workspace_info:
            continue

        group_id = workspace_info.get('group_id')
        username = workspace_info.get('username')

        if group_id:
            virus_file['group_id'] = group_id
            group_info = group_infos_dict.get(group_id)
            virus_file['group_name'] = group_info['group_name'] if group_info else ''
        elif username:
            virus_file['username'] = username
            virus_file['nickname'] = email2nickname(username)

        org_id = workspace_info.get('org_id')
        virus_file['org_id'] = org_id
        if org_id != -1:
            org_info = org_infos_dict.get(org_id)
            virus_file['org_name'] = org_info['org_name'] if org_info else ''

        if re.match(r'/asset/[\w-]{36}', virus_file['file_path']):
            dtable_uuid = virus_file['file_path'][len('/asset/'): len('/asset/') + 36]
            virus_file['dtable_uuid'] = dtable_uuid
            dtable_info = dtable_infos_dict.get(dtable_uuid)
            virus_file['dtable_name'] = dtable_info['dtable_name'] if dtable_info else ''

    return virus_file_list


class AdminVirusFilesView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser, IsProVersion)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """get virus files
        """

        if not request.user.admin_permissions.other_permission():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        try:
            page = int(request.GET.get('page', ''))
        except ValueError:
            page = 1

        try:
            per_page = int(request.GET.get('per_page', ''))
        except ValueError:
            per_page = 25

        try:
            has_handled = to_python_boolean(request.GET.get('has_handled', ''))
        except ValueError:
            has_handled = None

        start = (page - 1) * per_page
        count = per_page + 1

        try:
            virus_files = get_virus_files(has_handled=has_handled, start=start, limit=count)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        if len(virus_files) > per_page:
            virus_files = virus_files[:per_page]
            has_next_page = True
        else:
            has_next_page = False

        virus_file_list = list()
        for virus_file in virus_files:

            record = dict()
            record["repo_id"] = virus_file.repo_id
            record["file_path"] = virus_file.file_path
            record["has_deleted"] = virus_file.has_deleted
            record["has_ignored"] = virus_file.has_ignored
            record["virus_id"] = virus_file.vid
            record["created_at"] = datetime_to_isoformat_timestr(virus_file.created_at)
            record["updated_at"] = datetime_to_isoformat_timestr(virus_file.updated_at)
            virus_file_list.append(record)

        virus_file_list = fill_virus_file_infos(virus_file_list)

        return Response({"virus_file_list": virus_file_list, "has_next_page": has_next_page}, status=status.HTTP_200_OK)


class AdminVirusFileView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser, IsProVersion)
    throttle_classes = (UserRateThrottle,)

    def delete(self, request, virus_id):
        """delete virus file
        """

        if not request.user.admin_permissions.other_permission():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        virus_file = get_virus_file_by_vid(virus_id)
        if not virus_file:
            error_msg = 'Virus file %s not found.' % virus_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        parent_dir = os.path.dirname(virus_file.file_path)
        filename = os.path.basename(virus_file.file_path)
        try:
            seafile_api.del_file(virus_file.repo_id, parent_dir,
                                 json.dumps([filename]),
                                 request.user.username)
            delete_virus_file(virus_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({"success": True}, status=status.HTTP_200_OK)

    def put(self, request, virus_id):
        """ignore or un-ignore virus file
        """

        if not request.user.admin_permissions.other_permission():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        ignore = request.data.get('ignore')
        if ignore not in ('true', 'false'):
            error_msg = 'ignore invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        ignore = to_python_boolean(ignore)

        virus_file = get_virus_file_by_vid(virus_id)
        if not virus_file:
            error_msg = 'Virus file %s not found.' % virus_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            operate_virus_file(virus_id, ignore)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        virus_file = get_virus_file_by_vid(virus_id)

        res = dict()
        res["repo_id"] = virus_file.repo_id
        res["file_path"] = virus_file.file_path
        res["has_deleted"] = virus_file.has_deleted
        res["has_ignored"] = virus_file.has_ignored
        res["virus_id"] = virus_file.vid
        res["created_at"] = datetime_to_isoformat_timestr(virus_file.created_at)
        res["updated_at"] = datetime_to_isoformat_timestr(virus_file.updated_at)

        res = fill_virus_file_infos([res])[0]

        return Response({"virus_file": res}, status=status.HTTP_200_OK)


class AdminVirusFilesBatchView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser, IsProVersion)
    throttle_classes = (UserRateThrottle,)

    def post(self, request):
        """ Delete virus files, ignore or cancel ignore virus files, in batch.

        Permission checking:
        1. admin user.
        """

        if not request.user.admin_permissions.other_permission():
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied.')

        # argument check
        virus_ids = request.POST.getlist('virus_ids', None)
        if not virus_ids:
            error_msg = 'virus_ids invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        operation = request.POST.get('operation', None)
        if operation not in ('delete-virus', 'ignore-virus', 'cancel-ignore-virus'):
            error_msg = "operation can only be 'delete-virus', 'ignore-virus' or 'cancel-ignore-virus'."
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        result = dict(failed=[])
        result['success'] = []

        virus_files = []
        for virus_id in virus_ids:
            virus_file = get_virus_file_by_vid(int(virus_id))
            if virus_file:
                virus_files.append(virus_file)
            else:
                result['failed'].append({
                    'virus_id': virus_id,
                    'error_msg': _('Virus file is not found.')
                })
                continue

        if operation == 'delete-virus':
            for virus_file in virus_files:
                parent_dir = os.path.dirname(virus_file.file_path)
                filename = os.path.basename(virus_file.file_path)
                virus_id = int(virus_file.vid)
                try:
                    seafile_api.del_file(virus_file.repo_id, parent_dir,
                                         json.dumps([filename]),
                                         request.user.username)
                    delete_virus_file(virus_id)
                except Exception as e:
                    logger.error(e)
                    result['failed'].append({
                        'virus_id': virus_id,
                        'error_msg': _('Internal Server Error')
                    })
                    continue

                result['success'].append({'virus_id': virus_id})

        if operation == 'ignore-virus':
            for virus_file in virus_files:
                virus_id = int(virus_file.vid)
                try:
                    operate_virus_file(virus_id, True)
                except Exception as e:
                    logger.error(e)
                    result['failed'].append({
                        'virus_id': virus_id,
                        'error_msg': _('Internal Server Error')
                    })
                    continue

                result['success'].append({'virus_id': virus_id})

        if operation == 'cancel-ignore-virus':
            for virus_file in virus_files:
                virus_id = int(virus_file.vid)
                try:
                    operate_virus_file(virus_id, False)
                except Exception as e:
                    logger.error(e)
                    result['failed'].append({
                        'virus_id': virus_id,
                        'error_msg': _('Internal Server Error')
                    })
                    continue

                result['success'].append({'virus_id': virus_id})

        return Response(result)
