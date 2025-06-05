# -*- coding: utf-8 -*-
import logging

from seaserv import ccnet_api

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response
from django.utils.translation import gettext as _

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.dtable.models import Workspaces, DTables, DTableCommonDataset, DTableCommonDatasetGroupAccess
from seahub.group.utils import get_user_groups, group_id_to_name
from seahub.utils import is_org_context


logger = logging.getLogger(__name__)


class DTableCommonDatasetAccessGroupsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, dataset_id):
        """
            list accessible groups
        """
        try:
            dataset = DTableCommonDataset.objects.get(pk=dataset_id)
        except DTableCommonDataset.DoesNotExist:
            error_msg = 'dataset %s not found.' % dataset_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # resource check
        dtable = DTables.objects.filter(uuid=dataset.dtable_uuid).first()
        if not dtable:
            error_msg = 'Base not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % dtable.workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not dataset.can_manage_by_user(request.user.username):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        username = request.user.username
        groups = get_user_groups(username)

        id_to_group = {group.id: True for group in groups}

        accessible_group_id_list = DTableCommonDatasetGroupAccess.objects.get_related_groups_id(dataset=dataset)
        accessible_group_list = [{'group_id': group_id, 'group_name': group_id_to_name(group_id),
                                  'is_deleted': not id_to_group.get(group_id, False)}
                                 for group_id in accessible_group_id_list]

        return Response({'accessible_group_list': accessible_group_list})

    def post(self, request, dataset_id):
        """
            add accessible groups
        """

        try:
            dataset = DTableCommonDataset.objects.get(pk=dataset_id)
        except DTableCommonDataset.DoesNotExist:
            error_msg = 'dataset %s not found.' % dataset_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        group_id_list = request.data.getlist('group_id', '')
        if not group_id_list:
            error_msg = 'group_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            group_id_list = [int(group_id) for group_id in group_id_list]
        except Exception as e:
            logging.error(e)
            error_msg = 'group_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        success_res_list = []
        failed_res_list = []

        for group_id in group_id_list:

            group = ccnet_api.get_group(group_id)
            if not group:
                error_msg = 'group %s not found.' % group_id
                failed_res_list.append({'failed_group_id': group_id, 'error_msg': error_msg})
                continue

            # resource check
            dtable = DTables.objects.filter(uuid=dataset.dtable_uuid).first()
            if not dtable:
                error_msg = 'Base not found.'
                failed_res_list.append({'failed_group_id': group_id, 'error_msg': error_msg})
                continue

            workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace_id)
            if not workspace:
                error_msg = 'Workspace %s not found.' % dtable.workspace_id
                failed_res_list.append({'failed_group_id': group_id, 'error_msg': error_msg})
                continue

            # permission check
            if not dataset.can_manage_by_user(request.user.username):
                error_msg = 'Permission denied.'
                failed_res_list.append({'failed_group_id': group_id, 'error_msg': error_msg})
                continue

            try:
                DTableCommonDatasetGroupAccess.objects.get(dataset=dataset, group_id=group_id)
                error_msg = _('group %s accessible to dataset %s already exists.') % (group_id, dataset.dataset_name)
                failed_res_list.append({'failed_group_id': group_id, 'error_msg': error_msg})
                continue
            except DTableCommonDatasetGroupAccess.DoesNotExist:
                pass

            DTableCommonDatasetGroupAccess.objects.create(
                dataset=dataset,
                group_id=group_id,
            )
            success_res_list.append({
                'group_id': group_id,
                'group_name': group_id_to_name(group_id)
            })

        return Response({'success_list': success_res_list, 'failed_list': failed_res_list})


class DTableCommonDatasetAccessGroupView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def delete(self, request, dataset_id, group_id):
        """
            delete accessible group
        """

        if not group_id:
            error_msg = 'group_id invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            dataset = DTableCommonDataset.objects.get(pk=dataset_id)
        except DTableCommonDataset.DoesNotExist:
            error_msg = 'dataset %s not found.' % dataset_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.filter(uuid=dataset.dtable_uuid).first()
        if not dtable:
            error_msg = 'Base not found.'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        # permission check
        if not dataset.can_manage_by_user(request.user.username):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(dtable.workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % dtable.workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        try:
            dataset_access = DTableCommonDatasetGroupAccess.objects.get(dataset=dataset, group_id=group_id)
        except DTableCommonDatasetGroupAccess.DoesNotExist:
            error_msg = _('Dataset %s is not accessible to group %s') % (dataset.dataset_name, group_id)
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dataset_access.delete()

        return Response({'success': True})
