# -*- coding: utf-8 -*-
import os
import time
import logging

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from seaserv import seafile_api

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.models import DTables, PageDesignSnapshot
from seahub.dtable.utils import check_dtable_permission
from seahub.utils.timeutils import timestamp_to_isoformat_timestr
from seahub.utils import gen_file_get_url
from seahub.constants import PERMISSION_READ_WRITE
from seahub.settings import FILESERVER_TOKEN_ONCE_ONLY

logger = logging.getLogger(__name__)


class PageDesignSnapshotsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, dtable_uuid, page_id):
        """list page design snapshots
        """
        # argument check
        try:
            page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '25'))
        except ValueError:
            page = 1
            per_page = 25

        start = per_page * (page - 1)
        end = start + per_page

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if not check_dtable_permission(username, dtable.workspace, dtable):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        snapshot_list = list()
        try:
            query_set = PageDesignSnapshot.objects.list_by_page_id(page_id)[start: end]
            for snapshot in query_set:
                data = {
                    'page_id': snapshot.page_id,
                    'commit_id': snapshot.commit_id,
                    'ctime': timestamp_to_isoformat_timestr(snapshot.ctime),
                }
                snapshot_list.append(data)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'snapshot_list': snapshot_list})

    def post(self, request, dtable_uuid, page_id):
        """create a page design snapshot
        """
        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = dtable.workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if check_dtable_permission(username, dtable.workspace, dtable) != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # get commit
        try:
            current_commit = seafile_api.get_commit_list(repo_id, 0, 1)[0]
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        # main
        ctime = int(time.time())
        try:
            snapshot_obj = PageDesignSnapshot.objects.add_snapshot(page_id, dtable_uuid, current_commit.id, ctime)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'page_design_snapshot': snapshot_obj.to_dict()})


class PageDesignSnapshotView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, dtable_uuid, page_id, commit_id):
        page_file_name = page_id + '.json'

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = dtable.workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        username = request.user.username
        if check_dtable_permission(username, dtable.workspace, dtable) != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # main
        try:
            snapshot = PageDesignSnapshot.objects.get_by_commit_id(page_id, commit_id)
            if not snapshot:
                return api_error(status.HTTP_404_NOT_FOUND, 'snapshot not found.')

            page_snapshot_path = os.path.join('/asset', dtable_uuid, 'page-design', page_id, page_file_name)
            obj_id = seafile_api.get_file_id_by_commit_and_path(repo_id, commit_id, page_snapshot_path)
            if not obj_id:
                return api_error(status.HTTP_404_NOT_FOUND, 'snapshot not found.')
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        # download url
        token = seafile_api.get_fileserver_access_token(
            repo_id, obj_id, 'download', username, FILESERVER_TOKEN_ONCE_ONLY)
        if not token:
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        redirect_url = gen_file_get_url(token, page_file_name)
        return Response(redirect_url)


class PageDesignSnapshotRestoreView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, dtable_uuid, page_id, commit_id):
        page_file_name = page_id + '.json'

        # resource check
        dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
        if not dtable:
            error_msg = 'dtable %s not found.' % dtable_uuid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        repo_id = dtable.workspace.repo_id
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            error_msg = 'Library %s not found.' % repo_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        page_snapshot_path = os.path.join('/asset', dtable_uuid, 'page-design', page_id, page_file_name)
        if not seafile_api.get_file_id_by_path(repo_id, page_snapshot_path):
            error_msg = 'file %s not found.' % page_file_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            snapshot = PageDesignSnapshot.objects.get_by_commit_id(page_id, commit_id)
            if not snapshot:
                return api_error(status.HTTP_404_NOT_FOUND, 'snapshot not found.')
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        # permission check
        username = request.user.username
        if check_dtable_permission(username, dtable.workspace, dtable) != PERMISSION_READ_WRITE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        # main
        try:
            seafile_api.revert_file(repo_id, commit_id, page_snapshot_path, username)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})
