import json
import logging
import os
import re
from collections import defaultdict
from copy import deepcopy
from datetime import datetime, date, timedelta
from uuid import UUID

import requests
from django.db import transaction
from django.db.models import Count, F
from django.utils.translation import gettext as _
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from seahub import settings
from seahub.avatar.settings import AVATAR_DEFAULT_SIZE
from seahub.avatar.templatetags.avatar_tags import api_avatar_url
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.status import HTTP_443_ABOVE_QUOTA
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error, to_python_boolean
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.ccnet_db.ccnet.groups import get_groups_info
from seahub.constants import PERMISSION_READ_WRITE
from seahub.dtable.constants import ColumnTypes
from seahub.dtable.models import DTableAutomationRules, DTables, IdInOrgTuple, Workspaces
from seahub.dtable.utils import PUBLIC_RELATIVE_PATH, UPLOAD_FILE_RELATIVE_PATH, can_use_automation_rules_by_dtable, check_dtable_admin_permission, check_dtable_permission, gen_random_option, \
    check_quota_by_workspace, check_row_limit_by_workspace, PUBLIC_FORMS_RELATIVE_PATH, generate_upload_link, \
    is_valid_jwt
from seahub.dtable_apps.dtable_db_api import DTableDBAPI
from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.dtable_apps.workflow.messages import transferring_workflow_task_cb
from seahub.dtable_apps.workflow.signals import new_pending_workflow_task, invalidate_workflow_task, \
    finish_workflow_task, transferring_workflow_task, dismiss_workflow_task
from seahub.dtable_apps.workflow.models import DTableWorkflowShare, DTableWorkflowTaskLogs, \
    DTableWorkflowTaskParticipants, DTableWorkflowTaskSchedules, DTableWorkflowTasks, DTableWorkflows, WorkflowFolders, \
    WorkflowFolderItems
from seahub.dtable_apps.workflow.utils import LOG_TYPE_INIT, NODE_TYPE_CANCELED, NODE_TYPE_COMPLETED, NODE_TYPE_NORMAL, \
    TASK_STATE_CANCELED, TASK_STATE_FINISHED, TASK_STATE_PROCESSING, get_can_cancel_task, get_canceled_node_from_config, \
    get_column_from_table, get_dynamic_participants_column_keys, get_name_from_config, \
    get_nodes_from_config, get_readwrite_columns, get_specific_node_from_config, get_state_column_key_from_config, \
    get_metadata, get_table_and_column_from_metadata, get_table_from_metadata, get_table_from_metadata_by_name, \
    get_table_id_from_config, is_valid_workflow_jwt, migrate_workflow_digital_sign_images, migrate_workflow_images, \
    remove_options_by_ids, update_column_permission, update_options, check_workflow_config, NODE_TYPE_INIT, \
    migrate_workflow_long_text_images, get_the_other_nodes_from_config, can_submit_workflow_task, get_next_node_id, \
    can_list_workflow_task_logs, can_table_create_workflow, create_option, create_options, \
    get_init_node_from_config, \
    get_finish_node_from_config, get_column_config_from_config, get_participants_column_key_from_config, \
    update_state_cell, update_participants_cell, MY_MANAGED_WORKFLOW, CAN_USED_WORKFLOW, WORKFLOW_FOLDER_TYPES
from seahub.group.utils import get_user_groups, is_group_admin_or_owner, get_user_admin_group_ids as group_get_user_admin_group_ids
from seahub.profile.models import Profile
from seahub.utils import is_org_context, get_inner_dtable_server_url, publish_workflow_actions
from seahub.utils.timeutils import datetime_to_isoformat_timestr
from seahub.department_v2.utils import get_departments_map_by_username

logger = logging.getLogger(__name__)
dtable_server_url = get_inner_dtable_server_url()
INNER_DTABLE_DB_URL = settings.INNER_DTABLE_DB_URL

class DTableWorkflowInitFormView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, token):
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')

        # resource check
        workflow = DTableWorkflows.objects.get_workflow_by_token(token)
        if not workflow:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workflow not found')

        error_msg = check_workflow_config(workflow.workflow_config)
        if error_msg:
            error_msg = 'The flow: %s workflow_config invalid: %s' % (token, error_msg)
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        workflow_config = json.loads(workflow.workflow_config)

        dtable = DTables.objects.get_dtable_by_uuid(workflow.dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        # permission check
        if not can_submit_workflow_task(workflow, request.user):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        init_node = get_init_node_from_config(workflow_config)
        if not init_node:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Workflow init form invalid')

        dtable_metadata = get_metadata(workflow.dtable_uuid)

        table_id = get_table_id_from_config(workflow_config)
        state_column_key = get_state_column_key_from_config(workflow_config)
        participants_column_key = get_participants_column_key_from_config(workflow_config)
        workflow_table, state_column = get_table_and_column_from_metadata(
            dtable_metadata,
            table_id,
            state_column_key,
            column_type=ColumnTypes.SINGLE_SELECT
        )
        if not workflow_table or not state_column:
            return api_error(status.HTTP_404_NOT_FOUND, 'Table or state column not found')

        columns_dict = {col['key']: col for col in workflow_table.get('columns', [])}

        readwrite_columns = init_node.get('node_form', {}).get('readwrite_columns', [])
        readwrite_columns = list(filter(lambda x: x['key'] not in [state_column_key, participants_column_key] and x['key'] in columns_dict, readwrite_columns))

        dynamic_participants_column_keys = set(get_dynamic_participants_column_keys(workflow_config))
        for col in readwrite_columns:
            if col['key'] in dynamic_participants_column_keys and columns_dict[col['key']]['type'] == ColumnTypes.COLLABORATOR:
                col['is_dynamic_participants_column'] = True

        return Response({
            'metadata': dtable_metadata,
            'workspace_id': dtable.workspace_id,
            'dtable_name': dtable.name,
            'table_id': table_id,
            'readwrite_columns': readwrite_columns,
            'columns_config': get_column_config_from_config(workflow_config) 
        })


def append_or_update_row(dtable, target_table, readwrite_columns, row_data, row_id, dtable_server_api: DTableServerAPI, protect_column_keys=None):
    """
    POST/PUT row

    return: row_id -> str
    """
    table_columns_dict_by_key, table_columns_dict_by_name = {}, {}
    for col in target_table['columns']:
        if protect_column_keys and col['key'] in protect_column_keys:
            continue
        table_columns_dict_by_key[col['key']] = col
        table_columns_dict_by_name[col['name']] = col
    form_column_keys = [col['key'] for col in readwrite_columns if col['key'] in table_columns_dict_by_key]
    form_column_names = [table_columns_dict_by_key[col_key]['name'] for col_key in form_column_keys]
    row_data = {col_name: value for col_name, value in row_data.items() if col_name in form_column_names}
    image_col_names, long_text_col_names, digital_sign_col_names = [], [], []
    for col in target_table['columns']:
        if col['key'] in form_column_keys and col['type'] == 'image':
            image_col_names.append(col['name'])
        elif col['key'] in form_column_keys and col['type'] == 'long-text':
            long_text_col_names.append(col['name'])
        elif col['key'] in form_column_keys and col['type'] == 'digital-sign':
            digital_sign_col_names.append(col['name'])
    row_data = migrate_workflow_images(row_data, image_col_names, dtable)
    row_data = migrate_workflow_long_text_images(row_data, long_text_col_names, dtable)
    row_data = migrate_workflow_digital_sign_images(row_data, digital_sign_col_names, dtable)

    if not row_id:  ### add row
        data = {
            'table_name': target_table.get('name'),
            'row': row_data
        }
        try:
            resp_dict = dtable_server_api.append_row(target_table['name'], row_data)
        except Exception as e:
            logger.error('dtable: %s table: %s add row error: %s', dtable.uuid, target_table['name'], e)
            raise Exception('dtable: %s table: %s add row error: %s' % (dtable.uuid, target_table['name'], e))
        row_id = resp_dict['_id']
    else:
        data = {
            'table_name': target_table.get('name'),
            'row': row_data,
            'row_id': row_id
        }
        try:
            dtable_server_api.update_row(target_table['name'], row_id, row_data)
        except Exception as e:
            logger.error('dtable: %s table: %s data: %s update row error: %s', dtable.uuid, target_table['name'], data, e)
            raise Exception('dtable: %s table: %s data: %s update row error: %s' % (dtable.uuid, target_table['name'], data, e))

    return row_id


def submit_workflow_form(dtable, dtable_metadata, workflow, target_table, readwrite_columns, row_data, row_id, dtable_server_api: DTableServerAPI, link_rows=None, new_linked_rows=None):
    """
    POST/PUT row

    return: row_id -> str
    """
    if not row_data:
        row_data = {}
    workflow_config = json.loads(workflow.workflow_config)
    protect_column_keys = [workflow_config.get('state_column_key'), workflow_config.get('participants_column_key')]
    ### append or update
    row_id = append_or_update_row(dtable, target_table, readwrite_columns, row_data, row_id, dtable_server_api, protect_column_keys=protect_column_keys)

    link_info_dict = {}

    if link_rows:
        for link in link_rows:
            link_id = link.get('link_id')
            other_table_name = link.get('other_table_name')
            other_row_ids = link.get('row_ids')
            other_table = get_table_from_metadata_by_name(dtable_metadata, other_table_name)
            if not other_table:
                continue
            link_info_dict[link_id] = {
                'table_id': target_table['_id'],
                'other_table_id': other_table['_id'],
                'row_id': row_id,
                'other_row_ids': other_row_ids
            }

    if new_linked_rows:
        for link in new_linked_rows:
            link_id = link.get('link_id')
            other_table_name = link.get('other_table_name')
            other_row_datas = link.get('row_datas')
            other_table = get_table_from_metadata_by_name(dtable_metadata, other_table_name)
            if not other_table:
                continue
            # add row
            new_row_ids = []
            for other_row_data in other_row_datas:
                new_row_id = append_or_update_row(dtable, other_table, other_table['columns'], other_row_data, None, dtable_server_api)
                new_row_ids.append(new_row_id)
            link_info = link_info_dict.get(link_id)
            if link_info:
                other_row_ids = link_info.get('other_row_ids') or []
                other_row_ids.extend(new_row_ids)
                link_info_dict[link_id]['other_row_ids'] = other_row_ids
            else:
                link_info_dict[link_id] = {
                    'table_id': target_table['_id'],
                    'other_table_id': other_table['_id'],
                    'row_id': row_id,
                    'other_row_ids': new_row_ids
                }

    # update links
    dtable_db_api = DTableDBAPI(dtable_server_api.username, str(dtable.uuid), INNER_DTABLE_DB_URL)
    for link_id, link_info in link_info_dict.items():
        # get link column
        link_column = next(filter(lambda column: column['type'] == ColumnTypes.LINK and column['data']['link_id'] == link_id, target_table['columns']), None)
        if not link_column:
            continue
        # sql query existing links
        sql = f"SELECT `{link_column['name']}` FROM `{target_table['name']}` WHERE `_id`='{row_id}'"
        existing_link_row_ids = [row['row_id'] for row in dtable_db_api.query(sql)['results'][0].get(link_column['key'], [])]
        # calc to-be-deleted-row-ids and to-be-appended-row-ids
        to_be_deleted_row_ids = [row_id for row_id in existing_link_row_ids if row_id not in link_info['other_row_ids']]
        to_be_append_row_ids = [row_id for row_id in link_info['other_row_ids'] if row_id not in existing_link_row_ids]
        # delete and append
        ## delete
        if to_be_deleted_row_ids:
            data = {
                'link_id': link_id,
                'table_id': link_info['table_id'],
                'other_table_id': link_info['other_table_id'],
                'other_rows_ids_map': {
                    row_id: to_be_deleted_row_ids
                }
            }
            try:
                dtable_db_api.batch_delete_links(data)
            except Exception as e:
                logger.exception('delete dtable: %s links: %s error: %s', dtable.uuid, data)
        ## append
        if to_be_append_row_ids:
            data = {
                'link_id': link_id,
                'table_id': link_info['table_id'],
                'other_table_id': link_info['other_table_id'],
                'other_rows_ids_map': {
                    row_id: to_be_append_row_ids
                }
            }
            try:
                dtable_db_api.batch_append_links(data)
            except Exception as e:
                logger.exception('append dtable: %s links: %s error: %s', dtable.uuid, data)

    return row_id


def do_actions(dtable, next_node, workflow_task):
    if not can_use_automation_rules_by_dtable(dtable):
        return
    next_node_id = next_node['_id']
    if next_node.get('actions'):
        try:
            publish_workflow_actions(workflow_task.id, next_node_id)
        except Exception as e:
            logger.warning('task: %s to node: %s do actions error: %s', workflow_task.id, next_node_id, e)


def get_participants_from_node(workflow_task, dtable_uuid, next_node, target_table, row_data):
    """
    1. next_node is init node, return [workflow_task.initiator]
    2. next_node is normal node
        1. static participants, return next_node['participants']
        2. dynamic participants, return the cell of node participants column in task row
            1. in row_data, need COLLABORATOR type
            2. request table row, need COLLABORATOR or LINK_FORMULA type
    3. return empty list []
    """
    row_data = row_data or {}
    if next_node['type'] == NODE_TYPE_INIT:
        return [workflow_task.initiator]
    if next_node['type'] != NODE_TYPE_NORMAL:
        return []
    if next_node.get('participants_type', 'static') == 'static':
        return next_node.get('participants', [])
    node_participants_column_key = next_node.get('node_participants_column_key')
    if not node_participants_column_key:
        return []
    node_participants_column = get_column_from_table(target_table, node_participants_column_key)
    if not node_participants_column \
        or node_participants_column['type'] not in [ColumnTypes.COLLABORATOR, ColumnTypes.LINK_FORMULA]:
        return []
    if node_participants_column['type'] == ColumnTypes.COLLABORATOR \
        and node_participants_column['name'] in row_data \
        and isinstance(row_data[node_participants_column['name']], list):
        return row_data[node_participants_column['name']]
    sql = ''' SELECT * FROM `%(table)s` WHERE _id='%(row_id)s' ''' % {
        'table': target_table['name'],
        'row_id': workflow_task.row_id
    }
    dtable_db_api = DTableDBAPI('dtable-web', str(dtable_uuid), INNER_DTABLE_DB_URL)
    try:
        results = dtable_db_api.query(sql)['results']
    except Exception as e:
        logger.exception('request task: %s dtable: %s table: %s row_id: %s participants column: %s error: %s', workflow_task.id, dtable_uuid, target_table['name'], workflow_task.row_id, node_participants_column_key, e)
        return []
    if not results:
        logger.error('request task: %s dtable: %s table: %s row_id: %s participants column: %s error no results', workflow_task.id, dtable_uuid, target_table['name'], workflow_task.row_id, node_participants_column_key)
        return []
    participants = results[0].get(node_participants_column_key, [])
    if not isinstance(participants, list):
        return []
    return list(set(participants))


re_after_offset = re.compile(r'^\+?\d+[dh]$')
def add_workflow_task_schedules(workflow_task, node, participants):

    DTableWorkflowTaskSchedules.objects.filter(task=workflow_task).delete()

    if node['type'] != NODE_TYPE_NORMAL:
        return

    if not node.get('enable_processing_time_limit'):
        return

    processing_time_limit = node.get('processing_time_limit', '0')
    if not processing_time_limit or processing_time_limit == '0':
        return

    if not re_after_offset.match(str(processing_time_limit)):
        return

    offset_number = int(processing_time_limit[1:-1])
    if processing_time_limit[-1] == 'd':
        schedule_time = datetime.utcnow() + timedelta(days=offset_number)
    else:
        schedule_time = datetime.utcnow() + timedelta(hours=offset_number)

    action = {
        'type': 'notify',
        'to_users': participants,
        'token': workflow_task.dtable_workflow.token,
        'offset': processing_time_limit
    }

    DTableWorkflowTaskSchedules.objects.create(
        task=workflow_task,
        schedule_time=schedule_time,
        action=json.dumps(action)
    )


def transfer_task(dtable, workflow, workflow_task, target_table, state_column, participants_column, current_node, row_data, next_node, username, need_all_participants_submit):
    """
    transfer a task from one node to another node

    update state cell
    db operations
    update participants cell
    send notifications

    """
    workflow_config = json.loads(workflow.workflow_config)
    state_column_data = state_column.get('data') or {}
    options = state_column_data.get('options') or []
    next_node_id = next_node['_id']
    next_state_option_id = next_node.get('state_option_id')
    ## update state
    ### check or create new option
    if not next_state_option_id or next_state_option_id not in [option['id'] for option in options]:
        #### create option
        workflow_config = create_option(dtable.uuid.hex, target_table['name'], state_column['name'], next_node_id, next_node['name'], workflow_config)
        error_msg = check_workflow_config(workflow_config, hard_length=True)
        if error_msg:
            logger.error('workflow: %s task: %s table: %s state_column: %s create option: %s failed', workflow, workflow_task, target_table['name'], state_column, next_node['name'])
            raise Exception('Create state option invalid')
        workflow.workflow_config = json.dumps(workflow_config)
        workflow.save()
        next_node = get_specific_node_from_config(workflow_config, next_node_id)
        next_state_option_id = next_node['state_option_id']
    ### update state cell
    update_state_cell(dtable, workflow, target_table, state_column, workflow_task.row_id, next_state_option_id)

    with transaction.atomic():
        ## update task
        workflow_task.node_id = next_node_id
        if next_node['type'] == NODE_TYPE_COMPLETED:
            workflow_task.task_state = TASK_STATE_FINISHED
            workflow_task.finished_at = datetime.now()
            finish_workflow_task.send(None, workflow=workflow, task=workflow_task)
        elif next_node['type'] == NODE_TYPE_CANCELED:
            workflow_task.task_state = TASK_STATE_CANCELED
            workflow_task.finished_at = None
        else:
            workflow_task.task_state = TASK_STATE_PROCESSING
            workflow_task.finished_at = None
        workflow_task.save()
        ## update participants and send notifications to new participants
        participants = get_participants_from_node(workflow_task, workflow.dtable_uuid, next_node, target_table, row_data) or []
        db_participants = DTableWorkflowTaskParticipants.objects.bulk_add_participants(workflow_task.id, next_node_id, participants)
        if db_participants:
            if next_node['type'] == NODE_TYPE_NORMAL:
                new_pending_workflow_task.send(None, token=workflow.token, task_id=workflow_task.id, participants=[p.participant for p in db_participants])
            elif next_node['type'] == NODE_TYPE_INIT:
                dismiss_workflow_task.send(None, token=workflow.token, task_id=workflow_task.id, initiator=workflow_task.initiator)
        ## record log
        transfer_username = username if not need_all_participants_submit else 'workflow'
        DTableWorkflowTaskLogs.objects.add_transfer_log(workflow_task, transfer_username, current_node['_id'], next_node_id=next_node_id)

    # udpate participants cell
    if participants_column:
        update_participants_cell(dtable.uuid, target_table['name'], workflow_task.row_id, participants_column['key'], participants)

    # send notifications
    transferring_workflow_task.connect(transferring_workflow_task_cb)
    transferring_workflow_task.send(
        None,
        workflow=workflow,
        flow_task=workflow_task,
        dtable=dtable,
        table=target_table,
        node_id=current_node['_id'],
        next_node_id=next_node_id,
    )

    # do actions
    do_actions(dtable, next_node, workflow_task)

    # add task schedules
    add_workflow_task_schedules(workflow_task, next_node, participants)


def initiate_task(dtable, workflow, init_node, target_table, state_column, row_id, row_data, username):
    """
    initiate a workflow task

    :return: workflow_task: None or an instance of WorkflowTasks
    """
    workflow_config = json.loads(workflow.workflow_config)
    ## next_node_id
    next_node_id = get_next_node_id(get_nodes_from_config(workflow_config), init_node, str(dtable.uuid), target_table, row_id)
    if not next_node_id:
        return None
    ## update state
    next_node = get_specific_node_from_config(workflow_config, next_node_id)
    if not next_node:
        return None
    state_column_data = state_column.get('data') or {}
    options = state_column_data.get('options') or []
    next_state_option_id = next_node.get('state_option_id')
    ## check or create new option
    if next_state_option_id not in [option['id'] for option in options]:
        ### create option
        workflow_config = create_option(dtable.uuid.hex, target_table.get('name'), state_column.get('name'), next_node_id, next_node.get('name'), workflow_config)
        error_msg = check_workflow_config(workflow_config, hard_length=True)
        if error_msg:
            logger.error('workflow: %s table: %s state_column: %s create option: %s failed', workflow, target_table['name'], state_column, next_node['name'])
            raise Exception('Create state option invalid')
        workflow.workflow_config = json.dumps(workflow_config)
        workflow.save()
        next_node = get_specific_node_from_config(workflow_config, next_node_id)
        next_state_option_id = next_node['state_option_id']
    ## update state cell
    update_state_cell(dtable, workflow, target_table, state_column, row_id, next_state_option_id)
    ## init db task/participants
    with transaction.atomic():
        # init task
        task_state = TASK_STATE_FINISHED if next_node.get('type') == NODE_TYPE_COMPLETED else TASK_STATE_PROCESSING
        finished_at = datetime.now() if next_node.get('type') == NODE_TYPE_COMPLETED else None
        db_task = DTableWorkflowTasks.objects.create(
            dtable_workflow=workflow,
            row_id=row_id,
            initiator=username,
            node_id=next_node_id,
            task_state=task_state,
            finished_at=finished_at
        )
        if task_state == TASK_STATE_FINISHED:
            finish_workflow_task.send(None, workflow=workflow, task=db_task)
        # generate task participants
        participants = next_node.get('participants', [])
        participants = get_participants_from_node(db_task, workflow.dtable_uuid, next_node, target_table, row_data)
        db_participants = DTableWorkflowTaskParticipants.objects.bulk_add_participants(db_task.id, next_node_id, participants)
        if db_participants:
            new_pending_workflow_task.send(None, token=workflow.token, task_id=db_task.id, participants=[p.participant for p in db_participants])
        # init log
        DTableWorkflowTaskLogs.objects.add_init_log(db_task, username, init_node['_id'], next_node_id=next_node_id)

    # udpate participants cell
    participants_column_key = get_participants_column_key_from_config(workflow_config)
    if participants_column_key and get_column_from_table(target_table, participants_column_key, column_type=ColumnTypes.COLLABORATOR):
        update_participants_cell(dtable.uuid, target_table['name'], row_id, participants_column_key, participants)

    # send notifications
    transferring_workflow_task.connect(transferring_workflow_task_cb)
    transferring_workflow_task.send(
        None,
        workflow=workflow,
        flow_task=db_task,
        dtable=dtable,
        table=target_table,
        node_id=init_node['_id'],
        next_node_id=next_node_id,
    )

    do_actions(dtable, next_node, db_task)

    # add task schedules
    add_workflow_task_schedules(db_task, next_node, participants)

    return db_task


def trigger_workflow(dtable, flow_app, username, row_id, row_data, link_rows, new_linked_rows):
    """
    Trigger a workflow and generate a new workflow task
    If row_id is not None, row_data needs to be None
    If row_id is None, row_data is required and link_rows and new_linked_rows need to be None or list

    :return: workflow_task => workflow_task or None, error => api_error or None
    """
    workflow_config = json.loads(flow_app.workflow_config)
    workflow_db_api = DTableDBAPI('workflow', str(dtable.uuid), INNER_DTABLE_DB_URL)
    initiator_server_api = DTableServerAPI(username, str(dtable.uuid), dtable_server_url)

    ## init node
    init_node = get_init_node_from_config(workflow_config)
    if not init_node:
        logger.error('flow: %s has no init node', flow_app.id)
        return None, api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
    try:
        ## table column resource check
        dtable_metadata = get_metadata(flow_app.dtable_uuid)
        target_table = get_table_from_metadata(dtable_metadata, workflow_config.get('table_id'))
        if not target_table:
            return None, api_error(status.HTTP_404_NOT_FOUND, 'Table %s not found' % workflow_config.get('table_id'))
        state_column = get_column_from_table(target_table, workflow_config.get('state_column_key'), column_type=ColumnTypes.SINGLE_SELECT)
        if not state_column:
            return None, api_error(status.HTTP_404_NOT_FOUND, 'State column %s not found or not a single-select column' % workflow_config.get('state_column_key'))
        ## row id
        if not row_id:
            readwrite_columns = get_readwrite_columns(init_node)
            row_id = submit_workflow_form(dtable, dtable_metadata, flow_app, target_table, readwrite_columns, row_data, None, initiator_server_api, link_rows, new_linked_rows)
        else:
            sql = "SELECT COUNT(`_id`) AS count FROM `%(table)s` WHERE `_id`='%(row_id)s'" % {'table': target_table['name'], 'row_id': row_id}
            resp_json = workflow_db_api.query(sql)
            count = resp_json['results'][0]['count']
            if count == 0:
                return None, api_error(status.HTTP_404_NOT_FOUND, 'Row not found')
        db_task = initiate_task(dtable, flow_app, init_node, target_table, state_column, row_id, row_data, username)
        if not db_task:
            return None, None
    except Exception as e:
        logger.exception(e)
        logger.error('submit a task of flow: %s error: %s', flow_app.id, e)
        return None, api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

    return db_task, None


# submit api
class DTableWorkflowSubmitTaskView(APIView):
    """
    submit workflow form / initiate workflow task
    """
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, token):
        """
        submit workflow task

        steps of submitting task

        1. add row or use existing row
        2. update state if has next node
        3. add task/task-participants db record(s)
        4. send notification signal
        5. update participants if set
        """
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')
        # arguments check
        row_id = request.data.get('row_id', None)
        row_data = request.data.get('row_data')
        replace = request.data.get('replace')
        app_uuid = request.data.get('app_uuid')
        form_token = request.data.get('form_token')
        link_rows = request.data.get('link_rows')
        new_linked_rows = request.data.get('new_linked_rows')
        if replace:
            try:
                replace = to_python_boolean(request.data.get('replace', 'true'))
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'replace invalid')
        if not row_id and row_data:
            try:
                row_data = json.loads(row_data)
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'row_data invalid')
        else:
            row_data = {}
        if not row_id and link_rows:
            try:
                link_rows = json.loads(link_rows)
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'link_rows invalid')
        else:
            link_rows = []
        if not row_id and new_linked_rows:
            try:
                new_linked_rows = json.loads(new_linked_rows)
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'new_linked_rows invalid')
        else:
            new_linked_rows = []

        # resource check
        flow_app = DTableWorkflows.objects.get_workflow_by_token(token)
        if not flow_app:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workflow not found')
        dtable = DTables.objects.get_dtable_by_uuid(flow_app.dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')
        if row_id:
            row_id_task = DTableWorkflowTasks.objects.get_task_by_token_row_id(token, row_id)
            if row_id_task:
                if not replace:
                    return api_error(status.HTTP_400_BAD_REQUEST, 'Task exists')
                else:
                    row_id_task.delete()

        error_msg = check_workflow_config(flow_app.workflow_config)
        if error_msg:
            error_msg = 'The flow: %s workflow_config invalid: %s' % (token, error_msg)
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # permission check
        org_id = -1
        if is_org_context(request):
            org_id = request.user.org.org_id
        can_submit = False
        if app_uuid or form_token:
            can_submit = True
        if not can_submit and can_submit_workflow_task(flow_app, request.user):
            can_submit = True
        if not can_submit:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        # quota check
        if not row_id and not check_quota_by_workspace(dtable.workspace):
            error_msg = 'Asset quota exceeded'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)
        # rows check
        if not row_id and not check_row_limit_by_workspace(dtable.workspace):
            error_msg = 'Rows exceeded'
            return api_error(status.HTTP_403_FORBIDDEN, error_msg)

        db_task, error = trigger_workflow(dtable, flow_app, request.user.username, row_id, row_data, link_rows, new_linked_rows)
        if error:
            return error
        if not db_task:
            return Response({'success': True})
        return Response({'task': db_task.to_dict()})


class InternalDTableWorkflowSubmitView(APIView):
    """
    For internal components, like automation rules, submit workflow task
    """
    authentication_classes = ()
    permission_classes = ()
    throttle_classes = (UserRateThrottle, )

    def post(self, request, token):
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')

        # arguments check
        row_id = request.data.get('row_id', None)
        row_data = request.data.get('row_data')
        replace = request.data.get('replace')
        submit_from = request.data.get('submit_from')
        link_rows = request.data.get('link_rows')
        new_linked_rows = request.data.get('new_linked_rows')
        automation_rule_id = request.data.get('automation_rule_id')
        if replace:
            try:
                replace = to_python_boolean(request.data.get('replace', 'true'))
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'replace invalid')
        if not row_id and row_data:
            try:
                row_data = json.loads(row_data)
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'row_data invalid')
        else:
            row_data = {}
        if not row_id and link_rows:
            try:
                link_rows = json.loads(link_rows)
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'link_rows invalid')
        else:
            link_rows = []
        if not row_id and new_linked_rows:
            try:
                new_linked_rows = json.loads(new_linked_rows)
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'new_linked_rows invalid')
        else:
            new_linked_rows = []
        if submit_from == 'Automation Rule':
            if not automation_rule_id:
                return api_error(status.HTTP_400_BAD_REQUEST, 'automation_rule_id invalid')
            username = 'Automation Rule'
        else:
            return api_error(status.HTTP_400_BAD_REQUEST, 'submit_from invalid')

        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        is_valid = is_valid_workflow_jwt(auth, token)
        if not is_valid:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        # resource check
        flow_app = DTableWorkflows.objects.get_workflow_by_token(token)
        if not flow_app:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workflow not found')
        dtable = DTables.objects.get_dtable_by_uuid(flow_app.dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')
        if row_id:
            row_id_task = DTableWorkflowTasks.objects.get_task_by_token_row_id(token, row_id)
            if row_id_task:
                if not replace:
                    return api_error(status.HTTP_400_BAD_REQUEST, 'Task exists')
                else:
                    row_id_task.delete()

        error_msg = check_workflow_config(flow_app.workflow_config)
        if error_msg:
            error_msg = 'The flow: %s workflow_config invalid: %s' % (token, error_msg)
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        ## automation rule check
        if submit_from == 'Automation Rule':
            automation_rule = DTableAutomationRules.objects.get_rule_by_id(automation_rule_id)
            if not automation_rule:
                return api_error(status.HTTP_404_NOT_FOUND, 'Automation Rule not found')

        # permission check
        if submit_from == 'Automation Rule' and automation_rule.dtable_uuid != dtable.uuid.hex:
            # TODO: in more, can check actions
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        db_task, error = trigger_workflow(dtable, flow_app, username, row_id, row_data, link_rows, new_linked_rows)
        if error:
            return error
        if not db_task:
            return Response({'success': True})
        return Response({'task': db_task.to_dict()})


class ExternalDTableWorkflowSubmitView(APIView):
    """
    trigger workflow by access-token, such as from seatable-api-python
    """
    authentication_classes = ()
    permission_classes = ()
    throttle_classes = (UserRateThrottle,)

    def post(self, request, token):
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')
        # argumets check
        row_id = request.data.get('row_id') or None
        row_data = request.data.get('row_data') or ''
        link_rows = request.data.get('link_rows')
        new_linked_rows = request.data.get('new_linked_rows')
        initiator_username = request.data.get('initiator')
        if not row_id and row_data:
            try:
                row_data = json.loads(row_data)
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'row_data invalid')
        else:
            row_data = {}
        if not row_id and link_rows:
            try:
                link_rows = json.loads(link_rows)
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'link_rows invalid')
        else:
            link_rows = []
        if not row_id and new_linked_rows:
            try:
                new_linked_rows = json.loads(new_linked_rows)
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'new_linked_rows invalid')
        else:
            new_linked_rows = []

        # permission check
        ## checkout dtable_uuid first
        workflow = DTableWorkflows.objects.get_workflow_by_token(token)
        if not workflow:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workflow not found')
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        is_valid = is_valid_jwt(auth, workflow.dtable_uuid)
        if not is_valid:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        # resource check
        if row_id:
            row_id_task = DTableWorkflowTasks.objects.get_task_by_token_row_id(token, row_id)
            if row_id_task:
                return api_error(status.HTTP_400_BAD_REQUEST, 'Task exists')
        dtable = DTables.objects.get_dtable_by_uuid(workflow.dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')
        if initiator_username:
            initiator = Profile.objects.filter(user=initiator_username).first()
            if not initiator:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        else:
            initiator_username = 'anonymous'

        db_task, error = trigger_workflow(dtable, workflow, initiator_username, row_id, row_data, link_rows, new_linked_rows)
        if error:
            return error
        if not db_task:
            return Response({'success': True})
        return Response({'task': db_task.to_dict()})


class DTableWorkflowTransferView(APIView):
    """
    transfer a workflow task from one node to another node
    """
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, token, task_id):
        """
        transfer workflow task

        steps of transfering task
        1. update row if request node has valid row data
        2. update state if has next state
        3. update db task/task-participants
        4. send notification signal
        """
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')
        # arguments check
        node_id = request.data.get('node_id')
        next_node_id = request.data.get('next_node_id')
        row_data = request.data.get('row_data')
        link_rows = request.data.get('link_rows')
        new_linked_rows = request.data.get('new_linked_rows')
        if not node_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'node_id invalid')
        if row_data:
            try:
                row_data = json.loads(row_data)
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'row_data invalid')
        else:
            row_data = {}
        if link_rows:
            try:
                link_rows = json.loads(link_rows)
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'link_rows invalid')
        else:
            link_rows = []
        if new_linked_rows:
            try:
                new_linked_rows = json.loads(new_linked_rows)
            except:
                return api_error(status.HTTP_400_BAD_REQUEST, 'new_linked_rows invalid')
        else:
            new_linked_rows = []

        # resource check
        flow_app = DTableWorkflows.objects.get_workflow_by_token(token)
        if not flow_app:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workflow not found')
        flow_task = DTableWorkflowTasks.objects.filter(dtable_workflow=flow_app, id=task_id).first()
        if not flow_task:
            return api_error(status.HTTP_404_NOT_FOUND, 'Task not found')
        if flow_task.node_id != node_id:
            return api_error(status.HTTP_409_CONFLICT, 'Task has been handled')
        if flow_task.task_state == TASK_STATE_CANCELED:
            return api_error(status.HTTP_403_FORBIDDEN, 'Task has been canceled')
        error_msg = check_workflow_config(flow_app.workflow_config)
        if error_msg:
            error_msg = 'The flow: %s of the task: %s workflow_config invalid: %s' % (flow_task.dtable_workflow_id, task_id, error_msg)
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        # check table exists
        dtable = DTables.objects.get_dtable_by_uuid(flow_app.dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        # checkout nodes
        workflow_config = json.loads(flow_app.workflow_config)
        nodes = get_nodes_from_config(workflow_config)
        nodes_dict = {node['_id']: node for node in nodes}

        # check operate permission
        username = request.user.username
        can_transfer = DTableWorkflowTaskParticipants.objects.can_transfer(flow_task, username)
        is_admin = check_dtable_admin_permission(username, dtable.workspace.owner)
        if not can_transfer and not is_admin:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        is_cancel_task = False
        can_cancel_task = get_can_cancel_task(workflow_config)
        if next_node_id and next_node_id in nodes_dict and nodes_dict[next_node_id]['type'] == NODE_TYPE_CANCELED:
            if not can_cancel_task:
                return api_error(status.HTTP_403_FORBIDDEN, 'Task can not be canceled')
            if flow_task.task_state == TASK_STATE_FINISHED:
                return api_error(status.HTTP_403_FORBIDDEN, 'Task is finished')
            is_cancel_task = True

        # prepare some variables
        operator_server_api = DTableServerAPI(username, flow_app.dtable_uuid, dtable_server_url)
        current_node = nodes_dict.get(flow_task.node_id)
        if not current_node:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Current node of the task invalid')
        ## if task in init node, forbidden next_node_id
        if current_node['type'] == 'init' and not is_admin:
            next_node_id = None
        is_back_task = False
        if next_node_id:
            tmp_next_node = nodes_dict.get(next_node_id)
            is_back_task = tmp_next_node and tmp_next_node['type'] == NODE_TYPE_INIT
        need_all_participants_submit = current_node.get('need_all_participants_submit', False)
        if next_node_id and (next_node_id == current_node['_id'] or next_node_id not in nodes_dict):
            return api_error(status.HTTP_400_BAD_REQUEST, 'next_node_id invalid')

        # fill row data
        target_table = None
        state_column = None
        try:
            dtable_metadata = get_metadata(flow_app.dtable_uuid)
            table_id = get_table_id_from_config(workflow_config)
            state_column_key = get_state_column_key_from_config(workflow_config)
            participants_column_key = get_participants_column_key_from_config(workflow_config)
            target_table, state_column = get_table_and_column_from_metadata(dtable_metadata, table_id, state_column_key, column_type=ColumnTypes.SINGLE_SELECT)
            if not target_table:
                return api_error(status.HTTP_404_NOT_FOUND, 'Table %s not found' % table_id)
            if not state_column:
                return api_error(status.HTTP_404_NOT_FOUND, 'State column %s not found or not a single-select column' % state_column_key)
            ## fill task row and record log
            if not is_cancel_task:
                readwrite_columns = get_readwrite_columns(current_node)
                submit_workflow_form(dtable, dtable_metadata, flow_app, target_table, readwrite_columns, row_data, flow_task.row_id, operator_server_api, link_rows, new_linked_rows)
            ## delete participant records
            need_all_participants_submit = need_all_participants_submit and not (is_cancel_task or is_back_task)
            if not need_all_participants_submit:
                DTableWorkflowTaskParticipants.objects.filter(
                    dtable_workflow_task=flow_task
                ).delete()
            else:
                DTableWorkflowTaskParticipants.objects.filter(
                    dtable_workflow_task=flow_task,
                    participant=username
                ).delete()
                ### record counter log
                DTableWorkflowTaskLogs.objects.add_counter_log(flow_task, username, current_node['_id'])
        except Exception as e:
            logger.exception(e)
            logger.error('fill task: %s row error: %s', task_id, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        # prepare participants column
        participants_column = get_column_from_table(target_table, participants_column_key, column_type=ColumnTypes.COLLABORATOR)

        # if need all participants submit and current user is not the last one, return directly
        rest_participants = list(DTableWorkflowTaskParticipants.objects.filter(dtable_workflow_task=flow_task))
        if need_all_participants_submit and not next_node_id and rest_participants:
            if participants_column_key and participants_column:
                rest_participant_usernames = [item.participant for item in rest_participants]
                update_participants_cell(dtable.uuid, target_table['name'], flow_task.row_id, participants_column_key, rest_participant_usernames)
            return Response({'success': True})

        # transfer
        if not next_node_id:
            next_node_id = get_next_node_id(get_nodes_from_config(workflow_config), current_node, str(dtable.uuid), target_table, flow_task.row_id)
        if not next_node_id:
            update_participants_cell(dtable.uuid, target_table['name'], flow_task.row_id, participants_column_key, [])
            return Response({'success': True})
        next_node = nodes_dict.get(next_node_id)
        if not next_node:
            update_participants_cell(dtable.uuid, target_table['name'], flow_task.row_id, participants_column_key, [])
            return Response({'success': True})
        try:
            transfer_task(dtable, flow_app, flow_task, target_table, state_column, participants_column, current_node, row_data, next_node, username, need_all_participants_submit)
        except Exception as e:
            logger.exception(e)
            logger.error('transfer task: %s row error: %s', task_id, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})


class DTableWorkflowLinkedTableRowsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, token):
        # arguments check
        link_column_key = request.GET.get('link_column_key')
        if not link_column_key:
            return api_error(status.HTTP_400_BAD_REQUEST, 'link_column_key invalid')
        task_id = request.GET.get('task_id')

        # resource check
        workflow = DTableWorkflows.objects.get_workflow_by_token(token)
        if not workflow:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workflow not found')
        if task_id:
            workflow_task = DTableWorkflowTasks.objects.get_task_by_token_id(token, task_id)
            if not workflow_task:
                return api_error(status.HTTP_404_NOT_FOUND, 'Workflow task not found')

        dtable = DTables.objects.get_dtable_by_uuid(workflow.dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        # permission check
        username = request.user.username
        if task_id:
            username = request.user.username
            can_transfer = DTableWorkflowTaskParticipants.objects.can_transfer(workflow_task, username)
            is_admin = check_dtable_admin_permission(username, dtable.workspace.owner)
            if not can_transfer and not is_admin:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        else:
            if not can_submit_workflow_task(workflow, request.user):
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        column_config = get_column_config_from_config(workflow.workflow_config)

        try:
            dtable_metadata = get_metadata(workflow.dtable_uuid)
        except Exception as e:
            logger.error('request dtable: %s metadata error: %s', workflow.dtable_uuid, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        table_id = get_table_id_from_config(workflow.workflow_config)
        target_table, link_column = get_table_and_column_from_metadata(dtable_metadata, table_id, link_column_key, column_type=ColumnTypes.LINK)
        if not target_table or not link_column:
            return api_error(status.HTTP_404_NOT_FOUND, 'table or column not found')

        link_table_id = link_column['data']['table_id']
        link_other_table_id = link_column['data']['other_table_id']
        linked_table_id = link_other_table_id if link_table_id == table_id else link_table_id
        linked_table = get_table_from_metadata(dtable_metadata, linked_table_id)
        if not linked_table:
            return api_error(status.HTTP_404_NOT_FOUND, 'linked table not found')

        link_column_config = column_config.get(link_column_key) or {}
        link_filters = link_column_config.get('link_filters', [])
        link_filter_conjunction = link_column_config.get('link_filter_conjunction')
        user_department_ids_map = get_departments_map_by_username(username)
        current_user_department_ids = user_department_ids_map['current_user_department_ids']
        current_user_department_and_sub_ids = user_department_ids_map['current_user_department_and_sub_ids']

        filter_conditions = {
            'start': 0,
            'limit': 10000
        }

        id_in_org_tuple = IdInOrgTuple.objects.filter(virtual_id=username)
        id_in_org = id_in_org_tuple[0].id_in_org if id_in_org_tuple else ''

        if link_filters:
            for item in link_filters:
                filter_term = item.get('filter_term')
                filter_predicate = item.get('filter_predicate')
                if filter_predicate == 'include_me':
                    item['filter_term'].append(username)
                if filter_predicate == 'is_current_user_ID':
                    item['filter_term'] = id_in_org
                if filter_term == 'current_user_department':
                    item['current_user_department'] = current_user_department_ids
                if filter_term == 'current_user_department_and_sub':
                    item['current_user_department_and_sub'] = current_user_department_and_sub_ids
                if isinstance(filter_term, list):
                    if 'current_user_department' in filter_term or 'current_user_department_and_sub' in filter_term:
                        item['current_user_department'] = current_user_department_ids
                        item['current_user_department_and_sub'] = current_user_department_and_sub_ids
            filter_conditions['filters'] = link_filters
            filter_conditions['filter_conjunction'] = link_filter_conjunction

        import dtable_events
        try:
            sql = dtable_events.filter2sql(
                linked_table['name'],
                linked_table['columns'],
                filter_conditions,
                by_group=False
            )

            dtable_db_api = DTableDBAPI('dtable-web', str(dtable.uuid), INNER_DTABLE_DB_URL)
            rows = dtable_db_api.query(sql)['results']
        except dtable_events.SQLGeneratorOptionInvalidError:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Invalid option in single or multiple select columns')
        except dtable_events.DateTimeQueryInvalidError as e:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Invalid query in column %s' % e.column_name)
        except Exception as e:
            logger.error('query dtable: %s sql: %s error: %s', dtable.uuid, sql, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'linked_table_rows': rows})


class DTableWorkflowTaskCancelView(APIView):
    """
    cancel task
    """
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, token, task_id):
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')

        # resource check
        resources = _task_resources_check(token, task_id)
        if resources.get('error'):
            return resources['error']
        workflow_task = resources.get('task')
        if workflow_task.task_state == TASK_STATE_CANCELED:
            return api_error(status.HTTP_403_FORBIDDEN, 'Workflow task has been canceled')
        workflow = workflow_task.dtable_workflow
        dtable = resources.get('dtable')
        workflow_config = json.loads(workflow.workflow_config)

        # permission check
        username = request.user.username
        can_cancel_task = get_can_cancel_task(workflow_config)
        if not can_cancel_task:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        # check current and canceled node
        task_row_info = _request_task_row(workflow_task, dtable, username, workflow_config)
        if task_row_info.get('error'):
            return task_row_info['error']
        target_table = task_row_info['workflow_table']
        current_node = task_row_info['current_node']
        canceled_node = get_canceled_node_from_config(workflow_config)

        # prepare some variables
        state_column_key = get_state_column_key_from_config(workflow_config)
        participants_column_key = get_participants_column_key_from_config(workflow_config)

        # cancel
        try:
            state_column = get_column_from_table(target_table, state_column_key, column_type=ColumnTypes.SINGLE_SELECT)
            if not state_column:
                return api_error(status.HTTP_404_NOT_FOUND, 'State column %s not found or not a single-select column' % state_column_key)
            participants_column = get_column_from_table(target_table, participants_column_key, column_type=ColumnTypes.COLLABORATOR)
            ## delete participants
            DTableWorkflowTaskParticipants.objects.filter(dtable_workflow_task=workflow_task).delete()
            ## if no canceled node, create one
            if not canceled_node:
                canceled_node = {
                    '_id': 'canceled',
                    'type': NODE_TYPE_CANCELED,
                    'name': _('Canceled')
                }
                workflow_config['nodes'].append(canceled_node)
                error_msg = check_workflow_config(workflow_config, hard_length=True)
                if error_msg:
                    logger.error('workflow: %s task: %s add canceled node error: %s', workflow, workflow_task, error_msg)
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
                workflow.workflow_config = json.dumps(workflow_config)
            transfer_task(dtable, workflow, workflow_task, target_table, state_column, participants_column, current_node, None, canceled_node, username, False)
        except Exception as e:
            logger.exception(e)
            logger.error('cancel task: %s error: %s', task_id, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        task_info = workflow_task.to_dict()
        task_info['initiator_name'] = email2nickname(workflow_task.initiator)
        task_info = fill_task_infos_with_submitted_content([task_info], invalidate_tasks=True)[0]

        return Response({'task': task_info})


class DTableWorkflowTaskResubmitView(APIView):
    """
    reset cancel task
    """
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request, token, task_id):
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')

        # resource check
        resources = _task_resources_check(token, task_id)
        if resources.get('error'):
            return resources['error']
        workflow_task = resources.get('task')
        if workflow_task.task_state != TASK_STATE_CANCELED:
            return api_error(status.HTTP_403_FORBIDDEN, 'Workflow task is not canceled')
        workflow = workflow_task.dtable_workflow
        dtable = resources.get('dtable')
        workflow_config = json.loads(workflow.workflow_config)

        # permission check
        username = request.user.username
        if workflow_task.initiator != username and not check_dtable_admin_permission(username, workflow.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        # check current and canceled node
        task_row_info = _request_task_row(workflow_task, dtable, username, workflow_config)
        if task_row_info.get('error'):
            return task_row_info['error']
        target_table = task_row_info['workflow_table']
        current_node = task_row_info['current_node']
        # canceled_node = get_canceled_node_from_config(workflow_config)
        init_node = get_init_node_from_config(workflow_config)

        # prepare some variables
        state_column_key = get_state_column_key_from_config(workflow_config)
        participants_column_key = get_participants_column_key_from_config(workflow_config)

        # resubmit
        try:
            ## delete participants
            DTableWorkflowTaskParticipants.objects.filter(dtable_workflow_task=workflow_task).delete()
            state_column = get_column_from_table(target_table, state_column_key, column_type=ColumnTypes.SINGLE_SELECT)
            if not state_column:
                return api_error(status.HTTP_404_NOT_FOUND, 'State column %s not found or not a single-select column' % state_column_key)
            participants_column = get_column_from_table(target_table, participants_column_key, column_type=ColumnTypes.COLLABORATOR)
            transfer_task(dtable, workflow, workflow_task, target_table, state_column, participants_column, current_node, None, init_node, username, False)
        except Exception as e:
            logger.exception(e)
            logger.error('cancel task: %s error: %s', task_id, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        task_info = workflow_task.to_dict()
        task_info['initiator_name'] = email2nickname(workflow_task.initiator)
        task_info = fill_task_infos_with_submitted_content([task_info], invalidate_tasks=True)[0]

        return Response({'task': task_info})


def fill_task_infos_with_submitted_content(task_infos, invalidate_tasks=True):
    """
    fill task info with submitted content

    1. add `submitted_values` `initiator_avatar_url` `state` or more to task info
    2. invalidate invalid tasks whose rows deleted, tables deleted or others if invalidate_tasks == True

    :param task_infos: list of task infos

    :return task_infos: list of filled task infos
    """
    # prepare assets
    dtable_uuid_tasks_dict = defaultdict(lambda: defaultdict(list))     # {dtable_uuid: {table_id: [task_infos...]}}
    initiator_tasks_dict = defaultdict(list)
    invalid_task_ids = []
    workflow_config_dict = {}  # {workflow_token: config in dict}
    for task_info in task_infos:
        task_info['submitted_values'] = []
        dtable_uuid = task_info['dtable_workflow']['dtable_uuid']
        workflow_token = task_info['dtable_workflow']['token']
        workflow_config = workflow_config_dict.get(workflow_token)
        if workflow_config is None:
            try:
                workflow_config = json.loads(task_info['dtable_workflow']['workflow_config'])
                workflow_config_dict[workflow_token] = workflow_config
            except:
                workflow_config_dict[workflow_token] = 'invalid'
                continue
        elif workflow_config == 'invalid':
            continue
        table_id = get_table_id_from_config(workflow_config)
        dtable_uuid_tasks_dict[dtable_uuid][table_id].append(task_info)
        initiator_tasks_dict[task_info['initiator']].append(task_info)

    has_collaborator_tasks = []  # [task_infos...]
    need_query_users = set()  # {users...}

    # get workspaces id
    dtable_uuid_workspace_id_dict = {}
    for item in DTables.objects.filter(uuid__in=list(dtable_uuid_tasks_dict.keys()), deleted=False).values('uuid', 'workspace_id'):
        dtable_uuid_workspace_id_dict[item['uuid'].hex] = item['workspace_id']

    # post sql query table by table
    # fill task info with query results
    for dtable_uuid, table_task_infos_dict in dtable_uuid_tasks_dict.items():
        if dtable_uuid not in dtable_uuid_workspace_id_dict:
            continue
        # request rows table by table
        dtable_metadata = get_metadata(dtable_uuid)
        tables_dict = {table['_id']: table for table in dtable_metadata.get('tables', [])}
        url = INNER_DTABLE_DB_URL.strip('/') + '/api/v1/query/%s/?from=dtable_web' % str(UUID(dtable_uuid))
        for table_id, table_task_infos in table_task_infos_dict.items():
            workflow_table = tables_dict.get(table_id)
            if not workflow_table:
                continue
            workflow_token = table_task_infos[0]['dtable_workflow']['token']
            workflow_config = workflow_config_dict.get(workflow_token)
            if not workflow_config or workflow_config == 'invalid':
                continue
            table_name = workflow_table.get('name')
            column_keys_dict = {}
            column_names_dict = {}
            for col in workflow_table.get('columns', []):
                column_keys_dict[col['key']] = col
                column_names_dict[col['name']] = col
            try:
                init_node_columns = get_init_node_from_config(workflow_config).get('node_form', {}).get('readwrite_columns', [])
                query_columns = ['`_id`'] + list(map(lambda col: f"`{column_keys_dict[col['key']]['name']}`", filter(lambda col: col['key'] in column_keys_dict, init_node_columns)))
                sql = 'SELECT %(query_columns)s FROM `%(table)s` WHERE _id IN (%(row_id_str)s) LIMIT %(limit)s' % {
                    'query_columns': ', '.join(query_columns),
                    'table': table_name,
                    'row_id_str': ', '.join(["'%s'" % task_info['row_id'] for task_info in table_task_infos]),
                    'limit': len(table_task_infos)
                }
                dtable_db_api = DTableDBAPI('dtable-web', dtable_uuid, INNER_DTABLE_DB_URL)
                try:
                    results = dtable_db_api.query(sql)['results']
                except Exception as e:
                    logger.exception('request dtable: %s table: %s sql: %s error: %s', dtable_uuid, table_name, sql, e)
                    for task_info in table_task_infos:
                        # mark request failed
                        task_info['flag'] = False
                    continue

                state_column_key = get_state_column_key_from_config(workflow_config)
                state_column = column_keys_dict.get(state_column_key)
                if not state_column:
                    logger.warning('dtable: %s table: %s state column: %s not exists', dtable_uuid, table_name, state_column_key)
                    continue
                if state_column.get('type') != ColumnTypes.SINGLE_SELECT:
                    logger.warning('dtable: %s table: %s state column: %s is not a single-select column, column type is %s', dtable_uuid, table_name, state_column_key, state_column.get('type'))
                    continue
                options_dict = {option['id']: option for option in state_column.get('data', {}).get('options', [])}

                # fill task info with specific submitted column-value
                for row in results:
                    for task_info in table_task_infos:
                        if row['_id'] != task_info['row_id']:
                            continue

                        # mark task row exists
                        task_info['flag'] = True

                        # fill state info
                        current_node = get_specific_node_from_config(workflow_config, task_info['node_id'])
                        if not current_node:
                            logger.warning('dtable: %s task: %s node_id: %s not found in workflow_config!', dtable_uuid, task_info['id'], task_info['node_id'])
                            continue
                        task_info['current_node'] = current_node
                        current_state_option_id = current_node['state_option_id']
                        state = task_info.pop('state', None)
                        current_state_option = options_dict.get(current_state_option_id) or gen_random_option(state)
                        task_info['state'] = {
                            'color': current_state_option.get('color'),
                            'name': current_state_option.get('name'),
                            'textColor': current_state_option.get('textColor')
                        }

                        task_info['submitted_values'] = []
                        has_collaborator = False
                        for col in init_node_columns:
                            if col['key'] in column_keys_dict:
                                if column_keys_dict[col['key']]['type'] == ColumnTypes.COLLABORATOR:
                                    has_collaborator = True
                                    for value_item in (row.get(col['key']) or []):
                                        if isinstance(value_item, str):
                                            need_query_users.add(value_item)
                                task_info['submitted_values'].append({
                                    'column_key': col['key'],
                                    'column_name': column_keys_dict[col['key']]['name'],
                                    'column_type': column_keys_dict[col['key']]['type'],
                                    'column_data': column_keys_dict[col['key']].get('data'),
                                    'value': row.get(col['key'])
                                })
                        if has_collaborator:
                            has_collaborator_tasks.append(task_info)
                        break
            except Exception as e:
                logger.exception('fill dtable: %s table: %s workflow: %s error: %s', dtable_uuid, table_id, workflow_token, e)

    # filter task_infos which does not have row value
    # TODO: task_infos after filtered, the number of all tasks incorrect, ignore this bug temporarily
    # flag:
    #   True: request successfully and row exists
    #   False: request failed
    #   None: request successfully and row not exists, task need to be set invalid
    new_task_infos = []
    task_ids = []
    task_infos_dict = {}
    for task_info in task_infos:
        flag = task_info.pop('flag', None)
        if flag is None:
            if task_info.get('is_valid', True):
                invalid_task_ids.append(task_info.get('id'))
        task_info['is_valid'] = task_info.get('is_valid', True) and flag
        task_ids.append(task_info['id'])
        task_infos_dict[task_info['id']] = task_info
        new_task_infos.append(task_info)

    task_infos = new_task_infos
    if invalidate_tasks:
        invalidate_workflow_task.send(None, task_ids=invalid_task_ids)

    # query tasks current participants
    task_participants = list(DTableWorkflowTaskParticipants.objects.filter(
        dtable_workflow_task_id__in=task_ids
    ).values_list('dtable_workflow_task_id', 'participant'))
    for task_id, participant in task_participants:
        task_info = task_infos_dict.get(task_id)
        if not task_info:
            continue
        if 'participants' not in task_info:
            task_info['participants'] = [participant]
        else:
            task_info['participants'].append(participant)
        need_query_users.add(participant)

    # query and fill collaborators
    ## query
    ## Generally, there are no performance issues here. Please query step by step if you have performance issues.
    all_profiles = Profile.objects.filter(user__in=list(need_query_users))
    ## fill
    users_dict = {}
    for profile in all_profiles:
        avatar_url = api_avatar_url(profile.user)[0]
        users_dict[profile.user] = {
            'name': profile.nickname,
            'avatar_url': avatar_url,
            'email': profile.user
        }
    ### fill collaborators in rows
    for task_info in has_collaborator_tasks:
        submitted_values = task_info.get('submitted_values')
        if not submitted_values:
            continue
        for submitted_value in submitted_values:
            if submitted_value['column_type'] != ColumnTypes.COLLABORATOR:
                continue
            value = submitted_value.pop('value', [])
            real_value = []
            for collaborator in (value or []):
                if not isinstance(collaborator, str):
                    logger.error('workflow task: %s submitted collaborator value: %s some invalid', task_info['id'], value)
                    collaborator = str(collaborator)
                if collaborator not in users_dict:
                    real_value.append({
                        'name': None,
                        'avatar_url': api_avatar_url(collaborator)[0],
                        'email': collaborator
                    })
                    continue
                real_value.append(users_dict[collaborator])
            submitted_value['value'] = real_value
    ### fill participants, workspace_id of tasks
    for task_info in task_infos:
        participants = task_info.pop('participants', [])
        task_info['participants'] = [users_dict[participant] for participant in participants if participant in users_dict]
        dtable_uuid = task_info['dtable_workflow']['dtable_uuid']
        task_info['workspace_id'] = dtable_uuid_workspace_id_dict[dtable_uuid]

    # fill user avatar
    for initiator, initiator_task_infos in initiator_tasks_dict.items():
        avatar_url = api_avatar_url(initiator)[0]
        for task_info in initiator_task_infos:
            task_info['initiator_avatar_url'] = avatar_url

    return task_infos


# ongoing workflow tasks apis
class DTableWorkflowOngoingTasksCountView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')
        if request.cloud_mode and request.user.org is None:
            return Response({'count': 0})
        queryset = DTableWorkflowTaskParticipants.objects.filter(
            participant=request.user.username,
            dtable_workflow_task__task_state=TASK_STATE_PROCESSING
        ).values(
            'dtable_workflow_task__dtable_workflow__id'
        ).annotate(
            count=Count('dtable_workflow_task__dtable_workflow__id'),
            workflow_id=F('dtable_workflow_task__dtable_workflow__id'),
            workflow_token=F('dtable_workflow_task__dtable_workflow__token'),
            workflow_config=F('dtable_workflow_task__dtable_workflow__workflow_config'),
        ).values(
            'workflow_id',
            'workflow_token',
            'count',
            'workflow_config'
        )
        result = {'count': 0}
        details = []
        for item in queryset:
            info = {}
            info['workflow_id'] = item['workflow_id']
            info['workflow_token'] = item['workflow_token']
            info['count'] = item['count']
            try:
                info['workflow_name'] = get_name_from_config(item['workflow_config'])
            except:
                continue
            details.append(info)
            result['count'] += info['count']
        result['details'] = details

        return Response(result)


class DTableWorkflowOngoingTasksView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')
        try:
            current_page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '500'))
        except ValueError:
            current_page = 1
            per_page = 500
        start = (current_page - 1) * per_page
        end = start + per_page

        if request.cloud_mode and request.user.org is None:
            return Response({
            'task_list': [],
            'count': 0,
            'has_next_page': False
        })

        queryset = DTableWorkflowTaskParticipants.objects.filter(
            participant=request.user.username,
            dtable_workflow_task__task_state=TASK_STATE_PROCESSING
        ).select_related(
            'dtable_workflow_task',
            'dtable_workflow_task__dtable_workflow'
        ).order_by('-updated_at')
        tasks = []
        updated_at_dict = {}
        for item in queryset[start: end]:
            tasks.append(item.dtable_workflow_task)
            updated_at_dict[item.dtable_workflow_task.id] = item.updated_at
        task_list = []
        # To cope with extreme situations, only the first 20 workflows are supported at most
        return_workflow_tokens = []
        max_workflow_number = 20
        # flag_tasks, sometimes duplicated participants records in db because system bug, filter them in memory
        flag_task_ids = set()
        for task in tasks:
            if task.dtable_workflow.token not in return_workflow_tokens:
                if len(return_workflow_tokens) >= max_workflow_number:
                    continue
                return_workflow_tokens.append(task.dtable_workflow.token)
            if task.id in flag_task_ids:
                continue
            task_info = task.to_dict()
            task_info['initiator_name'] = email2nickname(task.initiator)
            task_info['updated_at'] = datetime_to_isoformat_timestr(updated_at_dict[task.id])
            task_list.append(task_info)
            flag_task_ids.add(task.id)
        task_list = fill_task_infos_with_submitted_content(task_list)
        count = queryset.count()
        return Response({
            'task_list': task_list,
            'count': count,
            'has_next_page': end < count
        })


# submitted tasks api
class DTableWorkflowSubmittedTasksView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')
        try:
            current_page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '10'))
        except ValueError:
            current_page = 1
            per_page = 10
        start = (current_page - 1) * per_page
        end = start + per_page

        tasks_query = DTableWorkflowTasks.objects.filter(initiator=request.user.username)\
            .select_related('dtable_workflow').order_by('-created_at')
        tasks = list(tasks_query[start: end])
        task_list = []
        for task in tasks:
            task_info = task.to_dict()
            task_info['initiator_name'] = email2nickname(task.initiator)
            task_list.append(task_info)
        task_list = fill_task_infos_with_submitted_content(task_list)
        count = tasks_query.count()
        return Response({
            'task_list': task_list,
            'count': count,
            'has_next_page': end < count
        })


class DTableWorkflowHandledTasksView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')
        try:
            current_page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '10'))
        except ValueError:
            current_page = 1
            per_page = 10
        start = (current_page - 1) * per_page
        end = start + per_page

        username = request.user.username

        queryset = DTableWorkflowTaskLogs.objects.filter(
            operator=username
        ).exclude(
            log_type=LOG_TYPE_INIT
        ).select_related(
            'task',
            'task__dtable_workflow'
        ).order_by('created_at')

        tasks = [item.task for item in queryset[start: end]]
        task_list = []
        for task in tasks:
            task_info = task.to_dict()
            task_info['initiator_name'] = email2nickname(task.initiator)
            task_list.append(task_info)
        task_list = fill_task_infos_with_submitted_content(task_list)
        count = queryset.count()
        return Response({
            'task_list': task_list,
            'count': count,
            'has_next_page': end < count
        })


def update_workflow_config_before_save(workspace, workflow_config):
    nodes = workflow_config.get('nodes')
    if not nodes:
        return workflow_config
    for node in nodes:
        for action in node.get('actions', []):
            if action.get('type') == 'run_python_script':
                action['workspace_id'] = workspace.id
                action['owner'] = workspace.owner
                action['org_id'] = workspace.org_id
                action['repo_id'] = workspace.repo_id
    return workflow_config


class DTableWorkflowsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """
        get dtable workflows
        """
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')

        # arguments check
        workspace_id = request.GET.get('workspace_id')
        if not workspace_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'workspace_id invalid')
        table_name = request.GET.get('name')
        if not table_name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'table_name invalid')

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workspace %s not found' % workspace_id)
        dtable = DTables.objects.get_dtable(workspace, table_name)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')
        dtable_uuid = str(dtable.uuid)

        # permission check
        username = request.user.username
        if not check_dtable_permission(username, dtable.workspace, dtable):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        workflows = DTableWorkflows.objects.get_workflows_by_dtable_uuid(dtable_uuid)

        return Response({
            'workflow_list': [workflow.to_dict() for workflow in workflows]
        })

    def post(self, request):
        """
        create workflow
        """
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')

        # arguments check
        workspace_id = request.data.get('workspace_id')
        if not workspace_id:
            return api_error(status.HTTP_400_BAD_REQUEST, 'workspace_id invalid')
        table_name = request.data.get('name')
        if not table_name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'table_name invalid')
        workflow_config = request.data.get('workflow_config')
        if not workflow_config:
            return api_error(status.HTTP_400_BAD_REQUEST, 'workflow_config invalid')

        error_msg = check_workflow_config(workflow_config)
        if error_msg:
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
        workflow_config = json.loads(workflow_config)

        # resource check
        workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
        if not workspace:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workspace %s not found' % workspace_id)
        if '@seafile_group' not in workspace.owner:
            return api_error(status.HTTP_403_FORBIDDEN, 'Forbidden creating workflow in personal bases')
        dtable = DTables.objects.get_dtable(workspace, table_name)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')
        dtable_uuid = str(dtable.uuid)

        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        # get workflow table and state column
        workflow_table_id = get_table_id_from_config(workflow_config)
        state_column_key = get_state_column_key_from_config(workflow_config)
        participants_column_key = get_participants_column_key_from_config(workflow_config)

        # check whether same base same table has other workflows
        if not can_table_create_workflow(dtable_uuid, workflow_config):
            return api_error(status.HTTP_400_BAD_REQUEST, 'There is a workflow already in this table')

        workflow_table, state_column, participants_column = None, None, None
        dtable_metadata = get_metadata(dtable_uuid)

        if workflow_table_id:
            workflow_table = get_table_from_metadata(dtable_metadata, workflow_table_id)
            if not workflow_table:
                return api_error(status.HTTP_404_NOT_FOUND, 'Table not found')

        if workflow_table and participants_column_key:
            participants_column = get_column_from_table(workflow_table, participants_column_key, column_type=ColumnTypes.COLLABORATOR)
            if not participants_column:
                return api_error(status.HTTP_404_NOT_FOUND, 'Participants column %s not found or not a collaborator column' % participants_column_key)
            # set participants column permission
            if participants_column.get('permission_type') != 'none':
                update_column_permission(dtable, workflow_table, participants_column)

        if workflow_table and state_column_key:
            # check state column
            state_column = get_column_from_table(workflow_table, state_column_key, column_type=ColumnTypes.SINGLE_SELECT)
            if not state_column:
                return api_error(status.HTTP_404_NOT_FOUND, 'State column %s not found or not a single-select column' % state_column_key)
            # set state column permission
            if state_column.get('permission_type') != 'none':
                update_column_permission(dtable, workflow_table, state_column)

        # check and create state options
        workflow_nodes = workflow_config.get('nodes')
        can_cancel_task = get_can_cancel_task(workflow_config)
        if state_column and workflow_nodes:
            node_names = [node['name'] for node in workflow_nodes if node['type'] != NODE_TYPE_CANCELED or can_cancel_task]
            new_options, error_msg = create_options(dtable.uuid.hex, workflow_table['name'], state_column['name'], node_names)
            if error_msg:
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            options_dict = {}
            if new_options:
                options_dict.update({option['name']: option for option in new_options})
            for index in range(len(workflow_nodes)):
                node = workflow_nodes[index]
                if node['name'] in options_dict:
                    node['state_option_id'] = options_dict[node['name']]['id']

        try:
            workflow_config = update_workflow_config_before_save(dtable.workspace, workflow_config)
            # the length of workflow_config has changed, need to check
            error_msg = check_workflow_config(workflow_config)
            if error_msg:
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            workflow = DTableWorkflows.objects.add_workflow(dtable_uuid, json.dumps(workflow_config), username, dtable.workspace.owner)
        except Exception as e:
            logger.error('create workflow error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'workflow': workflow.to_dict()})


class DTableWorkflowView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, token):
        """
        get specific workflow
        """
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')

        # resource check
        workflow = DTableWorkflows.objects.get_workflow_by_token(token)
        if not workflow:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workflow not found')
        dtable = DTables.objects.get_dtable_by_uuid(workflow.dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        # permission check
        username = request.user.username
        if not check_dtable_permission(username, dtable.workspace, dtable):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        return Response({'workflow': workflow.to_dict()})

    def put(self, request, token):
        """
        update specific workflow
        """
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')

        workflow_name = request.data.get('workflow_name')
        can_any_user_submit_via_link = request.data.get('can_any_user_submit_via_link')
        icon = request.data.get('icon')
        color = request.data.get('color')

        workflow_config = request.data.get('workflow_config')

        if workflow_config:
            error_msg = check_workflow_config(workflow_config)
            if error_msg:
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            workflow_config = json.loads(workflow_config)

        # resource check
        workflow = DTableWorkflows.objects.get_workflow_by_token(token)
        if not workflow:
            return api_error(status.HTTP_404_NOT_FOUND, _('Workflow not found'))
        dtable = DTables.objects.get_dtable_by_uuid(workflow.dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, _('Base not found'))

        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, dtable.workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        if not workflow_config and (workflow_name or can_any_user_submit_via_link or icon or color):
            new_workflow_config = json.loads(workflow.workflow_config)
            if workflow_name:
                new_workflow_config['workflow_name'] = workflow_name
            if can_any_user_submit_via_link:
                new_workflow_config['can_any_user_submit_via_link'] = to_python_boolean(can_any_user_submit_via_link)
            if icon:
                new_workflow_config['icon'] = icon
            if color:
                new_workflow_config['color'] = color
            try:
                error_msg = check_workflow_config(new_workflow_config)
                if error_msg:
                    return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
                workflow.workflow_config = json.dumps(new_workflow_config)
                workflow.save()
            except Exception as e:
                logger.error('update workflow name or icon error: %s', e)
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            return Response({'workflow': workflow.to_dict()})
        elif workflow_config and (workflow_name or can_any_user_submit_via_link or icon or color):
            if workflow_name:
                workflow_config['workflow_name'] = workflow_name
            if can_any_user_submit_via_link:
                workflow_config['can_any_user_submit_via_link'] = to_python_boolean(can_any_user_submit_via_link)
            if icon:
                workflow_config['icon'] = icon
            if color:
                workflow_config['color'] = color
        elif not workflow_config and not (workflow_name or can_any_user_submit_via_link or icon or color):
            return Response({'workflow': workflow.to_dict()})

        old_workflow_config = json.loads(workflow.workflow_config)
        old_table_id = get_table_id_from_config(old_workflow_config)
        old_state_column_key = get_state_column_key_from_config(old_workflow_config)
        old_participants_column_key = get_participants_column_key_from_config(old_workflow_config)
        old_nodes = get_nodes_from_config(old_workflow_config)
        old_nodes_dict = {node['_id']: node for node in old_nodes} if old_nodes else {}

        new_table_id = get_table_id_from_config(workflow_config)
        new_state_column_key = get_state_column_key_from_config(workflow_config)
        new_participants_column_key = get_participants_column_key_from_config(workflow_config)
        new_nodes = get_nodes_from_config(workflow_config)
        new_nodes_dict = {node['_id']: node for node in new_nodes} if new_nodes else {}

        dtable_metadata = get_metadata(dtable.uuid.hex)
        new_workflow_table = get_table_from_metadata(dtable_metadata, new_table_id)
        new_state_column = get_column_from_table(new_workflow_table, new_state_column_key, column_type=ColumnTypes.SINGLE_SELECT)
        new_participants_column = get_column_from_table(new_workflow_table, new_participants_column_key, column_type=ColumnTypes.COLLABORATOR)

        # create the relation between workflow and table
        if not old_table_id:
            if not can_table_create_workflow(dtable.uuid, workflow_config):
                return api_error(status.HTTP_400_BAD_REQUEST, _('There is a workflow already in this table'))
            if not new_workflow_table:
                return api_error(status.HTTP_404_NOT_FOUND, _('Table not found'))
            if not new_state_column:
                return api_error(status.HTTP_404_NOT_FOUND, _('State column not found or is not a single-select column'))
            if new_participants_column_key and not new_participants_column:
                return api_error(status.HTTP_404_NOT_FOUND, _('Assignee column not found or is not a collaborator column'))
            # create state column options
            new_node_names = [node['name'] for node in new_nodes] if new_nodes else []
            new_options, error_msg = create_options(dtable.uuid.hex, new_workflow_table['name'], new_state_column['name'], new_node_names)
            if error_msg:
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, _('Internal Server Error'))
            options_dict = {}
            if new_options:
                options_dict.update({option['name']: option for option in new_options})
            for index in range(len(new_nodes)):
                node = new_nodes[index]
                if node['name'] not in options_dict:
                    continue
                node['state_option_id'] = options_dict[node['name']]['id']
            workflow_config['nodes'] = new_nodes
            # update state column permission
            if new_state_column.get('permission_type') != 'none':
                update_column_permission(dtable, new_workflow_table, new_state_column)
            # update participant column permission
            if new_participants_column and new_participants_column.get('type') != 'none':
                update_column_permission(dtable, new_workflow_table, new_participants_column)
        # forbidden
        elif old_table_id != new_table_id or old_state_column_key != new_state_column_key:
            return api_error(status.HTTP_403_FORBIDDEN, _('Forbidden to change workflow table and state column'))
        # update the workflow table columns...
        else:
            if not new_workflow_table:
                return api_error(status.HTTP_404_NOT_FOUND, _('Table not found'))
            if not new_state_column:
                return api_error(status.HTTP_404_NOT_FOUND, _('State column not found or is not a single-select column'))
            if old_participants_column_key and old_participants_column_key != new_participants_column_key:
                return api_error(status.HTTP_403_FORBIDDEN, _('Forbidden to change assignee column'))
            if new_participants_column_key and not new_participants_column:
                return api_error(status.HTTP_404_NOT_FOUND, _('Assignee column not found or is not a collaborator column'))
            # delete create update options
            to_be_deleted_nodes, to_be_appended_nodes, to_be_updated_nodes = [], [], []
            persistent_nodes = []
            for node in old_nodes:
                if node['_id'] in new_nodes_dict:
                    ## if node name changed, update
                    if new_nodes_dict[node['_id']]['name'] != node['name']:
                        ### if has option id, update
                        if node.get('state_option_id'):
                            to_be_updated_nodes.append({
                                '_id': node['_id'],
                                'old_name': node['name'],
                                'new_name': new_nodes_dict[node['_id']]['name'],
                                'state_option_id': node['state_option_id']
                            })
                        ### if no option id, create
                        else:
                            to_be_appended_nodes.append({
                                '_id': node['_id'],
                                'name': new_nodes_dict[node['_id']]['name']
                            })
                    ## if node name no changed, keep
                    else:
                        ### if has option id, keep
                        if node.get('state_option_id'):
                            persistent_nodes.append({
                                '_id': node['_id'],
                                'name': node['name'],
                                'state_option_id': node['state_option_id']
                            })
                        ### if no option id, create
                        else:
                            to_be_appended_nodes.append({
                                '_id': node['_id'],
                                'name': node['name']
                            })
                else:
                    if node.get('state_option_id'):
                        if node.get('type') == NODE_TYPE_CANCELED:
                            persistent_nodes.append({
                                '_id': node['_id'],
                                'name': node['name'],
                                'state_option_id': node['state_option_id']
                            })
                            continue
                        to_be_deleted_nodes.append({
                            '_id': node['_id'],
                            'state_option_id': node.get('state_option_id'),
                            'name': node['name']
                        })
            for node in new_nodes:
                if node['_id'] not in old_nodes_dict:
                    to_be_appended_nodes.append({
                        '_id': node['_id'],
                        'name': node['name']
                    })
            ## delete options
            tmp_option_ids = [node.get('state_option_id') for node in to_be_deleted_nodes if node.get('state_option_id')]
            remove_options_by_ids(dtable.uuid.hex, new_workflow_table['name'], new_state_column['name'], tmp_option_ids)
            ## create options
            new_options, error_msg = create_options(dtable.uuid.hex, new_workflow_table['name'], new_state_column['name'], [node['name'] for node in to_be_appended_nodes])
            if error_msg:
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            ## update options
            updated_options, error_msg = update_options(dtable.uuid.hex, new_workflow_table['name'], new_state_column['name'], [{'id': node['state_option_id'], 'name': node['new_name']} for node in to_be_updated_nodes])
            if error_msg:
                return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')
            # update nodes
            options_dict = {node['name']: node['state_option_id'] for node in persistent_nodes}
            if new_options:
                options_dict.update({option['name']: option['id'] for option in new_options})
            if updated_options:
                options_dict.update({option['name']: option['id'] for option in updated_options})
            new_nodes = [new_nodes_dict[tmp_node['_id']] for tmp_node in persistent_nodes + to_be_updated_nodes + to_be_appended_nodes if tmp_node['_id'] in new_nodes_dict]
            for index in range(len(new_nodes)):
                node = new_nodes[index]
                if node['name'] not in options_dict:
                    continue
                node['state_option_id'] = options_dict[node['name']]
            workflow_config['nodes'] = new_nodes
            # update state column permission
            if new_state_column.get('permission_type') != 'none':
                update_column_permission(dtable, new_workflow_table, new_state_column)
            # update participant column permission
            if new_participants_column and new_participants_column.get('type') != 'none':
                update_column_permission(dtable, new_workflow_table, new_participants_column)

        try:
            # save workflow
            workflow_config = update_workflow_config_before_save(dtable.workspace, workflow_config)
            # the length of workflow_config has changed, need to check
            error_msg = check_workflow_config(workflow_config)
            if error_msg:
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)
            workflow.workflow_config = json.dumps(workflow_config)
            workflow.save()
        except Exception as e:
            logger.error('update workflow error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'workflow': workflow.to_dict()})

    def delete(self, request, token):
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')

        # resource check
        workflow = DTableWorkflows.objects.get_workflow_by_token(token)
        if not workflow:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workflow not found')
        dtable = DTables.objects.get_dtable_by_uuid(workflow.dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, dtable.workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        # update state column back
        try:
            workflow_config = json.loads(workflow.workflow_config)
        except:
            pass
        else:
            try:
                table_id = get_table_id_from_config(workflow_config)
                state_column_key = get_state_column_key_from_config(workflow_config)
                participants_column_key = get_participants_column_key_from_config(workflow_config)
                metadata = get_metadata(dtable.uuid.hex)
                if table_id and state_column_key:
                    target_table = get_table_from_metadata(metadata, table_id)
                    state_column = get_column_from_table(target_table, state_column_key, column_type=ColumnTypes.SINGLE_SELECT)
                    participants_column = get_column_from_table(target_table, participants_column_key, column_type=ColumnTypes.COLLABORATOR)
                    if state_column:
                        update_column_permission(dtable, target_table, state_column, permission_type='')
                    if participants_column:
                        update_column_permission(dtable, target_table, participants_column, permission_type='')
            except Exception as e:
                logger.exception(e)
                logger.error('unlock state/participants column permission back error: %s', e)

        try:
            workflow.delete()

        except Exception as e:
            logger.error('delete workflow error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})


class DTableWorkflowTasksView(APIView):
    """
    tasks of a workflow
    """
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, token):
        """
        list tasks of a workflow
        support query `all`, `initiated`, `handled` tasks by query param `filter_type`
        """
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')
        try:
            current_page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '10'))
        except ValueError:
            current_page = 1
            per_page = 10
        start = (current_page - 1) * per_page
        end = start + per_page

        filter_type = request.GET.get('filter_type', 'initiated')
        if filter_type not in ['all', 'initiated', 'ongoing']:
            return api_error(status.HTTP_400_BAD_REQUEST, 'filter_type invalid')

        workflow = DTableWorkflows.objects.get_workflow_by_token(token)
        if not workflow:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workflow not found')
        dtable = DTables.objects.get_dtable_by_uuid(workflow.dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        if '@seafile_group' not in dtable.workspace.owner:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        username = request.user.username
        org_id = -1
        if is_org_context(request):
            org_id = request.user.org.org_id

        group_id = int(dtable.workspace.owner.split('@')[0])
        if not can_submit_workflow_task(workflow, request.user):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        is_admin = is_group_admin_or_owner(group_id, username)

        tasks, count = [], 0

        # permission check
        if filter_type == 'all':
            if not is_admin:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
            queryset = DTableWorkflowTasks.objects.get_tasks_by_token(token)
            tasks = [task for task in queryset[start: end]]
            count = queryset.count()
        elif filter_type == 'initiated':
            queryset = DTableWorkflowTasks.objects.get_tasks_by_token_initiator(token, username)
            tasks = [task for task in queryset[start: end]]
            count = queryset.count()
        elif filter_type == 'ongoing':
            if not is_admin:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
            queryset = DTableWorkflowTasks.objects.get_tasks_by_token_state(token, TASK_STATE_PROCESSING)
            tasks = [task for task in queryset[start: end]]
            count = queryset.count()
        else:
            return api_error(status, 'filter_type invalid')

        task_list = []
        for task in tasks:
            task_info = task.to_dict()
            task_info['initiator_name'] = email2nickname(task.initiator)
            task_list.append(task_info)
        task_list = fill_task_infos_with_submitted_content(task_list)
        return Response({
            'task_list': task_list,
            'count': count,
            'has_next_page': end < count
        })


class DTableWorkflowTaskView(APIView):
    """
    task of a workflow
    """
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def delete(self, request, token, task_id):
        """
        delete a task
        """
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')

        workflow = DTableWorkflows.objects.get_workflow_by_token(token)
        if not workflow:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workflow not found')
        dtable = DTables.objects.get_dtable_by_uuid(workflow.dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        if '@seafile_group' not in dtable.workspace.owner:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        username = request.user.username
        org_id = -1
        if is_org_context(request):
            org_id = request.user.org.org_id

        group_id = int(dtable.workspace.owner.split('@')[0])
        is_admin = is_group_admin_or_owner(group_id, username)

        if not is_admin:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        task = DTableWorkflowTasks.objects.get_task_by_token_id(token, task_id)
        if not task:
            return api_error(status.HTTP_404_NOT_FOUND, 'Task not found')

        row_id = task.row_id
        url = dtable_server_url.strip('/') + '/api/v1/dtables/%s/rows/?from=dtable_web' % str(dtable.uuid)
        try:
            dtable_metadata = get_metadata(dtable.uuid.hex)
            workflow_config = json.loads(workflow.workflow_config)
            table_id = get_table_id_from_config(workflow_config)
            target_table = get_table_from_metadata(dtable_metadata, table_id)
            if not target_table:
                logger.warning('delete task: %s table: %s not found', task_id, table_id)
            else:
                dtable_server_api = DTableServerAPI(username, str(dtable.uuid), dtable_server_url)
                dtable_server_api.delete_row(target_table['name'], row_id)
        except Exception as e:
            logger.exception(e)
            logger.error('delete task: %s, row: %s error: %s', task_id, row_id, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        try:
            task.delete()
        except Exception as e:
            logger.error('delete workflow task: %s error: %s', task_id, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})


def _task_resources_check(token, task_id):
    """
    check task/workflow/dtable resources

    return: {task, dtable, error}
    """
    task = DTableWorkflowTasks.objects.get_task_by_token_id(token, task_id)
    if not task:
        return {'error': api_error(status.HTTP_404_NOT_FOUND, 'Task not found')}
    if not task.is_valid:
        return {'error': api_error(status.HTTP_400_BAD_REQUEST, 'Task invalid')}
    error_msg = check_workflow_config(task.dtable_workflow.workflow_config)
    if error_msg:
        return {'error': api_error(status.HTTP_400_BAD_REQUEST, 'Workflow not set completed or invalid')}
    dtable = DTables.objects.get_dtable_by_uuid(task.dtable_workflow.dtable_uuid, include_deleted=False)
    if not dtable:
        return {'error': api_error(status.HTTP_404_NOT_FOUND, 'Base not found')}

    return {
        'task': task,
        'dtable': dtable,
        'error': None
    }


def _request_task_row(task, dtable, username, workflow_config):
    """
    request task row

    :return {row, error}
    """
    # request row
    dtable_metadata = get_metadata(dtable.uuid.hex)
    table_id = get_table_id_from_config(workflow_config)
    state_column_key = get_state_column_key_from_config(workflow_config)
    workflow_table, state_column = get_table_and_column_from_metadata(dtable_metadata, table_id, state_column_key, column_type=ColumnTypes.SINGLE_SELECT)
    if not workflow_table or not state_column:
        return {'error': api_error(status.HTTP_404_NOT_FOUND, 'Table or state column not found')}
    current_node = get_specific_node_from_config(workflow_config, task.node_id)
    if not current_node:
        return {'error': api_error(status.HTTP_400_BAD_REQUEST, 'The node of this task invalid')}

    # The reason why use sql instead of the api of fetching a row is, frontend prefer {column_key: value} format
    # If there are still bugs, please improve it.
    sql = "SELECT * FROM `%(table)s` WHERE _id='%(row_id)s'" % {
        'table': workflow_table['name'],
        'row_id': task.row_id
    }
    dtable_db_api = DTableDBAPI('workflow', str(dtable.uuid), INNER_DTABLE_DB_URL)
    try:
        results = dtable_db_api.query(sql)['results']
    except Exception as e:
        logger.exception('query dtable: %s table: %s sql: %s error: %s', dtable.uuid, workflow_table['name'], sql, e)
        return {'error': api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')}
    if not results:
        return {'error': api_error(status.HTTP_404_NOT_FOUND, 'Row has been deleted')}
    row = results[0]
    nodes = get_nodes_from_config(workflow_config)
    init_node = get_init_node_from_config(workflow_config)

    state_column_key = get_state_column_key_from_config(workflow_config)
    state_column = None
    for col in workflow_table['columns']:
        if col['key'] == state_column_key and col['type'] == ColumnTypes.SINGLE_SELECT:
            state_column = col
            break
    if not state_column:
        return api_error(status.HTTP_404_NOT_FOUND, 'State column %s not found or not a single-select column' % state_column_key)
    state = None
    for option in state_column.get('data', {}).get('options', []):
        if option['id'] == current_node['state_option_id']:
            state = option
            break
    if not state:
        state = gen_random_option(str(task.to_dict().get('state')))

    # fill workflow form link columns
    workflow_columns_dict = {col['key']: col for col in workflow_table['columns']}
    for key, value in row.items():
        column = workflow_columns_dict.get(key)
        if not column:
            continue
        if column['type'] != ColumnTypes.LINK:
            continue
        row_ids = [linked_row['row_id'] for linked_row in value] if value else []
        if not row_ids:
            continue
        row[key] = []
        linked_table_id = column['data']['table_id'] if column['data']['other_table_id'] == table_id else column['data']['other_table_id']
        linked_table = get_table_from_metadata(dtable_metadata, linked_table_id)
        sql = "SELECT * FROM `%s` WHERE _id IN (%s) LIMIT %s" % (
            linked_table['name'],
            ', '.join(["'%s'" % row_id for row_id in row_ids]),
            len(row_ids)
        )
        dtable_db_api = DTableDBAPI('dtable-web', str(dtable.uuid), INNER_DTABLE_DB_URL)
        try:
            linked_rows = dtable_db_api.query(sql)['results']
        except Exception as e:
            logger.exception('query dtable: %s table: %s sql: %s error: %s', dtable.uuid, linked_table['name'], sql, e)
            continue
        row[key] = linked_rows

    return {
        'row': row,
        'current_node': current_node,
        'workflow_table': workflow_table,
        'nodes': nodes,
        'init_node': init_node,
        'state': state,
        'tables': dtable_metadata['tables']
    }


class DTableWorkflowTaskParticipantView(APIView):
    """
    task of participant view
    """
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, token, task_id):
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')

        username = request.user.username

        # resource check
        resources = _task_resources_check(token, task_id)
        if resources.get('error'):
            return resources['error']
        task = resources.get('task')
        if task.task_state == TASK_STATE_CANCELED:
            return api_error(status.HTTP_403_FORBIDDEN, 'Workflow task has been canceled')
        dtable = resources.get('dtable')
        workflow_config = json.loads(task.dtable_workflow.workflow_config)

        # permission check
        if not DTableWorkflowTaskParticipants.objects.can_transfer(task, username):
            return api_error(status.HTTP_403_FORBIDDEN, _('Permission denied or you have operated'))

        task_row_info = _request_task_row(task, dtable, username, workflow_config)
        if task_row_info.get('error'):
            return task_row_info['error']
        row = task_row_info['row']
        workflow_table = task_row_info['workflow_table']
        current_node = task_row_info['current_node']
        nodes = task_row_info['nodes']
        state = task_row_info['state']
        tables = task_row_info['tables']

        # gen return info
        # checkout readonly cells within value in row and checkout transfer form columns
        state_column_key = get_state_column_key_from_config(workflow_config)
        participants_column_key = get_participants_column_key_from_config(workflow_config)
        readonly_columns, readwrite_columns, return_column_keys = [], [], set()
        dynamic_participants_column_keys = set(get_dynamic_participants_column_keys(workflow_config))
        columns_dict = {col.get('key'): col for col in workflow_table['columns']}
        if current_node:
            node_readonly_columns = current_node.get('node_form', {}).get('readonly_columns', [])
            node_readwrite_columns = current_node.get('node_form', {}).get('readwrite_columns', [])
            for col in node_readonly_columns:
                if col['key'] not in columns_dict:
                    logger.warning('task: %s, col: %s not found in base table', task.id, col['key'])
                    continue
                if col['key'] in [state_column_key, participants_column_key]:
                    continue
                tmp_column = deepcopy(columns_dict[col['key']])
                tmp_column.update(col)
                tmp_column['is_dynamic_participants_column'] = tmp_column['key'] in dynamic_participants_column_keys and tmp_column['type'] == ColumnTypes.COLLABORATOR
                readonly_columns.append(tmp_column)
                return_column_keys.add(col['key'])
            for col in node_readwrite_columns:
                if col['key'] not in columns_dict:
                    logger.warning('task: %s, col: %s not found in base table', task.id, col['key'])
                    continue
                if col['key'] in [state_column_key, participants_column_key]:
                    continue
                tmp_column = deepcopy(columns_dict[col['key']])
                tmp_column.update(col)
                tmp_column['is_dynamic_participants_column'] = tmp_column['key'] in dynamic_participants_column_keys and tmp_column['type'] == ColumnTypes.COLLABORATOR
                readwrite_columns.append(tmp_column)
                return_column_keys.add(col['key'])

        row = {key: row.get(key) for key in return_column_keys}
        if '_id' in task_row_info['row']:
            row['_id'] = task_row_info['row']['_id']
        the_other_nodes = get_the_other_nodes_from_config(current_node, workflow_config)
        columns_config = get_column_config_from_config(workflow_config)


        return Response({
            'table': workflow_table,
            'tables': tables,
            'row': row,
            'readonly_columns': readonly_columns,
            'readwrite_columns': readwrite_columns,
            'nodes': nodes,
            'current_node': current_node,
            'workspace_id': dtable.workspace_id,
            'dtable_name': dtable.name,
            'the_other_nodes': the_other_nodes,
            "columns_config": columns_config,
            'state': state
        })


class DTableWorkflowTaskInitiatorView(APIView):
    """
    task of initiator view
    """
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, token, task_id):
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')

        username = request.user.username

        # resource check
        resources = _task_resources_check(token, task_id)
        if resources.get('error'):
            return resources['error']
        task = resources.get('task')
        dtable = resources.get('dtable')
        workflow_config = json.loads(task.dtable_workflow.workflow_config)

        # permission check
        if task.initiator != username:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        # request row
        task_row_info = _request_task_row(task, dtable, username, workflow_config)
        if task_row_info.get('error'):
            return task_row_info['error']
        row = task_row_info['row']
        workflow_table = task_row_info['workflow_table']
        current_node = task_row_info['current_node']
        nodes = task_row_info['nodes']
        state = task_row_info['state']
        columns_dict = {col.get('key'): col for col in workflow_table['columns']}
        tables = task_row_info['tables']

        node_columns, show_columns, show_column_keys = [], [], set()
        state_column_key = get_state_column_key_from_config(workflow_config)
        participants_column_key = get_participants_column_key_from_config(workflow_config)

        # finish node form
        if task.task_state == TASK_STATE_FINISHED:
            finish_node = get_finish_node_from_config(workflow_config)
            node_form = finish_node.get('node_form')
            if node_form:
                node_columns = node_form.get('readonly_columns', [])
        else:
            # gen return info
            init_node = task_row_info['init_node']
            node_form = init_node['node_form']
            node_columns = node_form.get('readwrite_columns', [])

        for col in node_columns:
            if col['key'] not in columns_dict:
                logger.warning('task: %s, col: %s not found in base table', task.id, col['key'])
                continue
            if col['key'] in [state_column_key, participants_column_key]:
                    continue
            show_columns.append(col)
            show_column_keys.add(col['key'])
        
        row = {key: row.get(key) for key in show_column_keys}
        if '_id' in task_row_info['row']:
            row['_id'] = task_row_info['row']['_id']
        columns_config = get_column_config_from_config(workflow_config)

        return Response({
            'table': workflow_table,
            'tables': tables,
            'row': row,
            'show_columns': show_columns,
            'nodes': nodes,
            'current_node': current_node,
            'workspace_id': dtable.workspace_id,
            'dtable_name': dtable.name,
            'columns_config': columns_config,
            'state': state
        })


class DTableWorkflowTaskAdminView(APIView):
    """
    task of admin view
    """
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, token, task_id):
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')

        username = request.user.username

        # resource check
        resources = _task_resources_check(token, task_id)
        if resources.get('error'):
            return resources['error']
        task = resources.get('task')
        dtable = resources.get('dtable')
        workflow_config = json.loads(task.dtable_workflow.workflow_config)

        # permission check
        try:
            group_id = int(task.dtable_workflow.owner.split('@')[0])
        except:
            logger.warning('workflow: %s owner: %s invalid', task.dtable_workflow.id, task.dtable_workflow.owner)
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        if not is_group_admin_or_owner(group_id, username):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        # request row
        task_row_info = _request_task_row(task, dtable, username, workflow_config)
        if task_row_info.get('error'):
            return task_row_info['error']
        row = task_row_info['row']
        workflow_table = task_row_info['workflow_table']
        current_node = task_row_info['current_node']
        nodes = task_row_info['nodes']
        state = task_row_info['state']
        tables = task_row_info['tables']
        columns_dict = {col.get('key'): col for col in workflow_table['columns']}
        node_columns, show_columns, show_column_keys = [], [], set()
        state_column_key = get_state_column_key_from_config(workflow_config)
        participants_column_key = get_participants_column_key_from_config(workflow_config)

        # finish node form
        if task.task_state == TASK_STATE_FINISHED:
            finish_node = get_finish_node_from_config(workflow_config)
            node_form = finish_node.get('node_form')
            if node_form:
                node_columns = node_form.get('readonly_columns', [])
        else:
            # gen return info
            init_node = task_row_info['init_node']
            node_form = init_node['node_form']
            node_columns = node_form.get('readwrite_columns', [])

        for col in node_columns:
            if col['key'] not in columns_dict:
                logger.warning('task: %s, col: %s not found in base table', task.id, col['key'])
                continue
            if col['key'] in [state_column_key, participants_column_key]:
                    continue
            show_columns.append(col)
            show_column_keys.add(col['key'])
        
        row = {key: row.get(key) for key in show_column_keys}
        if '_id' in task_row_info['row']:
            row['_id'] = task_row_info['row']['_id']
        columns_config = get_column_config_from_config(workflow_config)

        return Response({
            'table': workflow_table,
            'tables': tables,
            'row': row,
            'show_columns': show_columns,
            'nodes': nodes,
            'current_node': current_node,
            'workspace_id': dtable.workspace_id,
            'dtable_name': dtable.name,
            'columns_config': columns_config,
            'state': state
        })


class DTableWorkflowPublicUploadLinkView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, token):
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')

        # resource check
        workflow = DTableWorkflows.objects.get_workflow_by_token(token)
        if not workflow:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workflow not found')
        dtable = DTables.objects.get_dtable_by_uuid(workflow.dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, workflow.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        # quota and rows check
        if not check_quota_by_workspace(dtable.workspace):
            error_msg = 'Asset quota exceeded'
            return api_error(HTTP_443_ABOVE_QUOTA, error_msg)
        if not check_row_limit_by_workspace(dtable.workspace):
            error_msg = 'Rows exceeded'
            return api_error(HTTP_443_ABOVE_QUOTA, error_msg)

        parent_dir = os.path.join('/asset', str(dtable.uuid), PUBLIC_RELATIVE_PATH)

        try:
            public_upload_link = generate_upload_link(parent_dir, dtable)
        except Exception as e:
            logger.error('generate upload link error: %s, parent_dir: %s', e, parent_dir)

        return Response({
            'parent_path': parent_dir,
            'upload_link': public_upload_link
        })


class DTableWorkflowUploadLinkView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, token):
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')

        upload_type = request.GET.get('upload_type', 'file')
        task_id = request.GET.get('task_id')
        # resource check
        workflow = DTableWorkflows.objects.get_workflow_by_token(token)
        if not workflow:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workflow not found')
        dtable = DTables.objects.get_dtable_by_uuid(workflow.dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')
        workflow_task = None
        if task_id:
            workflow_task = DTableWorkflowTasks.objects.get_task_by_token_id(token, task_id)
            if not workflow_task:
                return api_error(status.HTTP_404_NOT_FOUND, 'Workflow task not found')

        # permission check
        # can submit or can transfer
        can_upload = can_submit_workflow_task(workflow, request.user)
        if not can_upload and workflow_task:
            can_upload = DTableWorkflowTaskParticipants.objects.can_transfer(workflow_task, request.user.username)
        if not can_upload:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        # quota and rows check
        if not check_quota_by_workspace(dtable.workspace):
            error_msg = 'Asset quota exceeded'
            return api_error(HTTP_443_ABOVE_QUOTA, error_msg)
        if not check_row_limit_by_workspace(dtable.workspace):
            error_msg = 'Rows exceeded'
            return api_error(HTTP_443_ABOVE_QUOTA, error_msg)

        if upload_type == 'image':
            parent_dir = os.path.join('/asset', str(dtable.uuid), PUBLIC_FORMS_RELATIVE_PATH)
        else:
            parent_dir = os.path.join('/asset', str(dtable.uuid), UPLOAD_FILE_RELATIVE_PATH, str(date.today())[:7])

        try:
            upload_link = generate_upload_link(parent_dir, dtable)
        except Exception as e:
            logger.error('generate upload link error: %s, parent_dir: %s', e, parent_dir)

        return Response({
            'parent_path': parent_dir,
            'upload_link': upload_link
        })


class DTableWorkflowSharesView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, token):
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')

        # resource check
        workflow = DTableWorkflows.objects.get_workflow_by_token(token)
        if not workflow:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workflow not found')
        dtable = DTables.objects.get_dtable_by_uuid(workflow.dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        # permission check
        if not check_dtable_admin_permission(request.user.username, dtable.workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        shares = list(DTableWorkflowShare.objects.get_shares_by_workflow(workflow))
        group_ids = [share.group_id for share in shares]
        group_info_dict = get_groups_info(group_ids)

        return_shares = []
        for share in shares:
            if share.group_id not in group_info_dict:
                continue
            return_shares.append({
                'group_id': share.group_id,
                'group_name': group_info_dict.get(share.group_id).get('group_name')
            })

        return Response({
            'share_list': return_shares
        })

    def post(self, request, token):
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')

        # arguments check
        group_id_list = request.data.getlist('group_id')
        if not group_id_list:
            return api_error(status.HTTP_400_BAD_REQUEST, 'group_id invalid')
        try:
            group_id_list = [int(group_id) for group_id in group_id_list]
        except:
            return api_error(status.HTTP_400_BAD_REQUEST, 'group_id invalid')

        # resource check
        workflow = DTableWorkflows.objects.get_workflow_by_token(token)
        if not workflow:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workflow not found')
        dtable = DTables.objects.get_dtable_by_uuid(workflow.dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        # permission check
        username = request.user.username
        if not check_dtable_admin_permission(username, dtable.workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        all_groups = get_user_groups(username)
        all_group_ids = [group.id for group in all_groups] if all_groups else []
        group_id_list = [group_id for group_id in group_id_list if group_id in all_group_ids]

        group_info_dict = get_groups_info(group_id_list, username)

        success_list = []
        failed_list = []
        for group_id in group_id_list:
            if not group_info_dict.get(group_id):
                failed_list.append({
                    'failed_group_id': group_id,
                    'error_msg': 'group %s not found.' % group_id
                })
                continue
            try:
                if DTableWorkflowShare.objects.has_shared_to_group(workflow, group_id):
                    failed_list.append({
                        'failed_group_id': group_id,
                        'error_msg': _('group %s has been shared') % group_id
                    })
                    continue
                DTableWorkflowShare.objects.create(
                    dtable_workflow=workflow,
                    group_id=group_id,
                    created_by=username
                )
                success_list.append({
                    'group_id': group_id,
                    'group_info': group_info_dict[group_id]
                })
            except Exception as e:
                logger.error('share workflow: %s to group: %s error: %s', workflow.pk, group_id, e)
                failed_list.append({
                    'failed_group_id': group_id,
                    'error_msg': 'share to group %s failed' % group_id
                })

        return Response({
            'success_list': success_list,
            'failed_list': failed_list
        })


class DTableWorkflowShareView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def delete(self, request, token, group_id):
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')

        # resource check
        workflow = DTableWorkflows.objects.get_workflow_by_token(token)
        if not workflow:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workflow not found')
        dtable = DTables.objects.get_dtable_by_uuid(workflow.dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        # permission check
        if not check_dtable_admin_permission(request.user.username, dtable.workspace.owner):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        try:
            DTableWorkflowShare.objects.filter(dtable_workflow=workflow, group_id=group_id).delete()
            
        except Exception as e:
            logger.error('delete workflow: %s error: %s', token ,e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})


class SharedDTableWorkflowsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        """
        list all workflows user can access and not in folders
        1. workflows user can manage
        2. workflows user can use
        3. workflow-folders
        """
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')

        username = request.user.username
        groups = get_user_groups(username)
        if not groups:
            return Response({
                'workflow_list': []
            })

        admin_group_ids = set(group_get_user_admin_group_ids(username))
        groups_dict = {group.id: group for group in groups}

        my_managed_workflows = []
        can_use_workflows = []
        workflow_id_set = set()
        admin_workflow_id_set = set()
        non_admin_workflow_id_set = set()
        dtable_uuid_set = set()
        other_group_ids = []
        workflow_folders = []


        workflow_ids_in_folder = []

        workflow_folder_ids = []
        # workflow folders of current user
        workflow_folders_qset =WorkflowFolders.objects.filter(username=username)
        for workflow_folder in workflow_folders_qset:
            workflow_folder_info = workflow_folder.to_dict()
            workflow_folders.append(workflow_folder_info)
            workflow_folder_ids.append(workflow_folder.id)

        workflow_folder_items = WorkflowFolderItems.objects.filter(folder_id__in=workflow_folder_ids)
        for wfi in workflow_folder_items:
            workflow_ids_in_folder.append(wfi.workflow_id)


        # workflow_ids in folder excluded

        # groups workflows that are not in a folder
        workflows = list(DTableWorkflows.objects.get_workflows_by_group_ids(list(groups_dict.keys())).exclude(pk__in=workflow_ids_in_folder))
        for workflow in workflows:
            workflow_info = workflow.to_dict()
            group_id = int(workflow.owner.split('@')[0])

            workflow_id_set.add(workflow_info['id'])
            dtable_uuid_set.add(workflow_info['dtable_uuid'])

            workflow_info['group_id'] = group_id
            workflow_info['group_name'] = groups_dict[group_id].group_name
            workflow_info['group_owner'] = groups_dict[group_id].creator_name
            workflow_info['is_shared'] = False
            is_workflow_admin = group_id in admin_group_ids
            if is_workflow_admin:
                workflow_info['is_admin'] = is_workflow_admin
                my_managed_workflows.append(workflow_info)
                admin_workflow_id_set.add(workflow_info['id'])
            else:
                workflow_info['is_admin'] = is_workflow_admin
                can_use_workflows.append(workflow_info)
                non_admin_workflow_id_set.add(workflow_info['id'])

        # shared workflows that are not in a folder
        wf_shares = DTableWorkflowShare.objects.list_by_group_ids(list(groups_dict.keys())).exclude(dtable_workflow_id__in=workflow_ids_in_folder)
        for wf_share in wf_shares:
            workflow = wf_share.dtable_workflow
            workflow_info = workflow.to_dict()
            if workflow_info['id'] in workflow_id_set:
                continue

            workflow_id_set.add(workflow_info['id'])
            source_group_id = int(workflow.owner.split('@')[0])
            workflow_info['is_admin'] = False
            workflow_info['is_shared'] = True
            workflow_info['group_id'] = source_group_id
            if source_group_id not in groups_dict:
                other_group_ids.append(source_group_id)
            else:
                workflow_info['group_name'] = groups_dict[source_group_id].group_name
                workflow_info['group_owner'] = groups_dict[source_group_id].creator_name
            can_use_workflows.append(workflow_info)
            non_admin_workflow_id_set.add(workflow_info['id'])

        # query dtables
        dtables_dict = {dtable.uuid.hex: dtable for dtable in DTables.objects.filter(uuid__in=list(dtable_uuid_set), deleted=False)}

        # query groups
        other_groups_dict = get_groups_info(other_group_ids)

        # query workflow tasks count
        ongoing_tasks_count_dict = {}
        initiated_tasks_count_dict = {}

        ## query admin
        if admin_workflow_id_set:
            count_values_list = list(DTableWorkflowTasks.objects.filter(
                dtable_workflow_id__in=list(admin_workflow_id_set),
                task_state=TASK_STATE_PROCESSING
            ).values(
                "dtable_workflow_id"
            ).annotate(
                count=Count('dtable_workflow_id')
            ).values_list('dtable_workflow_id', 'count'))
            for dtable_workflow_id, count in count_values_list:
                ongoing_tasks_count_dict[dtable_workflow_id] = count
        ## query initiated
        if non_admin_workflow_id_set:
            count_values_list = list(DTableWorkflowTasks.objects.filter(
                dtable_workflow_id__in=list(non_admin_workflow_id_set),
                initiator=username
            ).values(
                "dtable_workflow_id"
            ).annotate(
                count=Count('dtable_workflow_id')
            ).values_list('dtable_workflow_id', 'count'))
            for dtable_workflow_id, count in count_values_list:
                initiated_tasks_count_dict[dtable_workflow_id] = count

        for workflow_info in can_use_workflows:
            if 'group_name' not in workflow_info:
                workflow_info['group_name'] = other_groups_dict.get(workflow_info['group_id'], {}).get('group_name', '')
                workflow_info['group_owner'] = other_groups_dict.get(workflow_info['group_id'], {}).get('group_owner', '')
            workflow_info['initiated_tasks_count'] = initiated_tasks_count_dict.get(workflow_info['id'], 0)

        for workflow_info in my_managed_workflows:
            workflow_info['workspace_id'] = dtables_dict[workflow_info['dtable_uuid']].workspace_id
            workflow_info['dtable_name'] = dtables_dict[workflow_info['dtable_uuid']].name
            workflow_info['ongoing_tasks_count'] = ongoing_tasks_count_dict.get(workflow_info['id'], 0)

        return Response({
            'my_managed_workflows': my_managed_workflows,
            'can_use_workflows': can_use_workflows,
            'workflow_folders': workflow_folders
        })


class DTableWorkflowTaskLogsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, token, task_id):
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')

        try:
            current_page = int(request.GET.get('page', 1))
            per_page = int(request.GET.get('per_page', 25))
        except:
            current_page, per_page = 1, 25

        start = (current_page - 1) * per_page
        end = start + per_page

        # resource check
        workflow = DTableWorkflows.objects.get_workflow_by_token(token)
        if not workflow:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workflow not found')
        workflow_task = DTableWorkflowTasks.objects.filter(
            dtable_workflow=workflow,
            id=task_id
        ).select_related(
            'dtable_workflow'
        ).first()
        if not workflow_task:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workflow task not found')
        dtable = DTables.objects.get_dtable_by_uuid(workflow.dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        username = request.user.username

        # permission check
        if not can_list_workflow_task_logs(workflow_task, username):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        queryset = DTableWorkflowTaskLogs.objects.filter(
            task=workflow_task
        ).order_by(
            '-created_at'
        )
        task_logs = list(queryset[start: end])

        nodes = get_nodes_from_config(workflow_task.dtable_workflow.workflow_config)
        nodes_dict = {node['_id']: node for node in nodes}

        if workflow_task.task_state == TASK_STATE_FINISHED:
            is_finished = True
            finished_at = workflow_task.to_dict()['finished_at']
        else:
            is_finished = False
            finished_at = None
        task_log_infos = []
        operators = set()
        for task_log in task_logs:
            task_log_info = task_log.to_dict(with_row_data=False)
            task_log_info['node'] = nodes_dict.get(task_log.node_id)
            task_log_info['next_node'] = nodes_dict.get(task_log.next_node_id)
            task_log_infos.append(task_log_info)
            operators.add(task_log.operator)

        if operators:
            all_profiles = Profile.objects.filter(user__in=list(operators))
            profiles_dict = {p.user: p for p in all_profiles}
            for task_log_info in task_log_infos:
                if task_log_info['operator'] in profiles_dict:
                    task_log_info['operator_name'] = profiles_dict[task_log_info['operator']].nickname
                    avatar_url = api_avatar_url(task_log_info['operator'])[0]
                    task_log_info['operator_avatar_url'] = avatar_url
                else:
                    task_log_info['operator_name'] = task_log_info['operator']
                    avatar_url = api_avatar_url(task_log_info['operator'])[0]
                    task_log_info['operator_avatar_url'] = avatar_url

        count = queryset.count()
        return Response({
            'task_log_list': task_log_infos,
            'finished_at': finished_at,
            'is_finished': is_finished,
            'count': count,
            'has_next_page': end < count
        })


class DTableWorkflowTaskParticipantsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, token, task_id):
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')
        # resource check
        workflow = DTableWorkflows.objects.get_workflow_by_token(token)
        if not workflow:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workflow not found')
        workflow_task = DTableWorkflowTasks.objects.get_task_by_token_id(token, task_id)
        if not workflow_task:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workflow task not found')
        if workflow_task.task_state != TASK_STATE_PROCESSING:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Workflow task finished')
        dtable = DTables.objects.get_dtable_by_uuid(workflow.dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        username = request.user.username

        # permission check
        group_id = workflow.group_id
        if not is_group_admin_or_owner(group_id, username):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        participants = list(DTableWorkflowTaskParticipants.objects.filter(
            dtable_workflow_task_id=task_id
        ).values_list('participant', flat=True))
        valid_profiles = Profile.objects.filter(user__in=participants)
        return_participants = []
        for profile in valid_profiles:
            avatar_url = api_avatar_url(profile.user)[0]
            return_participants.append({
                'name': profile.nickname,
                'avatar_url': avatar_url,
                'email': profile.user
            })

        return Response({
            'participants': return_participants,
        })

    def put(self, request, token, task_id):
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')
        participants_str = request.data.get('participants')
        if not participants_str:
            return api_error(status.HTTP_400_BAD_REQUEST, 'participants invalid')

        # resource check
        participants = [p.strip() for p in participants_str.split(',')]
        valid_profiles = list(Profile.objects.filter(user__in=participants))
        valid_participants = [p.user for p in valid_profiles]
        if not valid_participants:
            return api_error(status.HTTP_400_BAD_REQUEST, 'participants invalid')
        workflow = DTableWorkflows.objects.get_workflow_by_token(token)
        if not workflow:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workflow not found')
        workflow_task = DTableWorkflowTasks.objects.get_task_by_token_id(token, task_id)
        if not workflow_task:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workflow task not found')
        if workflow_task.task_state != TASK_STATE_PROCESSING:
            return api_error(status.HTTP_400_BAD_REQUEST, 'Workflow task finished')
        dtable = DTables.objects.get_dtable_by_uuid(workflow.dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        username = request.user.username

        # permission check
        node = get_specific_node_from_config(workflow.workflow_config, workflow_task.node_id)
        if node.get('type') == NODE_TYPE_INIT:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        group_id = workflow.group_id
        if not is_group_admin_or_owner(group_id, username):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        try:
            with transaction.atomic():
                # query task participants
                old_task_participants = DTableWorkflowTaskParticipants.objects.filter(dtable_workflow_task_id=task_id)
                existed_users = {otp.participant for otp in old_task_participants}
                # delete old participants
                old_task_participants.delete()
                # insert new participants
                db_participants = DTableWorkflowTaskParticipants.objects.bulk_add_participants(
                    task_id, workflow_task.node_id, valid_participants, filter_valid=False)
                # send notification
                new_pending_workflow_task.send(
                    None,
                    token=workflow.token,
                    task_id=workflow_task.id,
                    participants=[p.participant for p in db_participants if p.participant not in existed_users]
                )
        except Exception as e:
            logger.exception(e)
            logger.error('set task: %s error: %s', task_id, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        # update participants in base
        try:
            workflow_config = json.loads(workflow.workflow_config)
            table_id = get_table_id_from_config(workflow_config)
            participants_column_key = get_participants_column_key_from_config(workflow_config)
            if participants_column_key:
                dtable_metadata = get_metadata(dtable.uuid.hex)
                workflow_table = get_table_from_metadata(dtable_metadata, table_id)
                if workflow_table and get_column_from_table(workflow_table, participants_column_key, column_type=ColumnTypes.COLLABORATOR):
                    update_participants_cell(dtable.uuid, workflow_table['name'], workflow_task.row_id, participants_column_key, valid_participants)
        except Exception as e:
            logger.exception(e)
            logger.error('update participants cell error: %s', e)

        return_participants = []
        for profile in valid_profiles:
            avatar_url = api_avatar_url(profile.user)[0]
            return_participants.append({
                'name': profile.nickname,
                'avatar_url': avatar_url,
                'email': profile.user
            })

        return Response({
            'participants': return_participants
        })

class DTableWorkflowTaskByRowIdView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, token, task_row_id):
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')

        # resource check
        workflow = DTableWorkflows.objects.get_workflow_by_token(token)
        if not workflow:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workflow not found')

        error_msg = check_workflow_config(workflow.workflow_config)
        if error_msg:
            error_msg = 'The flow: %s workflow_config invalid: %s' % (token, error_msg)
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        dtable = DTables.objects.get_dtable_by_uuid(workflow.dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        # permission check
        username = request.user.username
        if not check_dtable_permission(username, dtable.workspace, dtable):
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        task = DTableWorkflowTasks.objects.get_task_by_token_row_id(token, task_row_id)
        if not task:
            return Response({
                'workflow': workflow.to_dict(),
            })

        current_node = get_specific_node_from_config(workflow.workflow_config, task.node_id)
        if not current_node:
            return Response({
                'workflow': workflow.to_dict(),
                'task': task.to_dict(),
                'current_node': None
            })

        return Response({
            'task': task.to_dict(),
            'current_node': current_node,
            'the_other_nodes': get_the_other_nodes_from_config(current_node, workflow.workflow_config),
        })

    def delete(self, request, token, task_row_id):
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')

        # resource check
        workflow = DTableWorkflows.objects.get_workflow_by_token(token)
        if not workflow:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workflow not found')

        dtable = DTables.objects.get_dtable_by_uuid(workflow.dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')
        
        task = DTableWorkflowTasks.objects.get_task_by_token_row_id(token, task_row_id)
        if not task:
            return Response({'success': True})

        # permission check
        username = request.user.username
        if check_dtable_permission(username, dtable.workspace, dtable) != PERMISSION_READ_WRITE:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        try:
            task.delete()
        except Exception as e:
            logger.error('delete workflow task: %s error: %s', task.id, e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})

class DTableWorkflowTasksByRowIdsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def delete(self, request, token):
        if not settings.ENABLE_WORKFLOW:
            return api_error(status.HTTP_403_FORBIDDEN, 'Feature not enabled')

        # arguments check
        row_ids = request.data.get('row_ids')
        if not row_ids:
            return Response({'success': True})
        if not isinstance(row_ids, list):
            return api_error(status.HTTP_400_BAD_REQUEST, 'row_ids invalid')

        # resource check
        workflow = DTableWorkflows.objects.get_workflow_by_token(token)
        if not workflow:
            return api_error(status.HTTP_404_NOT_FOUND, 'Workflow not found')

        dtable = DTables.objects.get_dtable_by_uuid(workflow.dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')

        # permission check
        username = request.user.username
        if check_dtable_permission(username, dtable.workspace, dtable) != PERMISSION_READ_WRITE:
            return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

        try:
            DTableWorkflowTasks.objects.get_tasks_by_token_row_ids(token, row_ids).delete()
        except Exception as e:
            logger.error('delete workflow tasks error: %s', e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})


class UserWorkflowFoldersView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def post(self, request):
        # add a workflow folder
        name = request.data.get('name')
        folder_type = request.data.get('folder_type')
        if not name:
            return api_error(status.HTTP_400_BAD_REQUEST, 'name invalid.')

        if not folder_type:
            return api_error(status.HTTP_400_BAD_REQUEST, 'folder type invalid.')

        if folder_type not in WORKFLOW_FOLDER_TYPES:
            return api_error(status.HTTP_400_BAD_REQUEST, 'folder type invalid.')

        username = request.user.username

        name = WorkflowFolders.objects.get_non_duplicated_name(name, username, folder_type)
        try:
            folder = WorkflowFolders.objects.create(name=name, username=username, folder_type=folder_type)
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'folder': folder.to_dict()})


def get_workflows_in_my_managed_wf_folder(username, folder):
    """
    query folder workflows, folder_workflows
    query user admin groups workflows, my_managed_workflows
    delete workflows in folder_workflows and not in my_managed_workflow from folder
    """
    admin_group_ids = group_get_user_admin_group_ids(username)
    admin_group_ids_set = set(admin_group_ids)
    my_managed_workflows = []
    workflow_id_set = set()
    dtable_uuid_set = set()

    # workflows of groups
    folder_workflow_ids = WorkflowFolderItems.objects.filter(
        folder_id=folder.pk,
    ).values_list('workflow_id', flat=True)

    if not folder_workflow_ids:
        return []

    group_infos_dict = get_groups_info(admin_group_ids)

    workflows = DTableWorkflows.objects.get_workflows_by_group_ids(admin_group_ids_set).filter(pk__in=folder_workflow_ids)
    for workflow in workflows:
        workflow_info = workflow.to_dict()
        group_id = int(workflow.owner.split('@')[0])
        workflow_id_set.add(workflow_info['id'])
        dtable_uuid_set.add(workflow_info['dtable_uuid'])

        workflow_info['group_id'] = group_id
        workflow_info['is_shared'] = False

        workflow_info['group_name'] = group_infos_dict[group_id]['group_name']
        workflow_info['group_owner'] = group_infos_dict[group_id]['group_owner']

        workflow_info['is_admin'] = True
        my_managed_workflows.append(workflow_info)

    # query dtables
    dtables_dict = {dtable.uuid.hex: dtable for dtable in
                    DTables.objects.filter(uuid__in=list(dtable_uuid_set), deleted=False)}

    # query workflow tasks count
    ongoing_tasks_count_dict = {}

    ## query ongoing count
    count_values_list = list(DTableWorkflowTasks.objects.filter(
        dtable_workflow_id__in=list(workflow_id_set),
        task_state=TASK_STATE_PROCESSING
    ).values(
        "dtable_workflow_id"
    ).annotate(
        count=Count('dtable_workflow_id')
    ).values_list('dtable_workflow_id', 'count'))
    for dtable_workflow_id, count in count_values_list:
        ongoing_tasks_count_dict[dtable_workflow_id] = count

    for workflow_info in my_managed_workflows:
        workflow_info['workspace_id'] = dtables_dict[workflow_info['dtable_uuid']].workspace_id
        workflow_info['dtable_name'] = dtables_dict[workflow_info['dtable_uuid']].name
        workflow_info['ongoing_tasks_count'] = ongoing_tasks_count_dict.get(workflow_info['id'], 0)

    need_delete_workflow_ids_set = set(folder_workflow_ids) - workflow_id_set
    WorkflowFolderItems.objects.filter(folder_id=folder.pk, workflow_id__in=list(need_delete_workflow_ids_set)).delete()

    return my_managed_workflows

def get_workflows_in_can_use_wf_folder(username, folder):
    """
    query folder workflows, folder_workflows
    query user groups workflows, group_workflows
    query workflows shared to user groups, shared_workflows
    can_use_workflows = group_workflows + shared_workflows
    delete workflows in folder_workflows and not in can_use_workflows from folder
    """
    groups = get_user_groups(username)
    admin_group_ids_set = set(group_get_user_admin_group_ids(username))
    groups_dict = {group.id: group for group in groups}
    can_use_workflows = []
    workflow_id_set = set()
    other_group_ids = []

    # workflows of groups
    folder_workflow_ids = WorkflowFolderItems.objects.filter(
        folder_id=folder.pk,
    ).values_list('workflow_id', flat=True)

    if not folder_workflow_ids:
        return []

    # query workflows in groups
    non_admin_group_ids_set = groups_dict.keys() - admin_group_ids_set
    workflows = DTableWorkflows.objects.get_workflows_by_group_ids(non_admin_group_ids_set).filter(pk__in=folder_workflow_ids)
    for workflow in workflows:
        workflow_info = workflow.to_dict()
        group_id = int(workflow.owner.split('@')[0])
        workflow_id_set.add(workflow_info['id'])

        workflow_info['group_id'] = group_id
        workflow_info['is_shared'] = False

        workflow_info['group_name'] = groups_dict[group_id].group_name
        workflow_info['group_owner'] = groups_dict[group_id].creator_name

        workflow_info['is_admin'] = False
        can_use_workflows.append(workflow_info)

    # query workflows shared to groups
    wf_shares = DTableWorkflowShare.objects.list_by_group_ids(groups_dict.keys()).filter(dtable_workflow_id__in=folder_workflow_ids).select_related('dtable_workflow')
    for wf_share in wf_shares:
        workflow = wf_share.dtable_workflow
        if workflow.id in workflow_id_set:
            continue
        source_group_id = int(workflow.owner.split('@')[0])
        if source_group_id in admin_group_ids_set:
            continue
        workflow_info = workflow.to_dict()
        workflow_id_set.add(workflow.id)
        workflow_info['is_admin'] = False
        workflow_info['is_shared'] = True
        workflow_info['group_id'] = source_group_id
        if source_group_id not in groups_dict:
            other_group_ids.append(source_group_id)
        else:
            workflow_info['group_name'] = groups_dict[source_group_id].group_name
            workflow_info['group_owner'] = groups_dict[source_group_id].creator_name
        can_use_workflows.append(workflow_info)

    # query groups
    other_group_infos_dict = get_groups_info(other_group_ids)

    # query workflow tasks count
    initiated_tasks_count_dict = {}

    ## query initiated count
    count_values_list = list(DTableWorkflowTasks.objects.filter(
        dtable_workflow_id__in=list(workflow_id_set),
        initiator=username
    ).values(
        "dtable_workflow_id"
    ).annotate(
        count=Count('dtable_workflow_id')
    ).values_list('dtable_workflow_id', 'count'))
    for dtable_workflow_id, count in count_values_list:
        initiated_tasks_count_dict[dtable_workflow_id] = count

    for workflow_info in can_use_workflows:
        workflow_info['initiated_tasks_count'] = initiated_tasks_count_dict.get(workflow_info['id'], 0)
        if workflow_info['group_id'] not in groups_dict:
            workflow_info['group_name'] = other_group_infos_dict.get(workflow_info['group_id'], {}).get('group_name', '')
            workflow_info['group_owner'] = other_group_infos_dict.get(workflow_info['group_id'], {}).get('group_owner', '')

    need_delete_workflow_ids_set = set(folder_workflow_ids) - workflow_id_set
    WorkflowFolderItems.objects.filter(folder_id=folder.pk, workflow_id__in=list(need_delete_workflow_ids_set)).delete()

    return can_use_workflows



class UserWorkflowFolderView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, workflow_folder_id):
        # list all workflows in current folder

        try:
            workflow_folder_id = int(workflow_folder_id)
        except:
            error_msg = "workflow_folder_id invalid"
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        username = request.user.username

        folder_queryset = WorkflowFolders.objects.filter(pk=workflow_folder_id, username=username)
        if not folder_queryset.exists():
            error_msg = 'Folder %s does not exist.' % workflow_folder_id
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        workflow_folder = folder_queryset[0]
        workflow_list = []

        try:
            if workflow_folder.folder_type == MY_MANAGED_WORKFLOW:
                workflow_list = get_workflows_in_my_managed_wf_folder(username, workflow_folder)

            if workflow_folder.folder_type == CAN_USED_WORKFLOW:
                workflow_list = get_workflows_in_can_use_wf_folder(username, workflow_folder)
        except Exception as e:
            logger.exception(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')
        return Response({
            'workflow_list': workflow_list,
        })


    def put(self, request, workflow_folder_id):
        # rename a workflow folder
        try:
            workflow_folder_id = int(workflow_folder_id)
        except:
            error_msg = "workflow_folder_id invalid"
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        name = request.data.get('name')
        username = request.user.username

        try:
            workflow_folder = WorkflowFolders.objects.filter(pk=workflow_folder_id, username=username).first()
            if not workflow_folder:
                error_msg = 'Folder %s does not exist.' % workflow_folder_id
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)
            name = WorkflowFolders.objects.get_non_duplicated_name(name, username, workflow_folder.folder_type)
            workflow_folder.name = name
            workflow_folder.save()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'folder': workflow_folder.to_dict()})

    def delete(self, request, workflow_folder_id):
        # delete a workflow folder
        try:
            workflow_folder_id = int(workflow_folder_id)
        except:
            error_msg = "workflow_folder_id invalid"
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        username = request.user.username

        try:
            workflow_folder = WorkflowFolders.objects.filter(pk=workflow_folder_id, username=username).first()
            if not workflow_folder:
                error_msg = 'Folder %s does not exist.' % workflow_folder_id
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            folder_items = WorkflowFolderItems.objects.filter(folder_id=workflow_folder_id).all()
            if folder_items.exists():
                error_msg = _('Folder is not empty. Can not be deleted.')
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            workflow_folder.delete()
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error.')

        return Response({'success': True})


class MoveWorkflowToFolderView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)


    @staticmethod
    def check_workflow_and_folder_type(username, workflow, to_folder):
        """
        return: error -> api_error or None
        """
        dtable = DTables.objects.get_dtable_by_uuid(workflow.dtable_uuid, include_deleted=False)
        if not dtable:
            return api_error(status.HTTP_404_NOT_FOUND, 'Base not found')
        is_admin = check_dtable_admin_permission(username, dtable.workspace.owner)
        if is_admin:
            if to_folder.folder_type == MY_MANAGED_WORKFLOW:
                return None
            else:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')
        else:
            if to_folder.folder_type == CAN_USED_WORKFLOW:
                return None
            else:
                return api_error(status.HTTP_403_FORBIDDEN, 'Permission denied')

    def post(self, request, token):

        username = request.user.username
        move_from = request.data.get('move_from')  # from folder_id or /
        move_to = request.data.get('move_to')  # to folder_id or /

        workflow = DTableWorkflows.objects.get_workflow_by_token(token)
        if not workflow:
            error_msg = 'Workflow not found'
            return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        ## from and to check, resource and permission check
        if move_from != '/':
            move_from_folder = WorkflowFolders.objects.filter(id=move_from, username=username).first()
            if not move_from_folder:
                return api_error(status.HTTP_404_NOT_FOUND, 'From folder not found')
            if not WorkflowFolderItems.objects.filter(folder_id=move_from,  workflow_id=workflow.id).exists():
                return api_error(status.HTTP_404_NOT_FOUND, 'Workflow not found in folder')

        if move_to != '/':
            move_to_folder = WorkflowFolders.objects.filter(id=move_to, username=username).first()
            if not move_to_folder:
                return api_error(status.HTTP_404_NOT_FOUND, 'To folder not found')
            error = self.check_workflow_and_folder_type(username, workflow, move_to_folder)
            if error:
                return error

        # move
        try:
            if move_from == '/':
                WorkflowFolderItems.objects.create(folder_id=move_to, workflow_id=workflow.id)
            elif move_to == '/':
                WorkflowFolderItems.objects.filter(folder_id=move_from, workflow_id=workflow.id).delete()
            else:
                WorkflowFolderItems.objects.filter(folder_id=move_from, workflow_id=workflow.id).update(
                    folder_id=move_to
                )
        except Exception as e:
            logger.error(e)
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

        return Response({'success': True})
