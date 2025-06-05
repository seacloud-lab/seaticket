import json
import logging
import requests

from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.dtable.models import BoundThirdPartyAccounts
from seahub.dtable_apps.dtable_server_api import DTableServerAPI
from seahub.dtable_apps.workflow.utils import get_specific_node_from_config, get_init_node_from_config
from seahub.utils import get_inner_dtable_server_url
from seahub.settings import DTABLE_WEB_SERVICE_URL

# Handle the message behavior through the workflow transfer, such as wechat, dingtalk and so on

logger = logging.getLogger(__name__)
dtable_server_url = get_inner_dtable_server_url()

INVALID_COLUMNS_TYPES = [
    "image",
    "file",
    "long-text",
    "formula",
    "link",
    "button",
    "digital-sign"
]

def _format_row_data_by_columns(row_data, columns, init_form_columns):
    init_form_columns_keys = [col.get('key') for col in init_form_columns]
    content_list = []
    column_key_name_type_map = {col.get('key'): (col.get('name'), col.get('type')) for col in columns}
    for init_col_key in init_form_columns_keys:
        if init_col_key not in column_key_name_type_map:
            continue
        col_name, col_type = column_key_name_type_map.get(init_col_key)
        value = row_data.get(col_name)
        if col_type in INVALID_COLUMNS_TYPES:
            continue
        elif col_type == 'multiple-select':
            format_value = value and ", ".join(value) or ''
        elif col_type == 'collaborator':
            format_value = value and ", ".join([email2nickname(v) for v in value]) or ''
        elif col_type in ['creator', 'last-modifier']:
            format_value = value and email2nickname(value) or ''
        elif col_type  == 'checkbox':
            format_value = "Yes" if value else "No"
        elif col_type == 'geolocation':
            info_list = []
            if not value:
                value = dict()
            province = value.get('province', '')
            city = value.get('city', '')
            district = value.get('district', '')
            detail = value.get('detail', '')
            country_region = value.get('country_region', '')

            lng = value.get('lng', '')
            lat = value.get('lat', '')

            if country_region:
                info_list.append(country_region)
            if province:
                info_list.append(province)
            if city:
                info_list.append(city)
            if district:
                info_list.append(district)
            if detail:
                info_list.append(detail)

            if lng:
                info_list.append("lng: %s" % lng)
            if lat:
                info_list.append("lat: %s" % lat)

            format_value = info_list and " ".join(info_list) or ""

        elif col_type in ['number', 'rate', 'duration']:
            format_value = str(value)
        else:
            format_value = value

        content_list.append({
            "keyname": col_name,
            "value": format_value
        })

    return content_list


def send_wechat_msg(workflow_name, node, next_node, row_data, webhook_url, columns, init_form_columns):
    node_id = node.get('_id')
    node_name = node.get('name')
    next_node_name = next_node.get('name')
    msg_status = "%s --> %s" % (node_name, next_node_name)
    if node_id == 'init':
        msg_title = "工作流 %s 新增任务" % workflow_name
    else:
        msg_title = "工作流 %s 任务更新" % workflow_name
    content_list = _format_row_data_by_columns(row_data, columns, init_form_columns)
    msg_detail_list = [
        {"keyname": "状态变化", "value": msg_status}
    ]
    msg_detail_list.extend(content_list)
    msg_format = {
        "msgtype": "template_card",
        "template_card": {
            "card_type": "text_notice",
            "source": {
                "icon_url": "https://dev.seatable.cn/media/favicons/seatable-favicon.png",
                "desc": "SeaTable 工作流",
                "desc_color": 0
            },
            "main_title": {
                "title": msg_title
            },
            "sub_title_text": "详情",
            "horizontal_content_list": msg_detail_list[:4],
            "card_action": {
                "type": 1,
                "url": "%s/workflows/" % DTABLE_WEB_SERVICE_URL.rstrip('/'),
            }
        }
    }
    try:
        requests.post(webhook_url, json=msg_format, headers={"Content-Type": "application/json"})
    except Exception as e:
        logger.error('workflow %s task send wechat msg error: %s', workflow_name, e)
        return


def send_dingtalk_msg(workflow_name, node, next_node, row_data, webhook_url, columns, init_form_columns):
    node_id = node.get('_id')
    node_name = node.get('name')
    next_node_name = next_node.get('name')
    msg_status = "%s --> %s" % (node_name, next_node_name)
    if node_id == 'init':
        msg_title = "工作流 %s 新增任务" % workflow_name
    else:
        msg_title = "工作流 %s 任务更新" % workflow_name

    content_list = _format_row_data_by_columns(row_data, columns, init_form_columns)
    msg_detail_list = [
        {"keyname": "状态变化", "value": msg_status}
    ]
    msg_detail_list.extend(content_list)

    text = ''
    for msg in msg_detail_list[:4]:
        text += '- ' + msg.get('keyname') + ' ' + msg.get('value') + '\n\n'

    msg_format = {
        "msgtype": "actionCard",
        "actionCard": {
            "title": msg_title,
            "text": text,
            "btnOrientation": "0",
            "btns": [
                {
                    "title": "跳转到工作流",
                    "actionURL": "%s/workflows/" % DTABLE_WEB_SERVICE_URL.rstrip('/')
                }
            ]
        }
    }

    try:
        requests.post(webhook_url, json=msg_format, headers={"Content-Type": "application/json"})
    except Exception as e:
        logger.error('workflow %s task send dingtalk msg error: %s', workflow_name, e)
        return


def get_webhook_url(third_party_account_id):
    account = BoundThirdPartyAccounts.objects.filter(id=third_party_account_id).first()
    if not account:
        return None

    return account.to_dict().get('detail', {}).get('webhook_url', None)


def transferring_workflow_task_cb(sender, **kwargs):
    workflow = kwargs.get('workflow')
    config = json.loads(workflow.workflow_config)

    flow_task = kwargs.get('flow_task')
    dtable = kwargs.get('dtable')

    row_id = flow_task.row_id
    table_id = config.get('table_id')

    is_send_wechat_message = config.get('is_send_wechat_message', False)
    is_send_dingtalk_message = config.get('is_send_dingtalk_message', False)
    wechat_account_id = config.get('account_id')
    dingtalk_account_id = config.get('dingtalk_account_id')

    wechat_webhook_url = ''
    dingtalk_webhook_url = ''

    if is_send_wechat_message and wechat_account_id:
        wechat_webhook_url = get_webhook_url(wechat_account_id)

    if is_send_dingtalk_message and dingtalk_account_id:
        dingtalk_webhook_url = get_webhook_url(dingtalk_account_id)

    if not wechat_webhook_url and not dingtalk_webhook_url:
        return

    dtable_server_api = DTableServerAPI('workflow', str(dtable.uuid), dtable_server_url)
    try:
        row_data = dtable_server_api.get_row_by_table_id(table_id, row_id)
    except Exception as e:
        logger.exception('flow: %s get table: %s row: %s error: %s', workflow.id, table_id, row_id, e)
        return

    node_id = kwargs.get('node_id')
    next_node_id = kwargs.get('next_node_id')
    table = kwargs.get('table')

    node = get_specific_node_from_config(config, node_id)
    next_node = get_specific_node_from_config(config, next_node_id)
    init_node = get_init_node_from_config(config)
    init_node_form_columns = init_node.get('node_form', {}).get('readwrite_columns', [])

    workflow_name = config.get('workflow_name')
    columns = table.get('columns', [])

    try:
        if wechat_webhook_url:
            send_wechat_msg(workflow_name, node, next_node, row_data, wechat_webhook_url, columns, init_node_form_columns)

        if dingtalk_webhook_url:
            send_dingtalk_msg(workflow_name, node, next_node, row_data, dingtalk_webhook_url, columns, init_node_form_columns)
    except Exception as e:
        logger.exception(e)
        logger.error('send message error: %s', e)
