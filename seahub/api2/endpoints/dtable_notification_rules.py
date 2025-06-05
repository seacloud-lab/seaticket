# -*- coding: utf-8 -*-
import logging
import json
from datetime import datetime, timedelta

from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, send_signal_to_dtable_server
from seahub.dtable.models import Workspaces, DTables
from seahub.dtable.utils import check_dtable_permission, check_dtable_admin_permission
from seahub.dtable.models import DTableNotificationRules
from seahub.constants import RUN_CONDITION_LIST, RUN_CONDITION_PER_DAY, RUN_CONDITION_PER_WEEK, \
    PERMISSION_READ_WRITE, PERMISSION_ADMIN

logger = logging.getLogger(__name__)

WRITE_PERMISSION_TUPLE = (PERMISSION_READ_WRITE, PERMISSION_ADMIN)


class DTableNotificationRulesView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, workspace_id, name):
        """get all rules filter by dtable_uuid

        permission:  dtable accesser
        """

        table_name = name
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, table_name)
        if not dtable:
            error_msg = 'Base %s not found.' % table_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        permission = check_dtable_permission(username, workspace, dtable)
        if not permission:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable_notification_rules_queryset = DTableNotificationRules.objects.filter(dtable_uuid=dtable.uuid.hex)
        dtable_notification_rule_list = [rule.to_dict() for rule in dtable_notification_rules_queryset]
        return Response({'dtable_notification_rule_list': dtable_notification_rule_list})

    def post(self, request, workspace_id, name):
        """
        create a dtable notification rule

        permission:  dtable accesser
        """

        table_name = name
        run_condition = request.data.get('run_condition', '')
        if not run_condition or run_condition not in RUN_CONDITION_LIST:
            error_msg = 'run_condition %s invalid.' % run_condition
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        trigger = request.data.get('trigger', '')
        if not trigger :
            error_msg = 'trigger invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        action = request.data.get('action', '')
        if not action :
            error_msg = 'action invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, table_name)
        if not dtable:
            error_msg = 'Base %s not found.' % table_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        permission = check_dtable_permission(username, workspace, dtable)
        if not permission:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            notification_rule = DTableNotificationRules.objects.create(
                dtable_uuid=dtable.uuid.hex,
                run_condition=run_condition,
                trigger=json.dumps(trigger),
                action=json.dumps(action),
                creator=username,
                ctime=datetime.utcnow(),
                last_trigger_time=None,
            )
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        try:
            send_signal_to_dtable_server('notification-rules-changed', dtable)
        except Exception as e:
            logger.error(e)

        return Response(notification_rule.to_dict())


class DTableNotificationRuleView(APIView):

    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def is_need_update_last_trigger(self, old_run_condition, new_run_condition, old_trigger, new_trigger):
        if new_run_condition not in ['per_day', 'per_week', 'per_month']:
            return False
        if old_run_condition != new_run_condition:
            return True
        try:
            if not isinstance(old_trigger, dict):
                old_trigger = json.loads(old_trigger)
            if not isinstance(new_trigger, dict):
                new_trigger = json.loads(new_trigger)
        except Exception as e:
            return True
        return old_trigger.get('notify_hour') != new_trigger.get('notify_hour')

    def put(self, request, workspace_id, name, notification_rule_id):
        """update a notification rule by id

        permission:  dtable admin
        """

        table_name = name

        run_condition = request.data.get('run_condition', '')
        if not run_condition or run_condition not in RUN_CONDITION_LIST:
            error_msg = 'run_condition %s invalid.' % run_condition
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        trigger = request.data.get('trigger', '')
        if not trigger :
            error_msg = 'trigger invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        action = request.data.get('action', '')
        if not action :
            error_msg = 'action invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, table_name)
        if not dtable:
            error_msg = 'Base %s not found.' % table_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        if check_dtable_permission(username, workspace, dtable) not in WRITE_PERMISSION_TUPLE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            notification_rule = DTableNotificationRules.objects.get(id=notification_rule_id, dtable_uuid=dtable.uuid.hex)
            if self.is_need_update_last_trigger(notification_rule.run_condition, run_condition, notification_rule.trigger, trigger):
                notification_rule.last_trigger_time = None
            notification_rule.run_condition = run_condition
            notification_rule.trigger = json.dumps(trigger)
            notification_rule.action = json.dumps(action)
            if not notification_rule.is_valid:
                notification_rule.is_valid = True
            notification_rule.save()

        except DTableNotificationRules.DoesNotExist:
            error_msg = 'notification_rule %s not found.' % notification_rule_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        try:
            send_signal_to_dtable_server('notification-rules-changed', dtable)
        except Exception as e:
            logger.error(e)

        return Response(notification_rule.to_dict())


    def delete(self, request, workspace_id, name, notification_rule_id):
        """delete a notification rule by id

        permission:  dtable admin
        """

        table_name = name
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, table_name)
        if not dtable:
            error_msg = 'Base %s not found.' % table_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        username = request.user.username
        if check_dtable_permission(username, workspace, dtable) not in WRITE_PERMISSION_TUPLE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            notification_rule = DTableNotificationRules.objects.get(id=notification_rule_id, dtable_uuid=dtable.uuid.hex)
            notification_rule.delete()
        except DTableNotificationRules.DoesNotExist:
            return api_error(status.HTTP_404_NOT_FOUND, 'Not found.')
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        try:
            send_signal_to_dtable_server('notification-rules-changed', dtable)
        except Exception as e:
            logger.error(e)

        return Response({'success': True})
