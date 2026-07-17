import base64
from datetime import date, datetime, time, timedelta, timezone

import requests

from seahub.utils import time_str_to_utc_time
from seahub.utils.storage import get_project_file_from_s3

GENERAL_TASK_ACTIVITY_FIELDS = ('title', 'status', 'size', 'priority', 'assignees', 'version', 'due_date')
GENERAL_TASK_DUE_DATE_TZ = timezone(timedelta(hours=8))


# general task utils
def build_general_task_endpoint(base_url, task_id=None):
    base_url = (base_url or '').strip()
    if not base_url:
        raise ValueError('General task base_url is required.')
    tasks_url = base_url.rstrip('/')
    if not tasks_url.endswith('/tasks'):
        tasks_url = f'{tasks_url}/tasks'
    if task_id is not None:
        return f'{tasks_url}/{task_id}'
    return f'{tasks_url}/'

def get_general_task_headers(connection_config):
    headers = {}
    api_token = (connection_config.get('api_token') or '').strip()
    if api_token:
        headers['Authorization'] = f'Bearer {api_token}'
    return headers


def prepare_image_data_for_adapter(project_uuid, description):
    if not isinstance(description, dict):
        return None
    images = description.get('images')
    if not images:
        return None
    image_data_map = {}
    file_prefix = f'/file/project/{project_uuid}/'
    for file_url in images:
        if file_url.startswith('http'):
            continue
        file_path = file_url[len(file_prefix):]
        body = get_project_file_from_s3(project_uuid, file_path)
        image_data_map[file_url] = base64.b64encode(body.read()).decode('utf-8')
    return image_data_map if image_data_map else None


def create_general_task_via_adapter(connection_config, task_payload):
    endpoint = build_general_task_endpoint(connection_config.get('base_url'))
    headers = get_general_task_headers(connection_config)
    try:
        response = requests.post(endpoint, json=task_payload, headers=headers, timeout=60)
    except requests.RequestException as e:
        raise ValueError(f'Create general task failed: {e}')
    if response.status_code >= 400:
        raise ValueError(response.text or 'Create general task failed.')

    try:
        created_task = response.json() if response.content else {}
    except ValueError:
        created_task = {}
    return created_task

def update_general_task_via_adapter(connection_config, source_task_id, task_payload):
    endpoint = build_general_task_endpoint(connection_config.get('base_url'), source_task_id)
    headers = get_general_task_headers(connection_config)
    response = requests.post(endpoint, json=task_payload, headers=headers, timeout=60)

    if response.status_code == 404:
        raise ValueError(f'General task {source_task_id} not found in adapter.')
    if response.status_code >= 400:
        raise ValueError(response.text or 'Update general task failed.')
    updated_task = response.json() if response.content else {}
    return updated_task

def normalize_general_task_due_date(value):
    if value in (None, ''):
        return None

    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, date):
        dt = datetime.combine(value, time.min, tzinfo=GENERAL_TASK_DUE_DATE_TZ)
    else:
        value = str(value).strip()
        if not value:
            return None
        if len(value) == 10 and value.count('-') == 2:
            dt = datetime.fromisoformat(value).replace(tzinfo=GENERAL_TASK_DUE_DATE_TZ)
        else:
            dt = time_str_to_utc_time(value).astimezone(GENERAL_TASK_DUE_DATE_TZ)

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=GENERAL_TASK_DUE_DATE_TZ)
    else:
        dt = dt.astimezone(GENERAL_TASK_DUE_DATE_TZ)

    normalized_dt = datetime.combine(dt.date(), time.min, tzinfo=GENERAL_TASK_DUE_DATE_TZ)
    return normalized_dt.isoformat()

def build_general_task_change_values(current_record, row_data, changed_fields):
    old_value = {}
    new_value = {}
    for field in GENERAL_TASK_ACTIVITY_FIELDS:
        if field not in changed_fields:
            continue
        old_field_value = current_record.get(field)
        new_field_value = row_data.get(field)
        if field == 'due_date':
            old_field_value = normalize_general_task_due_date(old_field_value)
            new_field_value = normalize_general_task_due_date(new_field_value)
        if old_field_value != new_field_value:
            old_value[field] = old_field_value
            new_value[field] = new_field_value
    return old_value, new_value
