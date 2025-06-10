# -*- coding: utf-8 -*-
import logging

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.utils import is_org_context

logger = logging.getLogger(__name__)


FILE_TYPE = '.dtable'


class WorkspacesView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request):
        """get all workspaces
        """
        detail = request.GET.get('detail', 'true')
        if detail not in ('true', 'false'):
            error_msg = 'detail invalid'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        username = request.user.username
        org_id = -1
        if is_org_context(request):
            org_id = request.user.org.org_id

        # from seahub.organizations.models import OrgGroup
        # from seahub.group.models import Group
        # if org_id > 0:
        #     groups = ccnet_api.get_org_groups_by_user(org_id, username, return_ancestors=True)
        # else:
        #     groups = ccnet_api.get_groups(username, return_ancestors=True)
        #
        # group_id_list = [group.id for group in groups]
        # admin_group_ids = get_user_admin_group_ids(username)

        workspace_list = list()
        if detail == 'false':
            workspace_list = [
                {
                  "id": "",
                  "name": "starred",
                  "type": "starred",
                  "table_list": []
                },
                {
                  "id": "",
                  "name": "shared",
                  "type": "shared",
                  "shared_table_list": [
                  ],
                  "shared_view_list": [],
                  "share_folders": []
                },
                {
                  "id": 144,
                  "name": "personal",
                  "type": "personal",
                  "table_list": [
                    {
                      "id": 6811,
                      "workspace_id": 144,
                      "uuid": "e4774411-390f-4f0c-928b-89d8087b3ef1",
                      "name": "无标题表格",
                      "created_at": "2025-04-11T13:46:11+08:00",
                      "updated_at": "2025-05-20T13:01:29+08:00",
                      "color": None,
                      "text_color": None,
                      "icon": None,
                      "is_encrypted": False,
                      "in_storage": True,
                      "starred": False
                    }
                  ],
                  "folders": []
                },
              ]

            return Response({'workspace_list': workspace_list}, status=status.HTTP_200_OK)

        workspace_list = [
            {
                "id": "",
                "name": "starred",
                "type": "starred"
            },
            {
                "id": "",
                "name": "shared",
                "type": "shared"
            },
            {
                "id": 144,
                "name": "personal",
                "type": "personal"
            },
        ]
        return Response({'workspace_list': workspace_list}, status=status.HTTP_200_OK)
