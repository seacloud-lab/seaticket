import json
import logging
from copy import deepcopy

import requests
from django.conf import settings
from django.http.response import Http404
from django.shortcuts import render
from django.utils.translation import gettext as _

from seahub.auth.decorators import login_required
from seahub.dtable.constants import ColumnTypes
from seahub.dtable.models import DTables
from seahub.dtable.utils import can_use_automation_rules_by_dtable, check_dtable_admin_permission, can_run_python_by_dtable
from seahub.dtable_apps.dtable_db_api import DTableDBAPI
from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.dtable_apps.workflow.models import DTableWorkflowTaskParticipants, DTableWorkflowTasks, DTableWorkflows
from seahub.dtable_apps.workflow.utils import TASK_STATE_FINISHED, can_submit_workflow_task, check_workflow_config, \
    get_specific_node_from_config, get_state_column_key_from_config, get_table_from_metadata, get_table_id_from_config, \
    get_finish_node_from_config, get_init_node_from_config, get_metadata, get_valid_nodes_from_config, \
    get_dynamic_participants_column_keys, get_participants_column_key_from_config, get_the_other_nodes_from_config
from seahub.settings import DTABLE_SERVER_URL, DTABLE_SOCKET_URL, \
    ENABLE_WORKFLOW, DTABLE_WEB_SERVICE_URL, INNER_DTABLE_DB_URL, DTABLE_BAIDU_MAP_KEY
from seahub.department_v2.utils import get_departments_map_by_username
from seahub.utils import is_org_context, render_error, render_permission_error, get_inner_dtable_server_url
from seahub.utils.utils_etcd import get_server_by_dtable_uuid, enable_dtable_server_cluster

logger = logging.getLogger(__name__)
dtable_server_url = get_inner_dtable_server_url()


def fill_link_columns(dtable, dtable_metadata, table_id, row, columns_dict, return_column_keys):
    for key, value in row.items():
        column = columns_dict.get(key)
        if not column or key not in return_column_keys:
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
        row[key] = linked_rows
    return row


# approve view
@login_required
def dtable_workflow_task_transfer_view(request, token, task_id):
    if not ENABLE_WORKFLOW:
        raise Http404
    username = request.user.username
    # resource check
    task = DTableWorkflowTasks.objects.get_task_by_token_id(token, task_id)
    if not task:
        raise Http404
    if not task.is_valid:
        return render_error(request, 'Task invalid')
    error_msg = check_workflow_config(task.dtable_workflow.workflow_config)
    if error_msg:
        return render_error(request, 'Workflow not set completed or invalid')
    workflow_config = json.loads(task.dtable_workflow.workflow_config)
    dtable = DTables.objects.get_dtable_by_uuid(task.dtable_workflow.dtable_uuid, include_deleted=False)
    if not dtable:
        raise Http404

    # permission check
    if not DTableWorkflowTaskParticipants.objects.can_transfer(task, username):
        return render_permission_error(request, _('Permission denied or you have operated'))

    dtable_metadata = get_metadata(dtable.uuid.hex)
    table_id = get_table_id_from_config(workflow_config)
    state_column_key = get_state_column_key_from_config(workflow_config)
    participants_column_key = get_participants_column_key_from_config(workflow_config)
    workflow_table, state_column = None, None
    for table in dtable_metadata.get('tables', []):
        if table['_id'] == table_id:
            workflow_table = table
            for column in table['columns']:
                if column['key'] == state_column_key:
                    state_column = column
                    break
            break
    if not workflow_table or not state_column:
        return render_error(request, 'Table or state column not found')
    current_node = get_specific_node_from_config(workflow_config, task.node_id)
    if not current_node:
        return render_error(request, 'The node of this task invalid')

    # The reason why use sql instead of the api of fetching a row is, frontend prefer {column_key: value} format
    # If there are still bugs, please improve it.
    sql = "SELECT * FROM `%(table)s` WHERE _id='%(row_id)s'" % {
        'table': workflow_table['name'],
        'row_id': task.row_id
    }
    dtable_db_api = DTableDBAPI('dtable-web', str(dtable.uuid), INNER_DTABLE_DB_URL)
    try:
        results = dtable_db_api.query(sql)['results']
    except Exception as e:
        logger.exception('query dtable: %s table: %s sql: %s error: %s', dtable.uuid, workflow_table['name'], sql, e)
        return render_error(request, _('Internal Server Error'))
    if not results:
        return render_error(request, 'Row has been deleted')

    # checkout readonly cells within value in row and checkout transfer form columns
    readonly_columns, readwrite_columns, return_column_keys = [], [], set()
    columns_dict = {col.get('key'): col for col in workflow_table['columns']}
    dynamic_participants_column_keys = set(get_dynamic_participants_column_keys(workflow_config))
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
    row = results[0]
    row = fill_link_columns(dtable, dtable_metadata, table_id, row, columns_dict, return_column_keys)

    # checkout valid node ids to transfer to
    valid_nodes = get_valid_nodes_from_config(current_node, workflow_config)
    the_other_nodes = get_the_other_nodes_from_config(current_node, workflow_config)

    return render(request, 'dtable_workflow_transfer_react.html', {
        'dtable_metadata': json.dumps(dtable_metadata),
        'flow_table': json.dumps(workflow_table),
        'task': json.dumps(task.to_dict()),
        'row': json.dumps(row),
        'readonly_columns': json.dumps(readonly_columns),
        'readwrite_columns': json.dumps(readwrite_columns),
        'valid_nodes': json.dumps(valid_nodes),
        'the_other_nodes': json.dumps(the_other_nodes),
        'token': token,
        'current_node': json.dumps(current_node),
        'workspace_id': dtable.workspace_id,
        'dtable_name': dtable.name,
        'dtable_web_service_url': DTABLE_WEB_SERVICE_URL,
        'dtable_baidu_map_key': DTABLE_BAIDU_MAP_KEY,
    })


# submitted view
@login_required
def dtable_workflow_task_submitted_view(request, token, task_id):
    if not ENABLE_WORKFLOW:
        raise Http404
    username = request.user.username
    # resource check
    task = DTableWorkflowTasks.objects.get_task_by_token_id(token, task_id)
    if not task:
        raise Http404
    if not task.is_valid:
        return render_error(request, 'Task invalid')
    error_msg = check_workflow_config(task.dtable_workflow.workflow_config)
    if error_msg:
        return render_error(request, 'Workflow not set completed or invalid')
    workflow_config = json.loads(task.dtable_workflow.workflow_config)
    dtable = DTables.objects.get_dtable_by_uuid(task.dtable_workflow.dtable_uuid, include_deleted=False)
    if not dtable:
        raise Http404

    # permission check
    if task.initiator != username:
        return render_permission_error(request, 'Permission denied')

    dtable_metadata = get_metadata(dtable.uuid.hex)
    table_id = get_table_id_from_config(workflow_config)
    state_column_key = get_state_column_key_from_config(workflow_config)
    participants_column_key = get_participants_column_key_from_config(workflow_config)
    workflow_table, state_column = None, None
    for table in dtable_metadata.get('tables', []):
        if table['_id'] == table_id:
            workflow_table = table
            for column in table['columns']:
                if column['key'] == state_column_key:
                    state_column = column
                    break
            break
    if not workflow_table or not state_column:
        return render_error(request, 'Table or state column not found')
    columns_dict = {col.get('key'): col for col in workflow_table['columns']}
    current_node = get_specific_node_from_config(workflow_config, task.node_id)
    if not current_node:
        return render_error(request, 'The node of this task invalid')

    # The reason why use sql instead of the api of fetching a row is, frontend prefer {column_key: value} format
    # If there are still bugs, please improve it.
    sql = "SELECT * FROM `%(table)s` WHERE _id='%(row_id)s'" % {
        'table': workflow_table['name'],
        'row_id': task.row_id
    }
    dtable_db_api = DTableDBAPI('dtable-web', str(dtable.uuid), INNER_DTABLE_DB_URL)
    try:
        results = dtable_db_api.query(sql)['results']
    except Exception as e:
        pass
    if not results:
        return render_error(request, 'Row has been deleted')
    row = results[0]

    node_columns, show_columns, return_column_keys = [], [], set()

    if task.task_state == TASK_STATE_FINISHED:

        # finish node form
        finish_node = get_finish_node_from_config(workflow_config)
        node_form = finish_node.get('node_form')
        if node_form:
            node_columns = node_form.get('readonly_columns', [])
    else:
        init_node = get_init_node_from_config(workflow_config)
        node_form = init_node['node_form']
        node_columns = node_form.get('readwrite_columns', [])

    for col in node_columns:
        if col['key'] not in columns_dict:
            logger.warning('task: %s, col: %s not found in base table', task.id, col['key'])
            continue
        if col['key'] in [state_column_key, participants_column_key]:
            continue
        show_columns.append(col)
        return_column_keys.add(col['key'])
    
    row = {key: results[0].get(key) for key in return_column_keys}
    row = fill_link_columns(dtable, dtable_metadata, table_id, row, columns_dict, return_column_keys)

    return render(request, 'dtable_workflow_submitted_react.html', {
        'dtable_metadata': json.dumps(dtable_metadata),
        'flow_table': json.dumps(workflow_table),
        'task': json.dumps(task.to_dict()),
        'row': json.dumps(row),
        'token': token,
        'show_columns': json.dumps(show_columns),
        'current_node': json.dumps(current_node),
        'workspace_id': dtable.workspace_id,
        'dtable_name': dtable.name
    })


@login_required
def workflow_edit_view(request, token):
    if not ENABLE_WORKFLOW:
        raise Http404

    # resource check
    workflow = DTableWorkflows.objects.get_workflow_by_token(token)
    if not workflow:
        raise Http404
    dtable = DTables.objects.get_dtable_by_uuid(workflow.dtable_uuid, include_deleted=False)
    if not dtable:
        raise Http404
    
    # permission check
    username = request.user.username
    if not check_dtable_admin_permission(username, dtable.workspace.owner):
        return render_permission_error(request, 'Permission denied')
    
    user_department_ids_map = get_departments_map_by_username(username)
    
    try:
        org = request.user.org
    except AttributeError:
        org = None

    error_msg = check_workflow_config(workflow.workflow_config)
    if error_msg:
        return render_error(request, 'Workflow invalid')
    workflow_config = json.loads(workflow.workflow_config)
    workflow_name = workflow_config.get('workflow_name')

    dtable_server_api = DTableServerAPI(username, str(dtable.uuid), dtable_server_url)
    access_token = dtable_server_api.view_access_token

    if enable_dtable_server_cluster:
        real_dtable_server_url = get_server_by_dtable_uuid(str(dtable.uuid))
        real_dtable_socket_url = dtable_server_url
    else:
        real_dtable_server_url = DTABLE_SERVER_URL
        real_dtable_socket_url = DTABLE_SOCKET_URL

    return_dict = {
        'workspace_id': dtable.workspace_id,
        'dtable_name': dtable.name,
        'token': token,
        'dtable_uuid': str(dtable.uuid),
        'dtable_group_id': dtable.get_owner_group_id(),
        'workflow_id': workflow.id,
        'workflow_name': workflow_name,
        'workflow_config': workflow.workflow_config,
        'user_department_ids_map': user_department_ids_map,
        'access_token': access_token,
        'dtable_server': real_dtable_server_url,
        'dtable_socket': real_dtable_socket_url,
        'dtable_web_service_url' : DTABLE_WEB_SERVICE_URL,
        'org_id': dtable.workspace.org_id,
        'org': org,
        'can_run_python_script': can_run_python_by_dtable(dtable),
        'can_use_automation_rules': can_use_automation_rules_by_dtable(dtable),
        'enable_address_book_v2': settings.ENABLE_ADDRESSBOOK_V2,
        'enable_department_admin_manage_member_bases': settings.ENABLE_DEPARTMENT_ADMIN_MANAGE_MEMBER_BASES
    }

    return render(request, 'dtable_workflow_edit_react.html', return_dict)
