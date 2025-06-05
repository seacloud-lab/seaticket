# -*- coding: utf-8 -*-
import logging

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework import status

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.utils.timeutils import datetime_to_isoformat_timestr
from seahub.dtable.models import DTableCommonDatasetSync, DTableCommonDataset
from seahub.base.templatetags.seahub_tags import email2nickname

logger = logging.getLogger(__name__)


class AdminCommonDatasetsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """
        Get all common datasets
        only admin can perform this action
        """

        try:
            per_page = int(request.GET.get('per_page', ''))
            page = int(request.GET.get('page', ''))
        except ValueError:
            per_page = 25
            page = 1

        start = (page - 1) * per_page

        sql = '''
                SELECT dcd.id,dcd.dataset_name,dcd.creator,dcd.created_at, d.name as src_dtable_name
                FROM dtable_common_dataset dcd
                INNER JOIN dtables d ON dcd.dtable_uuid=d.uuid
                WHERE d.deleted=0 
                ORDER BY dcd.created_at DESC
                LIMIT %s OFFSET %s
                '''
        try:
            dataset_query_set = DTableCommonDataset.objects.raw(sql, (per_page, start))
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        dataset_list = []
        for dataset in dataset_query_set:
            info = {
                'dataset_name': dataset.dataset_name,
                'src_dtable_name': dataset.src_dtable_name,
                'creator': email2nickname(dataset.creator),
                'created_at': datetime_to_isoformat_timestr(dataset.created_at),
            }
            dataset_list.append(info)

        return Response({'dataset_list': dataset_list})


class AdminCommonDatasetPeriodicalSyncsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """
        Get all periodical syncs
        only admin can perform this action
        """

        try:
            per_page = int(request.GET.get('per_page', ''))
            page = int(request.GET.get('page', ''))
        except ValueError:
            per_page = 25
            page = 1

        start = (page - 1) * per_page
        sql = '''
            SELECT dcs.id,dcd.dataset_name,dcs.creator,dcs.created_at,d1.name as dst_dtable_name, d2.name as src_dtable_name
            FROM dtable_common_dataset_sync dcs 
            INNER JOIN dtable_common_dataset dcd ON dcs.dataset_id=dcd.id
            INNER JOIN dtables d1 ON dcs.dst_dtable_uuid=d1.uuid
            INNER JOIN dtables d2 ON dcd.dtable_uuid=d2.uuid
            WHERE d1.deleted=0 AND d2.deleted=0 AND dcs.is_sync_periodically=1
            ORDER BY dcs.created_at DESC
            LIMIT %s OFFSET %s
            '''
        try:
            dataset_sync_query_set = DTableCommonDatasetSync.objects.raw(sql, (per_page, start))
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        dataset_sync_list = []
        for dataset in dataset_sync_query_set:
            info = {
                'dataset_name': dataset.dataset_name,
                'src_dtable_name': dataset.src_dtable_name,
                'dst_dtable_name': dataset.dst_dtable_name,
                'creator': email2nickname(dataset.creator),
                'created_at': datetime_to_isoformat_timestr(dataset.created_at),
            }
            dataset_sync_list.append(info)

        return Response({'periodical_sync_list': dataset_sync_list})


class AdminCommonDatasetInvalidSyncsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAdminUser,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """
        Get all invalid common dataset syncs
        only admin can perform this action
        """

        try:
            per_page = int(request.GET.get('per_page', ''))
            page = int(request.GET.get('page', ''))
        except ValueError:
            per_page = 25
            page = 1

        start = (page - 1) * per_page
        sql = '''
            SELECT dcs.id,dcd.dataset_name,dcs.creator,dcs.created_at,d1.name as dst_dtable_name, d2.name as src_dtable_name
            FROM dtable_common_dataset_sync dcs 
            INNER JOIN dtable_common_dataset dcd ON dcs.dataset_id=dcd.id
            INNER JOIN dtables d1 ON dcs.dst_dtable_uuid=d1.uuid
            INNER JOIN dtables d2 ON dcd.dtable_uuid=d2.uuid
            WHERE dcs.is_valid=0
            ORDER BY dcs.created_at DESC
            LIMIT %s OFFSET %s
            '''
        try:
            dataset_sync_query_set = DTableCommonDatasetSync.objects.raw(sql, (per_page, start))
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        dataset_sync_list = []
        for dataset in dataset_sync_query_set:
            info = {
                'id': dataset.id,
                'dataset_name': dataset.dataset_name,
                'src_dtable_name': dataset.src_dtable_name,
                'dst_dtable_name': dataset.dst_dtable_name,
                'creator': email2nickname(dataset.creator),
                'created_at': datetime_to_isoformat_timestr(dataset.created_at),
            }
            dataset_sync_list.append(info)

        return Response({'invalid_sync_list': dataset_sync_list})

    def delete(self, request):
        """ delete invalid syncs
        """

        try:
            DTableCommonDatasetSync.objects.filter(is_valid=False).delete()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})


class AdminCommonDatasetSyncView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    throttle_classes = (UserRateThrottle,)
    permission_classes = (IsAdminUser,)

    def delete(self, request, sid):
        """
            Delete a common dataset sync
            only admin can perform this action
        """

        try:
            sid = int(sid)
        except ValueError:
            error_msg = 'sid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if sid <= 0:
            error_msg = 'sid invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dataset_sync = DTableCommonDatasetSync.objects.filter(id=sid, is_valid=False).first()
        if not dataset_sync:
            error_msg = 'dataset sync %s not found.' % sid
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            dataset_sync.delete()
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        return Response({'success': True})
