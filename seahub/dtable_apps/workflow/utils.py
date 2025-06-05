import json
import logging
import os
import re
import time
from copy import deepcopy
from urllib import parse
from uuid import UUID

import jwt
import requests
from django.urls import reverse

from seahub.api2.authentication import AUTHORIZATION_PREFIX
from seahub.dtable.constants import ColumnTypes
from seahub.dtable.message_formatters import fill_message_with_sql_row
from seahub.dtable.utils import PUBLIC_FORMS_RELATIVE_PATH, UPLOAD_DIGITAL_SIGNS_RELATIVE_PATH, UPLOAD_IMG_RELATIVE_PATH, gen_random_option, migrate_image
from seahub.dtable_apps.dtable_db_api import DTableDBAPI
from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.group.utils import get_user_groups, is_group_admin_or_owner, is_group_member
from seahub.settings import DTABLE_PRIVATE_KEY, DTABLE_WEB_SERVICE_URL, \
    INNER_DTABLE_DB_URL
from seahub.utils import get_inner_dtable_server_url

logger = logging.getLogger(__name__)

NODE_TYPE_INIT = 'init'
NODE_TYPE_NORMAL = 'normal'
NODE_TYPE_COMPLETED = 'completed'
NODE_TYPE_CANCELED = 'canceled'

TASK_STATE_PROCESSING = 'processing'
TASK_STATE_FINISHED = 'finished'
TASK_STATE_CANCELED = 'canceled'

LOG_TYPE_INIT = 'init'
LOG_TYPE_TRANSFER = 'transfer'
LOG_TYPE_COUNTER = 'counter'

CAN_USED_WORKFLOW = 'can_used_workflow_folder'
MY_MANAGED_WORKFLOW = 'managed_workflow_folder'

WORKFLOW_FOLDER_TYPES = [
    CAN_USED_WORKFLOW,
    MY_MANAGED_WORKFLOW,
]

CONFIG_SOFT_MAX_LENGTH = 65035
CONFIG_HARD_MAX_LENGTH = 65535

dtable_server_url = get_inner_dtable_server_url()


re_after_offset = re.compile(r'^\+?\d+[dh]$')
def check_workflow_config(workflow_config, hard_length=False):
    """
    check workflow_config valid or not
    return: error_msg -> str or None
    """
    max_length = CONFIG_HARD_MAX_LENGTH if hard_length else CONFIG_SOFT_MAX_LENGTH
    if isinstance(workflow_config, str):
        if len(workflow_config) > max_length:
            return 'workflow_config too big'
        try:
            workflow_config = json.loads(workflow_config)
        except:
            return 'workflow_config invalid'
    elif isinstance(workflow_config, dict):
        workflow_config_str = json.dumps(workflow_config)
        if len(workflow_config_str) > max_length:
            return 'workflow_config too big'
    else:
        return 'workflow_config invalid'

    def check_required_fields(dict_obj, required_fields):
        for field in required_fields:
            field_type = field.get('type')
            field_name = field.get('name')
            if field_name not in dict_obj or not isinstance(dict_obj.get(field_name), field_type):
                return '%(field)s invalid and should be a %(type)s' % {'field': field_name, 'type': field_type}
        return None

    workflow_name = workflow_config.get('workflow_name')
    if not workflow_name:
        return 'workflow_name invalid'

    table_id = workflow_config.get('table_id')
    state_column_key = workflow_config.get('state_column_key')
    if table_id or state_column_key:
        if not table_id or not isinstance(table_id, str):
            return 'table_id invalid'
        if not state_column_key or not isinstance(state_column_key, str):
            return 'state_column_key invalid'
    participants_column_key = workflow_config.get('participants_column_key')
    if table_id:
        if participants_column_key and not isinstance(participants_column_key, str):
            return 'participants_column_key invalid'

    nodes = workflow_config.get('nodes')
    if nodes and not (table_id and state_column_key):
        return 'nodes set but table_id or state_column_key invalid'
    if nodes is not None and not isinstance(nodes, list):
        return 'nodes invalid'
    if not nodes:
        return

    # check nodes
    node_ids = set()
    node_names = set()
    init_node = None
    canceled_node = None
    for node in nodes:
        if not isinstance(node, dict):
            return 'node invalid'
        error_msg = check_required_fields(node, [
            {'type': str, 'name': '_id'},
            {'type': str, 'name': 'type'},
            {'type': str, 'name': 'name'},
        ])
        if error_msg:
            return error_msg
        if node.get('name') in node_names:
            return 'Node %s duplicated' % node.get('name')
        if node.get('_id') in node_ids:
            return 'Node %s _id duplicated' % node.get('name')
        node_ids.add(node.get('_id'))
        node_names.add(node.get('name'))
        node_type = node.get('type')
        if node_type not in [NODE_TYPE_INIT, NODE_TYPE_NORMAL, NODE_TYPE_COMPLETED, NODE_TYPE_CANCELED]:
            return 'type of node: %s invalid' % node.get('name')
        if node_type == NODE_TYPE_CANCELED:
            if canceled_node:
                return 'There are multiple canceled nodes'
            canceled_node = node
        node_form = node.get('node_form')
        if node_form is not None and not isinstance(node, dict):
            return 'node_form if node: %s invalid' % node.get('name')
        actions = node.get('actions')
        if actions is not None and not isinstance(actions, list):
            return 'actions of node: %s should be a list' % node.get('name')
        conditional_next_nodes = node.get('conditional_next_nodes')
        if conditional_next_nodes is not None and not isinstance(conditional_next_nodes, list):
            return 'conditional_next_nodes of node %s should be a list' % node.get('name')

        # check init node
        if node_type == NODE_TYPE_INIT:
            if init_node:
                return 'There are multiple init nodes'
            init_node = node
            if node_form:
                readwrite_columns = node_form.get('readwrite_columns')
                if readwrite_columns and not isinstance(readwrite_columns, list):
                    return 'readwrite_columns in node_form should be a list'

        # check normal node
        elif node_type == NODE_TYPE_NORMAL:
            if node_form:
                readonly_columns = node_form.get('readonly_columns')
                if readonly_columns and not isinstance(readonly_columns, list):
                    return 'readonly_columns in node_form should be a list'
                readwrite_columns = node_form.get('readwrite_columns')
                if readwrite_columns and not isinstance(readwrite_columns, list):
                    return 'readwrite_columns in node_form should be a list'
            other_node_ids = node.get('other_node_ids')
            if other_node_ids and not isinstance(other_node_ids, list):
                return 'node: %s other_node_ids invalid' % node.get('name')

            participants_type = node.get('participants_type', 'static')
            participants = node.get('participants')
            need_all_participants_submit = node.get('need_all_participants_submit')
            node_participants_column_key = node.get('node_participants_column_key')
            if participants_type not in ('static', 'dynamic'):
                return 'node: %s participants_type invalid' % node.get('name')
            if need_all_participants_submit is not None and not isinstance(need_all_participants_submit, bool):
                return 'node: %s need_all_participants_submit invalid' % node.get('name')
            if participants_type == 'static' and participants is not None and not isinstance(participants, list):
                return 'participants of node: %s should be a list' % node.get('name')
            if participants_type == 'dynamic' and not node_participants_column_key:
                return 'node: %s node_participants_column_key invalid' % node.get('name')

            enable_processing_time_limit = node.get('enable_processing_time_limit')
            if enable_processing_time_limit is not None and not isinstance(enable_processing_time_limit, bool):
                return 'node: %s enable_processing_time_limit invalid' % node.get('name')
            if enable_processing_time_limit:
                processing_time_limit = node.get('processing_time_limit')
                if processing_time_limit:
                    if not isinstance(processing_time_limit, str):
                        return 'node: %s processing_time_limit invalid' % node.get('name')
                    if not re_after_offset.match(processing_time_limit):
                        return 'node: %s processing_time_limit invalid' % node.get('name')

        # check completed node
        elif node_type == NODE_TYPE_COMPLETED:
            if node_form:
                readonly_columns = node_form.get('readonly_columns')
                if readonly_columns and not isinstance(readonly_columns, list):
                    return 'readonly_columns in node_form should be a list'

        if node_form:
            readonly_columns = node_form.get('readonly_columns',)
            readwrite_columns = node_form.get('readwrite_columns')
            if readonly_columns:
                for column in readonly_columns:
                    if not isinstance(column, dict):
                        return 'a column element should be a dict'
                    error_msg = check_required_fields(column, [{'type': str, 'name': 'key'}])
                    if error_msg:
                        return error_msg
                node_form['readonly_columns'] = list(filter(lambda col: col['key'] != state_column_key, readonly_columns))
            if readwrite_columns:
                for column in readwrite_columns:
                    if not isinstance(column, dict):
                        return 'a column element should be a dict'
                    error_msg = check_required_fields(column, [{'type': str, 'name': 'key'}])
                    if error_msg:
                        return error_msg
                node_form['readwrite_columns'] = list(filter(lambda col: col['key'] != state_column_key, readwrite_columns))

            if readonly_columns and readwrite_columns:
                rw_col_keys = [col['key'] for col in readwrite_columns]
                for col in readonly_columns:
                    if col.get('key') in rw_col_keys:
                        return 'readonly columns are not writable'

        for action in actions or []:
            if not isinstance(action, dict):
                return 'The action of node %s is invalid' % node.get('name')
            if action.get('type') not in ('notify', 'update_record', 'add_record', 'lock_record', 'send_wechat', 'send_dingtalk', 'send_email', 'run_python_script', 'link_records', 'add_record_to_other_table'):
                return 'The action of node %s is invalid: type %s invalid' % (node.get('name'), action.get('type'))
            if action['type'] == 'notify':
                users, default_msg, users_column_key = action.get('users'), action.get('default_msg'), action.get('users_column_key')
                if (not users and not users_column_key) or not isinstance(users, list):
                    return 'The action "notify" of node %s is invalid: users invalid' % node.get('name')
                if not default_msg and not isinstance(default_msg, str):
                   return 'The action "notify" of node %s is invalid: default_msg invalid' % node.get('name')
            elif action['type'] == 'update_record':
                updates = action.get('updates')
                if not updates or not isinstance(updates, dict):
                    return 'The action "update_record" of node %s is invalid: updates invalid' % node.get('name')
            elif action.get('type') == 'add_record':
                row = action.get('row')
                if not row or not isinstance(row, dict):
                    return 'The action "add_record" of node %s is invalid: row invalid' % node.get('name')
            elif action.get('type') == 'send_email':
                try:
                    account_id = int(action.get('account_id'))
                except ValueError:
                    return 'The action "send_email" of node %s is invalid: account_id invalid' % node.get('name')
                subject = action.get('subject')
                send_to = action.get('send_to')
                msg = action.get('default_msg')
                if not (subject and send_to and msg):
                    return 'The action "send_email" of node %s is invalid: subject or send_to or default_msg invalid' % node.get('name')
            elif action.get('type') == 'send_wechat':
                try:
                    account_id = int(action.get('account_id'))
                except ValueError:
                    return 'The action "send_wechat" of node %s is invalid: account_id invalid' % node.get('name')
                msg = action.get('default_msg')
                if not msg:
                    return 'The action "send_wechat" of node %s is invalid: default_msg invalid' % node.get('name')
            elif action.get('type') == 'send_dingtalk':
                try:
                    account_id = int(action.get('account_id'))
                except ValueError:
                    return 'The action "send_dingtalk" of node %s is invalid: account_id invalid' % node.get('name')
                msg = action.get('default_msg')
                if action.get('msg_type') == 'markdown':
                    title = action.get('default_title')
                    if not title:
                        return 'The action "send_dingtalk" of node %s is invalid: default_title invalid' % node.get('name')
                if not msg:
                    return 'The action "send_dingtalk" of node %s is invalid: default_msg invalid' % node.get('name')
            elif action.get('type') == 'run_python_script':
                script_name = action.get('script_name')
                if not script_name:
                    return 'The action "run_python_script" of node %s is invalid: script_name invalid' % node.get('name')
            elif action.get('type') == 'add_record_to_other_table':
                dst_table_id = action.get('dst_table_id')
                row = action.get('row')
                if not dst_table_id:
                    return 'The action "add_record_to_other_table" of node %s is invalid: dst_table_id invalid' % node.get('name')
                if not row or not isinstance(row, dict):
                    return 'The action "add_record_to_other_table" of node %s is invalid: row invalid' % node.get('name')

    if not init_node:
        return 'No init node'

    for node in nodes:
        if canceled_node and node.get('next_node_id') == canceled_node['_id']:
            return 'The next node of node %s is a canceled node' % node['name']
        if node.get('next_node_id') == node['_id']:
            return 'The next node of node %s is its self' % node['name']
        if node.get('next_node_id') == init_node['_id']:
            return 'The next node of node %s is the init node' % node['name']

        for condition_next_node in node.get('conditional_next_nodes') or []:
            error_msg = check_required_fields(condition_next_node, [
                {'type': str, 'name': '_id'},
                {'type': str, 'name': 'next_node_id'},
                {'type': list, 'name': 'filters'},
            ])
            if error_msg:
                return error_msg
            condition_next_node_id = condition_next_node['next_node_id']
            if canceled_node and condition_next_node_id == canceled_node['_id']:
                return 'The next node of conditional node %s is a canceled node' % node['name']
            if condition_next_node_id == node['_id']:
                return 'The condition next node of node %s is its self' % node['name']

    return None


def check_dynamic_participants_columns(workflow_config, workflow_table):
    """
    return: error_msg -> str or None
    """
    dynamic_participants_nodes = get_dynamic_participants_nodes_from_config(workflow_config)
    for node in dynamic_participants_nodes:
        node_participants_column_key = node.get('node_participants_column_key')
        node_participants_column = get_column_from_table(workflow_table, node_participants_column_key, column_type=ColumnTypes.COLLABORATOR)
        if not node_participants_column:
            return 'Column %s of node %s not found' % node_participants_column_key, node['name']
    return None


def get_metadata(dtable_uuid):
    dtable_server_api = DTableServerAPI('workflow', str(dtable_uuid), dtable_server_url)
    return dtable_server_api.get_metadata()


def get_table_from_metadata(metadata, table_id):
    """
    return table -> dict or None
    """
    for table in metadata.get('tables', []):
        if table['_id'] == table_id:
            return table
    return None


def get_table_from_metadata_by_name(metadata, table_name):
    for table in metadata.get('tables', []):
        if table['name'] == table_name:
            return table
    return None


def get_column_from_table(table, column_key, column_type=None):
    """
    return column -> dict or None
    """
    if not table:
        return None
    for column in table.get('columns', []):
        if column['key'] == column_key:
            if not column_type:
                return column
            if column_type and column['type'] == column_type:
                return column
    return None


def get_table_and_column_from_metadata(metadata, table_id, column_key, column_type=None):
    """
    return table -> dict or None, state -> dict or None
    """
    target_table = get_table_from_metadata(metadata, table_id)
    if not target_table:
        return None, None
    target_column = get_column_from_table(target_table, column_key, column_type=column_type)
    return target_table, target_column


def create_options(dtable_uuid, table_name, column_name, options):
    """
    create state options

    :param options: a list of states, [str...]

    :return options -> list or None, error_msg -> str or None
    """
    if not options:
        return None, None
    dtable_server_api = DTableServerAPI('workflow', dtable_uuid, dtable_server_url)
    try:
        resp_json = dtable_server_api.create_column_options(table_name, column_name, [gen_random_option(option) for option in options], return_options=True)
    except Exception as e:
        logger.exception('dtable: %s create table: %s, state column: %s error: %s', dtable_uuid, table_name, column_name, e)
        return None, 'dtable: %s create table: %s, state column: %s error: %s' % (dtable_uuid, table_name, column_name, e)
    return resp_json['options'], None


def remove_options_by_ids(dtable_uuid, table_name, column_name, option_ids):
    """
    remove options

    :param option_names: option_names

    :return: error_msg -> str
    """
    option_ids = [oid for oid in option_ids if oid] if option_ids else None
    if not option_ids:
        return None
    dtable_server_api = DTableServerAPI('workflow', str(dtable_uuid), dtable_server_url)
    try:
        dtable_server_api.remove_column_options(table_name, column_name, option_ids)
    except Exception as e:
        logger.exception('dtable: %s remove table: %s column: %s options: %s error: %s', dtable_uuid, table_name, column_name, option_ids, e)


def update_options(dtable_uuid, table_name, column_name, options):
    """
    update options

    :param options: a list of options {'id': 'xxx', 'name': 'yyy'}

    :return options: a list of options -> dict or None, error_msg -> str or None
    """
    if not options:
        return None, None
    dtable_server_api = DTableServerAPI('workflow', str(dtable_uuid), dtable_server_url)
    try:
        resp_json = dtable_server_api.update_column_options(table_name, column_name, options, return_options=True)
    except Exception as e:
        logger.exception('update dtable: %s table: %s column: %s options: %s error: %s', dtable_uuid, table_name, column_name, options, e)
        return None, 'update dtable: %s table: %s column: %s options: %s error: %s' % (dtable_uuid, table_name, column_name, options, e)
    return resp_json['options'], None


def update_column_permission(dtable, target_table, column, permission_type='none'):
    options = {
        'table_id': target_table['_id'],
        'column_key': column['key'],
        'op_type': 'modify_column_permission',
        'new_column_permission': {
            'permission_type': permission_type,
            'permitted_users': []
        },
        'table_name': target_table['name'],
        'column': column['name']
    }
    dtable_server_api = DTableServerAPI('workflow', str(dtable.uuid), dtable_server_url)
    try:
        dtable_server_api.update_column(options)
    except Exception as e:
        logger.error('update dtable: %s table: %s column: %s permission error: %s', dtable.uuid, target_table['name'], column['name'], e)
        raise Exception('update dtable: %s table: %s column: %s permission error: %s' % (dtable.uuid, target_table['name'], column['name'], e))


def get_name_from_config(workflow_config):
    if not isinstance(workflow_config, dict):
        workflow_config = json.loads(workflow_config)
    return workflow_config.get('workflow_name')


def get_nodes_from_config(workflow_config):
    if not isinstance(workflow_config, dict):
        workflow_config = json.loads(workflow_config)
    nodes = workflow_config.get('nodes', [])
    return nodes


def get_init_node_from_config(workflow_config):
    if not isinstance(workflow_config, dict):
        workflow_config = json.loads(workflow_config)
    nodes = workflow_config.get('nodes')
    if not nodes:
        return None
    for node in nodes:
        if node.get('type') == NODE_TYPE_INIT:
            return node
    return None


def get_finish_node_from_config(workflow_config):
    if not isinstance(workflow_config, dict):
        workflow_config = json.loads(workflow_config)
    nodes = workflow_config.get('nodes')
    if not nodes:
        return None
    for node in nodes:
        if node.get('type') == NODE_TYPE_COMPLETED:
            return node
    return None


def get_canceled_node_from_config(workflow_config):
    if not isinstance(workflow_config, dict):
        workflow_config = json.loads(workflow_config)
    nodes = workflow_config.get('nodes')
    if not nodes:
        return None
    for node in nodes:
        if node.get('type') == NODE_TYPE_CANCELED:
            return node
    return None


def get_specific_node_from_config(workflow_config, node_id):
    if not isinstance(workflow_config, dict):
        workflow_config = json.loads(workflow_config)
    nodes = workflow_config.get('nodes')
    if not nodes:
        return
    for node in nodes:
        if node.get('_id') == node_id:
            return node
    return None


def get_table_id_from_config(workflow_config):
    if not isinstance(workflow_config, dict):
        workflow_config = json.loads(workflow_config)
    return workflow_config.get('table_id')


def get_state_column_key_from_config(workflow_config):
    if not isinstance(workflow_config, dict):
        workflow_config = json.loads(workflow_config)
    return workflow_config.get('state_column_key')


def get_participants_column_key_from_config(workflow_config):
    if not isinstance(workflow_config, dict):
        workflow_config = json.loads(workflow_config)
    return workflow_config.get('participants_column_key')


def get_dynamic_participants_nodes_from_config(workflow_config):
    if not isinstance(workflow_config, dict):
        workflow_config = json.loads(workflow_config)
    nodes = get_nodes_from_config(workflow_config)
    result_nodes = []
    for node in nodes:
        if node['type'] != NODE_TYPE_NORMAL:
            continue
        if node.get('participants_type') == 'dynamic':
            result_nodes.append(node)
    return result_nodes


def get_dynamic_participants_column_keys(workflow_config):
    nodes = get_dynamic_participants_nodes_from_config(workflow_config)
    if not nodes:
        return []
    return [node['node_participants_column_key'] for node in nodes if node.get('node_participants_column_key')]


def get_readwrite_columns(node):
    node_form = node.get('node_form')
    if not node_form:
        return []
    readwrite_columns = node_form.get('readwrite_columns')
    if not readwrite_columns:
        return []
    return [col for col in readwrite_columns]


def get_valid_node_ids_from_config(node, workflow_config):
    if not isinstance(workflow_config, dict):
        workflow_config = json.loads(workflow_config)
    valid_node_ids = []
    if node.get('next_node_id'):
        valid_node_ids.append(node['next_node_id'])
    if node.get('other_node_ids'):
        valid_node_ids.extend(node['other_node_ids'])
    nodes = get_nodes_from_config(workflow_config)
    all_node_ids = {node['_id'] for node in nodes if node['type'] != NODE_TYPE_INIT}
    return [node_id for node_id in valid_node_ids if node_id in all_node_ids]


def get_valid_nodes_from_config(node, workflow_config):
    if not isinstance(workflow_config, dict):
        workflow_config = json.loads(workflow_config)
    valid_node_ids = set()
    if node.get('next_node_id'):
        valid_node_ids.add(node['next_node_id'])
    if node.get('other_node_ids'):
        valid_node_ids |= set(node['other_node_ids'])
    nodes = get_nodes_from_config(workflow_config)
    return [node for node in nodes if node['_id'] in valid_node_ids]


def get_the_other_nodes_from_config(node, workflow_config):
    if not isinstance(workflow_config, dict):
        workflow_config = json.loads(workflow_config)
    nodes = get_nodes_from_config(workflow_config)
    nodes_dict = {node['_id']: node for node in nodes}
    init_node = get_init_node_from_config(workflow_config)
    result_nodes = [init_node]
    flag_node_ids = {init_node['_id']}
    while True:
        last_node = result_nodes[-1]
        next_node = nodes_dict.get(last_node.get('next_node_id'))
        if next_node and next_node['_id'] not in flag_node_ids:
            result_nodes.append(next_node)
            flag_node_ids.add(next_node['_id'])
        else:
            break
    result_nodes.extend([n for n in nodes if n['_id'] not in flag_node_ids and n['type'] != NODE_TYPE_CANCELED])
    return [n for n in result_nodes if n['_id'] != node['_id']]


def get_column_config_from_config(workflow_config):
    if not isinstance(workflow_config, dict):
        workflow_config = json.loads(workflow_config)
    return workflow_config.get('columns_config', {})


def get_is_send_finish_task_message_from_config(workflow_config):
    if not isinstance(workflow_config, dict):
        workflow_config = json.loads(workflow_config)
    return workflow_config.get('is_send_finish_task_message', True)


def get_finish_task_message_from_config(workflow_config):
    if not isinstance(workflow_config, dict):
        workflow_config = json.loads(workflow_config)
    return workflow_config.get('finish_task_message')


def get_can_cancel_task(workflow_config):
    if not isinstance(workflow_config, dict):
        workflow_config = json.loads(workflow_config)
    return workflow_config.get('can_cancel_task', False)


def get_can_any_user_submit_via_link(workflow_config):
    if not isinstance(workflow_config, dict):
        workflow_config = json.loads(workflow_config)
    return workflow_config.get('can_any_user_submit_via_link', False)


def get_filled_task_message(task):
    """
    fill finish task message according to workflow config
    if not set finish_task_message, return directly

    :param task: an instance of DTableWorkflowTask
    :param table: workflow table

    :return: message -> str or None
    :raise: some error if needed
    """
    row_id = task.row_id
    workflow_config = json.loads(task.dtable_workflow.workflow_config)
    finish_task_message = get_finish_task_message_from_config(workflow_config)
    # if not set
    if not finish_task_message:
        return None

    # get table
    dtable_uuid = task.dtable_workflow.dtable_uuid
    table_id = get_table_id_from_config(workflow_config)
    metadata = get_metadata(dtable_uuid)
    temp_tables = list(filter(lambda x: x.get('_id') == table_id, metadata.get('tables', [])))
    if not temp_tables:
        raise Exception('task table not found')
    table = temp_tables[0]

    # query row
    sql = "SELECT * FROM `%s` where _id='%s'" % (table.get('name'), row_id)
    url = INNER_DTABLE_DB_URL.strip('/') + '/api/v1/query/%s/?from=dtable_web' % str(UUID(dtable_uuid))
    dtable_db_api = DTableDBAPI('dtable_web', str(UUID(dtable_uuid)), INNER_DTABLE_DB_URL)
    try:
        rows = dtable_db_api.query(sql, server_only=True)['results']
    except Exception as e:
        raise Exception('request task: %s, sql: %s error status code: %s', task.id, sql, e)
    if not rows:
        raise Exception('request task: %s, row: %s not found', task.id, task.row_id)
    row = rows[0]

    # fill
    finish_task_message = fill_message_with_sql_row(finish_task_message, table['columns'], row)

    return finish_task_message

def migrate_workflow_images(row_data, image_col_names, dtable):
    """
    migrate workflow images from form dir to general asset file
    """
    for name in image_col_names:
        image_links = row_data.get(name)
        if not image_links:
            continue
        new_links = []
        for link in image_links:
            new_link = migrate_image(link, dtable, PUBLIC_FORMS_RELATIVE_PATH, UPLOAD_IMG_RELATIVE_PATH)
            if not new_link:
                new_links.append(link)
            else:
                new_links.append(new_link)
        row_data[name] = new_links
    return row_data

def migrate_workflow_long_text_images(row_data, long_text_col_names, dtable):
    """
    migrate workflow long text images from form dir to general asset file
    """
    for name in long_text_col_names:
        if name not in row_data:
            continue
        long_text_value = row_data.get(name) or {}
        if (isinstance(long_text_value, str)):
            continue
        long_text_images = long_text_value.get('images', [])
        if (len(long_text_images) == 0):
            row_data[name] = long_text_value
        else:
            long_text_text = long_text_value.get('text', '')
            new_long_text_images = []
            for long_text_image in long_text_images:
                new_link = migrate_image(long_text_image, dtable, PUBLIC_FORMS_RELATIVE_PATH, UPLOAD_IMG_RELATIVE_PATH)
                if not new_link:
                    new_link = long_text_image
                new_long_text_images.append(new_link)
                long_text_text = long_text_text.replace(long_text_image.strip(), new_link)
                long_text_value['text'] = long_text_text
            long_text_value['images'] = new_long_text_images
            row_data[name] = long_text_value
    return row_data

def migrate_workflow_digital_sign_images(row_data, digital_sign_col_names, dtable):
    workspace_id = dtable.workspace_id
    for name in digital_sign_col_names:
        digital_sign_dict = row_data.get(name)
        if not digital_sign_dict or not isinstance(digital_sign_dict, dict) or not digital_sign_dict.get('sign_image_url'):
            continue
        sign_image_url = digital_sign_dict.get('sign_image_url')
        domain_sign_image_url = '%s/%s' % (DTABLE_WEB_SERVICE_URL.rstrip('/'), reverse('dtable:dtable_asset_access', args=(workspace_id, str(dtable.uuid), parse.unquote(sign_image_url.strip('/')))).strip('/'))
        new_link = migrate_image(domain_sign_image_url, dtable, PUBLIC_FORMS_RELATIVE_PATH, UPLOAD_DIGITAL_SIGNS_RELATIVE_PATH)
        if not new_link:
            new_link = sign_image_url
        else:
            new_link = new_link[new_link.find('/digital-signs'):]
        digital_sign_dict['sign_image_url'] = new_link
        row_data[name] = digital_sign_dict
    return row_data

def create_option(dtable_uuid, table_name, state_column_name, node_id, node_name, workflow_config):
    """
    create a new single-select option named node_name

    return new workflow_config
    """
    workflow_server_api = DTableServerAPI('workflow', str(dtable_uuid), dtable_server_url)
    try:
        resp_json = workflow_server_api.create_column_options(table_name, state_column_name, [gen_random_option(node_name)], return_options=True)
    except Exception as e:
        logger.exception('dtable: %s create table: %s, state column: %s, option: %s error: %s', dtable_uuid, table_name, state_column_name, node_name, e)
        raise Exception('dtable: %s create table: %s, state column: %s, option: %s error: %s' % (dtable_uuid, table_name, state_column_name, node_name, e))
    # workflow_server_api
    option = resp_json['options'][0]
    new_workflow_config = deepcopy(workflow_config)
    for node in new_workflow_config['nodes']:
        if node['_id'] == node_id:
            node['state_option_id'] = option['id']
    return new_workflow_config


def update_participants_cell(dtable_uuid, table_name, row_id, participants_column_key, participants):
    workflow_server_api = DTableServerAPI('workflow', str(dtable_uuid), dtable_server_url)
    updates = [{
        'row_id': row_id,
        'row': {participants_column_key: participants}
    }]
    try:
        workflow_server_api.batch_update_rows(table_name, updates, need_convert_back=False)
    except Exception as e:
        logger.exception('dtable: %s table: %s update participants: %s updates: %s error: %s', dtable_uuid, table_name, participants_column_key, updates, e)
        raise Exception('dtable: %s table: %s update participants: %s updates: %s error: %s' % (dtable_uuid, table_name, participants_column_key, updates, e))


def update_state_cell(dtable, workflow, target_table, state_column, row_id, option_id):
    """
    update state cell to option_id
    """
    workflow_server_api = DTableServerAPI('workflow', str(dtable.uuid), dtable_server_url)
    updates = [{
        'row_id': row_id,
        'row': {state_column['key']: option_id}
    }]
    try:
        workflow_server_api.batch_update_rows(target_table['name'], updates, need_convert_back=False)
    except Exception as e:
        logger.exception('flow: %s dtable: %s table: %s update state: %s updates: %s error: %s', workflow.id, dtable.uuid, target_table['name'], state_column['name'], updates, e)
        raise Exception('flow: %s dtable: %s table: %s update state: %s updates: %s error: %s' % (workflow.id, dtable.uuid, target_table['name'], state_column['name'], updates, e))


def can_table_create_workflow(dtable_uuid, workflow_config):
    """
    Forbidden create multi workflows in a table of a base
    """
    from seahub.dtable_apps.workflow.models import DTableWorkflows

    workflows = list(DTableWorkflows.objects.get_workflows_by_dtable_uuid(dtable_uuid))
    table_id = get_table_id_from_config(workflow_config)
    for workflow in workflows:
        existed_table_id = get_table_id_from_config(workflow.workflow_config)
        if table_id and existed_table_id and table_id == existed_table_id:
            return False
    return True


def can_submit_workflow_task(workflow, user, user_groups=None, user_group_ids=None):
    """
    check whether user can submit workflow task

    1. must shared
        1. group member
        2. members of groups shared with
    2. not need shared
    """
    from seahub.dtable_apps.workflow.models import DTableWorkflowShare

    org_id = user.org.org_id if user.org else -1
    username = user.username

    if get_can_any_user_submit_via_link(workflow.workflow_config):
        return True

    try:
        group_id = workflow.owner.split('@')[0]
    except:
        return False

    # group member
    if is_group_member(group_id, username):
        return True

    # member of groups shared with
    wf_shares = list(DTableWorkflowShare.objects.get_shares_by_workflow(workflow))
    shared_group_ids = set(wf_share.group_id for wf_share in wf_shares)
    if user_groups and not user_group_ids:
        user_group_ids = {group.id for group in user_groups}
    elif not user_groups and user_group_ids:
        user_group_ids = set(user_group_ids)
    elif not user_groups and not user_groups:
        user_groups = get_user_groups(username)
        user_group_ids = {group.id for group in user_groups}
    else:
        user_group_ids = set(user_group_ids)
    return shared_group_ids & user_group_ids


def can_list_workflow_task_logs(workflow_task, username):
    """
    check whether user can list task logs

    1. initiator
    2. the participants who transfered logs
    3. the participants who can transfer
    4. admin

    Perhaps allow admins or other users can list in future, so update this funciton continuously
    """
    from seahub.dtable_apps.workflow.models import DTableWorkflowTaskLogs, DTableWorkflowTaskParticipants

    # initiator
    if workflow_task.initiator == username:
        return True

    # who transfered
    can_list = DTableWorkflowTaskLogs.objects.has_participated(workflow_task, username)
    if can_list:
        return True

    # who will transfer
    can_transfer = DTableWorkflowTaskParticipants.objects.can_transfer(workflow_task, username)
    if can_transfer:
        return True

    # who is the owner of the workflow
    try:
        group_id = int(workflow_task.dtable_workflow.owner.split('@')[0])
    except:
        logger.warning('workflow: %s owner: %s invalid', workflow_task.dtable_workflow.id, workflow_task.dtable_workflow.owner)
        return False
    if is_group_admin_or_owner(group_id, username):
        return True

    return False


def can_view_task_asset(username, path, workflow_token=None, task_id=None, task=None, column_key=None, column_type=None):
    """
    can user view asset
    1. admin
    2. participant
    3. initiator
    """
    from seahub.dtable_apps.workflow.models import DTableWorkflowTasks, DTableWorkflowTaskLogs, DTableWorkflowTaskParticipants

    if not task:
        if not workflow_token or not task_id:
            return False
        task = DTableWorkflowTasks.objects.get_task_by_token_id(workflow_token, task_id)
        if not task:
            return False
    workflow = task.dtable_workflow
    workflow_config = json.loads(workflow.workflow_config)

    # admin
    try:
        group_id = int(workflow.owner.split('@')[0])
    except:
        logger.warning('workflow: %s owner: %s is not group', workflow.token, workflow.owner)
        return False

    if is_group_admin_or_owner(group_id, username):
        return True

    # participant
    if DTableWorkflowTaskLogs.objects.has_participated(task, username) or \
        DTableWorkflowTaskParticipants.objects.can_transfer(task, username):
        return True

    table_id = get_table_id_from_config(workflow_config)
    dtable_server_api = DTableServerAPI(username, workflow.dtable_uuid, dtable_server_url)
    metadata = dtable_server_api.get_metadata()
    table = next(filter(lambda table: table['_id'] == table_id, metadata['tables']), None)
    if not table:
        return False

    # initiator
    ## request row and compare path and values in row
    if task.initiator == username and column_key and column_type:
        sql = f"SELECT * FROM `{table['name']}` WHERE _id='{task.row_id}'"
        dtable_db_api = DTableDBAPI('dtable_web', workflow.dtable_uuid, INNER_DTABLE_DB_URL)
        rows = dtable_db_api.query(sql, server_only=True)['results']
        if not rows:
            return False
        row = rows[0]
        value = row.get(column_key)
        if not value:
            return False
        if column_type == ColumnTypes.IMAGE:
            if not isinstance(value, list):
                return False
            for img in value:
                if isinstance(img, str) and path in parse.unquote(img):
                    return True
        elif column_type == ColumnTypes.FILE:
            if not isinstance(value, list):
                return False
            for file in value:
                if isinstance(file, dict) and path in parse.unquote(file.get('url', '')):
                    return True
        elif column_type == ColumnTypes.LONG_TEXT:
            if isinstance(value, dict):
                for image in value.get('images', []):
                    if path in parse.unquote(image):
                        return True
            elif isinstance(value, str):
                return path in parse.unquote(value)
        elif column_type == ColumnTypes.DIGITAL_SIGN:
            if not isinstance(value, dict):
                return False
            return path in parse.unquote(value.get('sign_image_url'))

    return False


def is_valid_workflow_jwt(auth, workflow_token, return_payload=False):
    """
    can decode a valid jwt payload
    """
    is_valid, payload = False, None
    if not auth or auth[0].lower() not in AUTHORIZATION_PREFIX or len(auth) != 2:
        return (is_valid, payload) if return_payload else is_valid

    token = auth[1]
    if not token or not workflow_token:
        return (is_valid, payload) if return_payload else is_valid

    try:
        payload = jwt.decode(token, DTABLE_PRIVATE_KEY, algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        is_valid = False
    else:
        if str(UUID(payload['token'])) != str(UUID(workflow_token)):
            is_valid = False
        else:
            is_valid = True

    if return_payload:
        return is_valid, payload
    return is_valid


def get_next_node_id(nodes, node, dtable_uuid, table, row_id):
    """
    get next_node_id of node
    1. if no conditional_next_nodes in node, return node['_id']
    2. else judge conditions in conditional_next_nodes one by one

    :return: next_node_id -> str
    """
    conditional_next_nodes = node.get('conditional_next_nodes')
    if not conditional_next_nodes or not isinstance(conditional_next_nodes, list):
        return node.get('next_node_id')

    import dtable_events

    node_ids = [node['_id'] for node in nodes]

    for next_node in conditional_next_nodes:
        if not isinstance(next_node, dict):
            continue
        if next_node.get('next_node_id') not in node_ids:
            continue
        filters = next_node.get('filters', [])
        filter_conjunction = next_node.get('filter_conjunction', 'And')
        filter_conditions = {
            'filters': filters,
            'filter_conjunction': filter_conjunction
        }
        try:
            sql = dtable_events.filter2sql(
                table['name'],
                table['columns'],
                filter_conditions,
                by_group=False
            )
        except dtable_events.SQLGeneratorOptionInvalidError as e:
            logger.warning('dtable_uuid: %s table_name: %s next_node: %s condition: %s option invalid', dtable_uuid, table['name'], next_node, filter_conditions)
            continue
        except dtable_events.DateTimeQueryInvalidError as e:
            logger.warning('dtable_uuid: %s table_name: %s next_node: %s condition: %s time query invalid', dtable_uuid, table['name'], next_node, filter_conditions)
            continue
        except Exception as e:
            logger.exception(e)
            logger.error('dtable_uuid: %s table_name: %s next_node: %s filter2sql error: %s', dtable_uuid, table['name'], next_node, e)
            continue
        sql = sql.replace('*', 'COUNT(*) AS count', 1)
        sql = sql[:sql.find('LIMIT')]
        if 'WHERE' not in sql:
            logger.warning('dtable_uuid: %s table_name: %s next_node: %s filter2sql no WHERE clause', dtable_uuid, table['name'], next_node)
            continue
        sql = sql[:sql.find('WHERE')] + " WHERE (%s) AND `_id`='%s'" % (
            sql[sql.find('WHERE')+len('WHERE '):], row_id
        )
        dtable_db_api = DTableDBAPI('dtable_web', dtable_uuid, INNER_DTABLE_DB_URL)
        try:
            rows = dtable_db_api.query(sql, server_only=True)['results']
            if not rows:
                logger.error('dtable_uuid: %s table_name: %s next_node: %s sql: %s query error resp.text: %s', dtable_uuid, table['name'], next_node, sql, resp.text)
                continue
            if rows[0]['count'] == 1:
                return next_node['next_node_id']
        except Exception as e:
            logger.exception(e)
            logger.error('dtable_uuid: %s table_name: %s next_node: %s sql: %s query error: %s', dtable_uuid, table['name'], next_node, sql, e)

    return node.get('next_node_id')
