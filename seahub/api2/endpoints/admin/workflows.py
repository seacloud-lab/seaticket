# Copyright (c) 2012-2016 Seafile Ltd.
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
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.dtable_apps.workflow.models import DTableWorkflows
from seahub.dtable.models import DTables
from seahub.utils import uuid_str_to_32_chars

logger = logging.getLogger(__name__)


class AdminWorkflows(APIView):
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

        try:
            workflow_count = DTableWorkflows.objects.count()
            workflows = DTableWorkflows.objects.all().order_by('-created_at')[start: end]
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        dtable_uuids = set([uuid_str_to_32_chars(w.dtable_uuid) for w in workflows])
        dtables = DTables.objects.filter(uuid__in=dtable_uuids)
        dtables_dict = {d.uuid.hex: d.name for d in dtables}

        workflow_list = []
        for workflow in workflows:
            workflow_info = workflow.to_dict()
            workflow_info['creator'] = email2nickname(workflow.creator)
            workflow_info['dtable_name'] = dtables_dict.get(workflow.dtable_uuid)
            workflow_info['workflow_config'] = json.loads(workflow.workflow_config)
            workflow_list.append(workflow_info)

        return Response({'count': workflow_count, 'workflow_list': workflow_list})
