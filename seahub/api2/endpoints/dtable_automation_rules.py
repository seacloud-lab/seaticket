import json
import logging
from datetime import datetime

from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, send_signal_to_dtable_server

from seahub.constants import PERMISSION_READ_WRITE, PERMISSION_ADMIN, \
    RUN_CONDITION_PER_UPDATE, TRIGGER_CONDITION_FILTERS_SATISFY, RUN_CONDITION_PER_DAY, RUN_CONDITION_PER_WEEK, RUN_CONDITION_PER_MONTH, TRIGGER_CONDITION_PERIODICALLY, \
    TRIGGER_CONDITION_ROWS_ADDED, TRIGGER_CONDITION_PERIODICALLY_BY_CONDITION
from seahub.dtable.models import DTableAutomationRules, Workspaces, DTables, DTableAutomationRulesTaskLog
from seahub.dtable.utils import can_use_automation_rules_by_dtable, check_dtable_permission, add_run_auto_rule_task

logger = logging.getLogger(__name__)

WRITE_PERMISSION_TUPLE = (PERMISSION_READ_WRITE, PERMISSION_ADMIN)
AUTOMATION_TYPE_LIST = ['notify', 'update_record', 'add_record', 'lock_record', 'send_wechat', 'send_dingtalk',
                        'send_email', 'run_python_script', 'link_records', 'add_record_to_other_table',
                        'trigger_workflow', 'calculate_accumulated_value', 'calculate_delta',
                        'calculate_rank', 'calculate_percentage', 'lookup_and_copy', 'extract_user_name', 'app_notify',
                        'convert_page_to_pdf', 'convert_document_to_pdf_and_send']

def validate_request(run_condition, trigger, actions, is_pause=None):
    """
    return: api_error or None
    """
    # pause must be bool
    if is_pause is not None and is_pause not in (True, False):
        return api_error(status.HTTP_400_BAD_REQUEST, 'is_pause invalid.')

    # run_condition trigger actions must be some one type
    if run_condition is not None and not isinstance(run_condition, str):
        return api_error(status.HTTP_400_BAD_REQUEST, 'run_condition invalid.')
    if trigger is not None and not isinstance(trigger, dict):
        return api_error(status.HTTP_400_BAD_REQUEST, 'trigger invalid.')
    if actions is not None and not isinstance(actions, list):
        return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid.')

    # run_condition trigger and actions must all None or all not None
    if run_condition is None and trigger is None and actions is None:
        return None

    elif run_condition is not None and trigger is not None and actions is not None:
        if run_condition not in (RUN_CONDITION_PER_UPDATE, RUN_CONDITION_PER_DAY, RUN_CONDITION_PER_WEEK, RUN_CONDITION_PER_MONTH):
            return api_error(status.HTTP_400_BAD_REQUEST, 'run_condition invalid.')
        if run_condition in (RUN_CONDITION_PER_DAY, RUN_CONDITION_PER_WEEK, RUN_CONDITION_PER_MONTH):
            if trigger.get('condition') not in (TRIGGER_CONDITION_PERIODICALLY, TRIGGER_CONDITION_PERIODICALLY_BY_CONDITION):
                return api_error(status.HTTP_400_BAD_REQUEST, 'trigger invalid.')

            if run_condition == RUN_CONDITION_PER_DAY:
                trigger_hour = trigger.get('notify_hour')
                if not isinstance(trigger_hour, int) and not trigger_hour:
                    return api_error(status.HTTP_400_BAD_REQUEST, 'trigger invalid.')

            if run_condition == RUN_CONDITION_PER_WEEK:
                trigger_week_hour = trigger.get('notify_week_hour')
                trigger_week_day = trigger.get('notify_week_day')
                if not isinstance(trigger_week_hour, int) and not (trigger_week_hour and trigger_week_day):
                    return api_error(status.HTTP_400_BAD_REQUEST, 'trigger invalid.')

            if run_condition == RUN_CONDITION_PER_MONTH:
                trigger_month_hour = trigger.get('notify_month_hour')
                trigger_month_day = trigger.get('notify_month_day')
                if not isinstance(trigger_month_hour, int) and not (trigger_month_hour and trigger_month_day):
                    return api_error(status.HTTP_400_BAD_REQUEST, 'trigger invalid.')

        if not trigger.get('table_id') or not trigger.get('view_id') or not trigger.get('rule_name'):
            return api_error(status.HTTP_400_BAD_REQUEST, 'trigger invalid.')

        if run_condition == RUN_CONDITION_PER_UPDATE:
            if trigger.get('condition') not in (TRIGGER_CONDITION_FILTERS_SATISFY, TRIGGER_CONDITION_PERIODICALLY, TRIGGER_CONDITION_ROWS_ADDED):
                return api_error(status.HTTP_400_BAD_REQUEST, 'trigger invalid.')

        if not isinstance(actions, list):
            return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid.')

        action_ids = set()

        for action in actions:
            if not isinstance(action, dict) or not action.get('_id'):
                return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid.')

            if action['_id'] in action_ids:
                return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid.')
            else:
                action_ids.add(action['_id'])

            if action.get('type') not in AUTOMATION_TYPE_LIST:
                return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid.')

            if action.get('type') == 'notify':
                users, default_msg, users_column_key = action.get('users'), action.get('default_msg'), action.get('users_column_key')

                if (not users and not users_column_key) or not isinstance(users, list):
                    return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid.')

                if not default_msg and not isinstance(default_msg, str):
                    return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid.')
            elif action.get('type') == 'update_record':
                updates = action.get('updates')

                if not updates or not isinstance(updates, dict):
                    return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid.')

            elif action.get('type') == 'add_record':
                row = action.get('row')
                if not row or not isinstance(row, dict):
                    return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid.')

            elif action.get('type') == 'send_email':
                try:
                    account_id = int(action.get('account_id'))
                except ValueError:
                    return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid.')

                subject = action.get('subject')
                send_to = action.get('send_to')
                msg = action.get('default_msg')
                is_plain_text = action.get('is_plain_text', True)
                html_message = action.get('html_message')
                rich_message = action.get('rich_message')
                if is_plain_text:
                    if not msg:
                        return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid.')
                else:
                    if not html_message or not rich_message:
                        return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid.')
                if not (subject and send_to):
                    return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid.')

            elif action.get('type') == 'send_wechat':
                try:
                    account_id = int(action.get('account_id'))
                except ValueError:
                    return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid.')

                msg = action.get('default_msg')
                if not msg:
                    return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid.')

            elif action.get('type') == 'send_dingtalk':
                try:
                    account_id = int(action.get('account_id'))
                except ValueError:
                    return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid.')

                msg = action.get('default_msg')
                if action.get('msg_type') == 'markdown':
                    title = action.get('default_title')
                    if not title:
                        return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid.')
                if not msg:
                    return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid.')

            elif action.get('type') == 'run_python_script':
                script_name = action.get('script_name')
                if not script_name:
                    return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid.')

            elif action.get('type') == 'add_record_to_other_table':
                row = action.get('row')
                dst_table_id = action.get('dst_table_id')
                if not row or not isinstance(row, dict) or not dst_table_id:
                    return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid.')

            elif action.get('type') == 'trigger_workflow':
                row = action.get('row')
                token = action.get('token')
                if row is not None and not isinstance(row, dict):
                    return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid')
                if not token:
                    return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid')

            elif action.get('type') in ['calculate_accumulated_value', 'calculate_delta', 'calculate_rank', 'calculate_percentage']:
                calculate_column = action.get('calculate_column')
                result_column = action.get('result_column')
                if not calculate_column or not result_column:
                    return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid.')

            elif action.get('type') == 'lookup_and_copy':
                table_condition = action.get('table_condition')
                equal_column_conditions = action.get('equal_column_conditions')
                fill_column_conditions = action.get('fill_column_conditions')
                if not table_condition or not equal_column_conditions or not fill_column_conditions or \
                        not isinstance(table_condition, dict) or not isinstance(equal_column_conditions, list) or \
                        not isinstance(fill_column_conditions, list):
                    return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid.')

            elif action.get('type') == 'extract_user_name':
                extract_column = action.get('extract_column_key')
                result_column = action.get('result_column_key')
                if not extract_column or not result_column:
                    return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid.')

            elif action.get('type') == 'convert_page_to_pdf':
                page_id = action.get('page_id')
                file_name = action.get('file_name')
                target_column_key = action.get('target_column_key')
                if not page_id or not file_name or not target_column_key:
                    return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid.')

            elif action.get('type') == 'convert_document_to_pdf_and_send':
                plugin_type = action.get('plugin_type')
                doc_uuid = action.get('doc_uuid')
                file_name = action.get('file_name')
                # save to custom
                is_save_to_custom = action.get('is_save_to_custom')
                save_path = action.get('save_path', '/')
                # send wechat robot
                is_send_wechat_robot = action.get('is_send_wecaht_robot')
                wechat_robot_account_id = action.get('wechat_robot_account_id')
                # send email
                is_send_email = action.get('is_send_email')
                email_account_id = action.get('email_account_id')
                email_send_to = action.get('email_send_to')

                if not plugin_type or not doc_uuid:
                    return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid')
                if is_save_to_custom and not save_path:
                    return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid')
                if is_send_wechat_robot and not wechat_robot_account_id:
                    return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid')
                if is_send_email and (not email_account_id or not email_send_to):
                    return api_error(status.HTTP_400_BAD_REQUEST, 'actions invalid')
    else:
        return api_error(status.HTTP_400_BAD_REQUEST, 'run_condition or trigger or actions invalid.')

    return None


def update_actions(actions, workspace):
    if not actions:
        return None
    for action in actions:
        if action.get('type') == 'run_python_script':
            action['workspace_id'] = workspace.id
            action['owner'] = workspace.owner
            action['org_id'] = workspace.org_id
            action['repo_id'] = workspace.repo_id
        elif action.get('type') == 'send_email':
            action['repo_id'] = workspace.repo_id
        elif action.get('type') == 'convert_page_to_pdf':
            action['repo_id'] = workspace.repo_id
            action['workspace_id'] = workspace.id
        elif action.get('type') == 'convert_document_to_pdf_and_send':
            action['repo_id'] = workspace.repo_id
            action['workspace_id'] = workspace.id


class DTableAutomationRulesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def get(self, request, workspace_id, name):
        table_name = name
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, table_name)
        if not dtable:
            error_msg = 'DTable %s not found.' % table_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not can_use_automation_rules_by_dtable(dtable):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        username = request.user.username
        permission = check_dtable_permission(username, workspace, dtable)
        if not permission:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        dtable_automation_rules_queryset = DTableAutomationRules.objects.filter(dtable_uuid=dtable.uuid.hex)
        dtable_automation_rule_list = [rule.to_dict() for rule in dtable_automation_rules_queryset]
        return Response({'dtable_automation_rule_list': dtable_automation_rule_list})

    def post(self, request, workspace_id, name):
        table_name = name

        run_condition = request.data.get('run_condition')
        trigger = request.data.get('trigger')
        actions = request.data.get('actions')
        err = validate_request(run_condition, trigger, actions)
        if err:
            return err

        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, table_name)
        if not dtable:
            error_msg = 'Base %s not found.' % table_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not can_use_automation_rules_by_dtable(dtable):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        username = request.user.username
        org_id = request.user.org and request.user.org.org_id or -1
        if check_dtable_permission(username, workspace, dtable) not in WRITE_PERMISSION_TUPLE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        update_actions(actions, workspace)

        try:
            automation_rule = DTableAutomationRules.objects.create(
                dtable_uuid=dtable.uuid.hex,
                run_condition=run_condition,
                trigger=json.dumps(trigger),
                actions=json.dumps(actions),
                creator=username,
                ctime=datetime.utcnow(),
                org_id=org_id,
                last_trigger_time=None,
            )
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        try:
            send_signal_to_dtable_server('automation-rules-changed', dtable)
        except Exception as e:
            logger.error(e)

        return Response(automation_rule.to_dict())


class DTableAutomationRuleView(APIView):
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
        except Exception:
            return True
        if new_run_condition == 'per_day':
            return old_trigger.get('notify_hour') != new_trigger.get('notify_hour')
        if new_run_condition == 'per_week':
            return (
                old_trigger.get('notify_week_day') != new_trigger.get('notify_week_day') or
                old_trigger.get('notify_week_hour') != new_trigger.get('notify_week_hour')
            )
        if new_run_condition == 'per_month':
            return (
                old_trigger.get('notify_month_day') != new_trigger.get('notify_month_day') or
                old_trigger.get('notify_month_hour') != new_trigger.get('notify_month_hour')
            )
        return False

    def put(self, request, workspace_id, name, automation_rule_id):
        table_name = name
        run_condition = request.data.get('run_condition')
        trigger = request.data.get('trigger')
        actions = request.data.get('actions')
        is_pause = request.data.get('is_pause')

        err = validate_request(run_condition, trigger, actions, is_pause)
        if err:
            return err

        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, table_name)
        if not dtable:
            error_msg = 'Base %s not found.' % table_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not can_use_automation_rules_by_dtable(dtable):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        username = request.user.username
        if check_dtable_permission(username, workspace, dtable) not in WRITE_PERMISSION_TUPLE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        update_actions(actions, workspace)

        try:
            automation_rule = DTableAutomationRules.objects.get(id=automation_rule_id, dtable_uuid=dtable.uuid.hex)
            if self.is_need_update_last_trigger(
                automation_rule.run_condition,
                run_condition or automation_rule.run_condition,
                automation_rule.trigger,
                trigger or automation_rule.trigger
            ):
                automation_rule.last_trigger_time = None
            if run_condition is not None:
                automation_rule.run_condition = run_condition
            if trigger is not None:
                automation_rule.trigger = json.dumps(trigger)
            if actions is not None:
                automation_rule.actions = json.dumps(actions)
            if not automation_rule.is_valid:
                automation_rule.is_valid = True
            if is_pause is not None:
                automation_rule.is_pause = is_pause
            automation_rule.save()

        except DTableAutomationRules.DoesNotExist:
            error_msg = 'automation_rule %s not found.' % automation_rule_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        try:
            send_signal_to_dtable_server('automation-rules-changed', dtable)
        except Exception as e:
            logger.error(e)

        return Response(automation_rule.to_dict())

    def delete(self, request, workspace_id, name, automation_rule_id):
        table_name = name
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, table_name)
        if not dtable:
            error_msg = 'DTable %s not found.' % table_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not can_use_automation_rules_by_dtable(dtable):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        username = request.user.username
        if check_dtable_permission(username, workspace, dtable) not in WRITE_PERMISSION_TUPLE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            automation_rule = DTableAutomationRules.objects.get(id=automation_rule_id, dtable_uuid=dtable.uuid.hex)
            automation_rule.delete()
        except DTableAutomationRules.DoesNotExist:
            return api_error(status.HTTP_404_NOT_FOUND, 'Not found.')
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        try:
            send_signal_to_dtable_server('automation-rules-changed', dtable)
        except Exception as e:
            logger.error(e)

        return Response({'success': True})


class DTableAutomationRuleRunTestView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def post(self, request, workspace_id, name, automation_rule_id):
        table_name = name

        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, table_name)
        if not dtable:
            error_msg = 'Base %s not found.' % table_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not can_use_automation_rules_by_dtable(dtable):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        username = request.user.username
        org_id = request.user.org and request.user.org.org_id or -1
        if check_dtable_permission(username, workspace, dtable) not in WRITE_PERMISSION_TUPLE:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        try:
            automation_rule = DTableAutomationRules.objects.get(id=automation_rule_id)
            run_condition = automation_rule.run_condition
            trigger = automation_rule.trigger
            actions = automation_rule.actions

            forbidden_actions = ['convert_page_to_pdf', 'convert_document_to_pdf_and_send']
            convert_pdf_action = next(filter(lambda item: item.get('type') in forbidden_actions, json.loads(actions)), None)
            if convert_pdf_action:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied to run convert page to pdf')

            params = {
                'trigger': trigger,
                'run_condition': run_condition,
                'actions': actions,
                'dtable_uuid': dtable.uuid.hex,
                'username': username,
                'org_id': org_id,
                'automation_rule_id': automation_rule_id
            }
            task_id = add_run_auto_rule_task(type='run-auto-rule', params=params)

        except DTableAutomationRules.DoesNotExist:
            error_msg = 'automation_rule %s not found.' % automation_rule_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'task_id':task_id})

class DTableAutomationRuleTaskLogsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )


    def get(self, request, workspace_id, name, automation_rule_id):

        try:
            page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '20'))
        except ValueError:
            page = 1
            per_page = 20

        start = (page - 1) * per_page
        end = start + per_page

        table_name = name
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            error_msg = 'Workspace %s not found.' % workspace_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        dtable = DTables.objects.get_dtable(workspace, table_name)
        if not dtable:
            error_msg = 'DTable %s not found.' % table_name
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        if not can_use_automation_rules_by_dtable(dtable):
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        username = request.user.username
        permission = check_dtable_permission(username, workspace, dtable)
        if not permission:
            error_msg = 'Permission denied.'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        auto_rule_task_logs_queryset = DTableAutomationRulesTaskLog.objects.filter(rule_id=automation_rule_id).order_by('-trigger_time')
        logs_count = auto_rule_task_logs_queryset.count()
        auto_rule_task_logs_list = [rule_log.to_dict() for rule_log in auto_rule_task_logs_queryset[start:end]]
        return Response({'task_logs': auto_rule_task_logs_list, 'count': logs_count})

