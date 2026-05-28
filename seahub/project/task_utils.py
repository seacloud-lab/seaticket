import base64
import re
import requests

from seahub.utils.storage import get_project_file_from_s3


_IMAGE_MARKDOWN_RE = re.compile(r'!\[([^\]]*)\]\(([^\)]+)\)')

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
    text = description.get('text', '')
    images = set(description.get('images'))
    if not images:
        # Also extract image URLs from markdown in text
        for _alt, url in _IMAGE_MARKDOWN_RE.findall(text):
            images.add(url)
    if not images:
        return None
    image_data_map = {}
    file_prefix = f'/file/project/{project_uuid}/'
    for file_url in images:
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
        response_json = response.json() if response.content else {}
    except ValueError:
        response_json = {}

    created_task = {}
    print(response_json, '----response json')
    if isinstance(response_json, dict) and isinstance(response_json.get('task'), dict):
        created_task.update(response_json['task'])
    created_task = {**task_payload, **created_task}
    if created_task.get('task_id') in (None, '') and created_task.get('id') not in (None, ''):
        created_task['task_id'] = str(created_task.get('id'))
    return created_task

def update_general_task_via_adapter(connection_config, source_task_id, task_payload):
    endpoint = build_general_task_endpoint(connection_config.get('base_url'), source_task_id)
    headers = get_general_task_headers(connection_config)
    response = requests.post(endpoint, json=task_payload, headers=headers, timeout=60)
    if response.status_code >= 400:
        raise ValueError(response.text or 'Update general task failed.')
    response_json = response.json() if response.content else {}
    updated_task = {}
    if isinstance(response_json, dict) and isinstance(response_json.get('task'), dict):
        updated_task.update(response_json['task'])
    return {
        **task_payload,
        **updated_task,
        'id': str(source_task_id),
    }
