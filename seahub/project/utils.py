import os
import re
import logging
import jwt
import time
import requests
import hashlib
import json
from urllib.parse import urljoin, quote_plus
from datetime import datetime, timezone

from seahub.project.models import Projects, DeletedProjects, ConnectionsViews, \
    StatsAIByTeam, StatsAIByOwner, Workspaces
from seahub.chats.models import ChatSessions
from seahub.chats.utils import delete_session
from seahub.tickets.models import TicketViews
from seahub.knowledge_base.models import KnowledgeBaseViews
from django.db.models import Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone as django_timezone
from seahub.organizations.models import OrgSettings, OrgMemberQuota
from seahub.role_permissions.utils import get_enabled_role_permissions_by_role
from seahub.role_permissions.models import UserRole
from seahub.group.utils import is_group_admin_or_owner, is_group_member
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.auth.models import EmailUser
from seahub.group.models import Group, GroupUser
from seahub.group.utils import get_user_groups, group_id_to_name
from seahub.api2.utils import get_user_common_info

from seahub.settings import SEAQA_INDEXER_INNER_SERVER_URL, JWT_PRIVATE_KEY,\
    SEAQA_AI_INNER_SERVER_URL, SEAQA_EVENTS_INNER_SERVER_URL
from seahub.constants import PERMISSION_READ_WRITE, ORG_DEFAULT, DEFAULT_USER
from seahub.utils import s3_client
from seahub.settings import S3_FILE_BUCKET, S3_WEB_CRAWL_BUCKET
from seahub.project.seadb_api import SeaDBAPI


logger = logging.getLogger(__name__)


def check_project_limit(workspace, request):
    from seahub.settings import PERSONAL_PROJECT_LIMIT, GROUP_PROJECT_LIMIT, FREE_ORG_PROJECT_LIMIT
    org_id = workspace.org_id
    if org_id != -1 and not request.user.permissions.can_use_advanced_permissions():
        org_project_count = Projects.objects.filter(deleted=False, workspace__org_id=org_id).select_related('workspace').count()
        if org_project_count >= FREE_ORG_PROJECT_LIMIT:
            return False

    try:
        project_count = Projects.objects.filter(workspace=workspace, deleted=False).count()
    except Exception as e:
        logger.error('check workspace %d project count error, invalid error: %s', workspace.id, e)
        return False

    owner = workspace.owner
    if '@seafile_group' in owner:
        return project_count < GROUP_PROJECT_LIMIT

    return project_count < PERSONAL_PROJECT_LIMIT


def check_project_admin_permission(username, owner):
    """Check workspace/project access permission of an admin.
    """
    if '@seafile_group' in owner:
        group_id = int(owner.split('@')[0])
        if is_group_admin_or_owner(group_id, username):
            return True
        else:
            return False

    else:
        if username == owner:
            return True
        else:
            return False


def check_project_permission(username, workspace_owner, project=None):
    """Check workspace/project access permission of a user.
    """
    if not username:
        logger.warning('Username is empty')
        return None

    if '@seafile_group' in workspace_owner:
        group_id = int(workspace_owner.split('@')[0])
        if is_group_member(group_id, username):
            return PERMISSION_READ_WRITE
    else:
        if username == workspace_owner:
            return PERMISSION_READ_WRITE

    return None


def check_ticket_permission(username, workspace_owner, ticket=None):
    """Check ticket permission of a user.
    """
    if not username or not workspace_owner or not ticket:
        return None

    if ticket.get('creator') == username:
        return PERMISSION_READ_WRITE

    return check_project_permission(username, workspace_owner)


def check_comment_permission(username, workspace_owner, comment=None):
    """Check comment permission of a user.
    """
    if not username or not workspace_owner or not comment:
        return None

    if comment.get('creator') == username:
        return PERMISSION_READ_WRITE

    return check_project_admin_permission(username, workspace_owner)


def get_project_owner(project):
    # return the owner name and the existence of such owner of project
    # if the owner is deleted, return true, else false
    group_id = project.get_owner_group_id()
    if group_id == -1:
        emailuser = EmailUser.objects.get_emailuser(project.creator)
        if not emailuser:
            return '%s (deleted user)' % (email2nickname(project.creator)), True
        return email2nickname(project.creator), False

    group = Group.objects.get_group(int(group_id))
    if not group:
        return '%s (deleted group)' % (group_id,), True
    return '%s (group)' % (group.group_name,), False


def get_project_related_users(owner):
    if '@seafile_group' in owner:
        group_id = int(owner.split('@')[0])
        group_users = GroupUser.objects.filter(group_id=group_id)
        return [get_user_common_info(group_user.user_name) for group_user in group_users]
    else:
        return [get_user_common_info(owner)]


def convert_project_trash_names(project):
    """
    convert project's name to trash name
    """
    assert project.deleted is False
    new_project_name = '_(deleted_' + str(project.id) + ') ' + project.name

    return new_project_name


def restore_trash_project_name(project):
    """
    get trash project's original name and generate old and new .project names
    """
    assert project.deleted is True
    new_project_name = project.name[project.name.find(' ')+1:]

    return new_project_name


def add_connection_sync_task(params):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, JWT_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(SEAQA_INDEXER_INNER_SERVER_URL, '/add-connection-sync-task')
    resp = requests.get(url, params=params, headers=headers)

    return json.loads(resp.content)


def manual_sync_connection(params):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, JWT_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(SEAQA_INDEXER_INNER_SERVER_URL, '/manual-sync-connection')
    resp = requests.post(url, json=params, headers=headers)
    status_code = resp.status_code
    return json.loads(resp.content), status_code


def update_github_issue_by_webhook(params):
    payload = {'exp': int(time.time()) + 300, }
    url = urljoin(SEAQA_INDEXER_INNER_SERVER_URL, '/webhook/github/')
    token = jwt.encode(payload, JWT_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    resp = requests.post(
        url,
        json=params,
        headers=headers,
    )
    resp.raise_for_status()
    return resp


def update_discourse_topic_by_webhook(params):
    connection_id = params.get('connection_id')
    data = params.get('data')
    event_type = params.get('event_type')

    payload = {'exp': int(time.time()) + 300, }
    url = urljoin(SEAQA_INDEXER_INNER_SERVER_URL, '/webhook/discourse/')
    token = jwt.encode(payload, JWT_PRIVATE_KEY, algorithm='HS256')
    headers = {
        "Authorization": "Token %s" % token,
        "X-Discourse-Event": event_type,
    }
    query_params = {'connection_id': connection_id}
    resp = requests.post(
        url,
        params=query_params,
        json=data,
        headers=headers,
    )
    resp.raise_for_status()
    return resp


def find_related_records(params):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, JWT_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": f'Token {token}'}
    url = urljoin(SEAQA_INDEXER_INNER_SERVER_URL, '/summary_vector_search')
    resp = requests.post(url, json=params, headers=headers)
    if resp.status_code == 500:
        raise Exception(f'find related records error status: {resp.status_code} body: {resp.text}')
    resp_json = resp.json()
    results = resp_json.get('results')
    return results


def search(params):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, JWT_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": f'Token {token}'}
    url = urljoin(SEAQA_INDEXER_INNER_SERVER_URL, '/search')
    resp = requests.post(url, json=params, headers=headers)
    if resp.status_code == 500:
        raise Exception(f'search error status: {resp.status_code} body: {resp.text}')
    resp_json = resp.json()
    results = resp_json.get('results')
    return results




def convert_record_to_ticket(params):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, JWT_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(SEAQA_AI_INNER_SERVER_URL, '/convert-record-to-ticket')
    resp = requests.post(url, json=params, headers=headers)
    if resp.status_code == 500:
        raise Exception('convert record to ticket error status: %s body: %s', resp.status_code, resp.text)
    resp_json = resp.json()
    title = resp_json.get('title', '')
    content = resp_json.get('description', '')
    return title, content


def rank_related_issues(params):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, JWT_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(SEAQA_AI_INNER_SERVER_URL, '/rank-related-issues')
    resp = requests.post(url, json=params, headers=headers)
    if resp.status_code == 500:
        raise Exception(f'rank related records error status: {resp.status_code} body: {resp.text}')
    resp_json = resp.json()
    ranked_ids = resp_json.get('ranked_ids', [])
    return ranked_ids


def gen_s3_file_path(project_uuid, file_path):
    return f'/projects/{project_uuid}/{file_path}'


def gen_s3_web_crawl_file_path(project_uuid, site_id, filename):
    return f"{project_uuid}/{site_id}/" + filename


def gen_tmp_upload_file_path(project_uuid, file_path):
    s3_file_path = gen_s3_file_path(project_uuid, file_path)
    file_name = os.path.basename(file_path)
    tmp_dir = f'/tmp{s3_file_path.replace(file_name, '')}'
    if not os.path.exists(tmp_dir):
        os.makedirs(tmp_dir, exist_ok=True)
    return os.path.join(tmp_dir, file_name)


def upload_file_to_tmp_dir(project_uuid, file):
    file_path = datetime.now(timezone.utc).strftime('%Y-%m') + '/' + file.name
    tmp_upload_file_path = gen_tmp_upload_file_path(project_uuid, file_path)
    with open(tmp_upload_file_path, 'wb') as fd:
        fd.write(file.read())
    return tmp_upload_file_path


def upload_files_to_s3(project_uuid, file_urls, username):
    new_file_urls_dict = {}
    for file_url in file_urls:
        if '/upload-file/project/' not in file_url:
            continue
        file_name = os.path.basename(file_url)
        file_path = file_url.split('/')[-2] + '/' + file_name
        tmp_upload_file_path = gen_tmp_upload_file_path(project_uuid, file_path)
        if not os.path.exists(tmp_upload_file_path):
            logger.warning(tmp_upload_file_path + ' not exists.')
            continue
        s3_file_path = gen_s3_file_path(project_uuid, file_path)
        if check_file_exists_from_s3(s3_file_path):
            logger.warning(s3_file_path + ' already exists.')
            continue
        s3_client.upload_file(tmp_upload_file_path, S3_FILE_BUCKET, s3_file_path, ExtraArgs={'Metadata':{'username':username}})
        new_file_url = file_url.replace('/upload-file/', '/file/')
        new_file_urls_dict[new_file_url] = file_url
        try:
            os.remove(tmp_upload_file_path)
        except Exception as e:
            logger.error(e)
    return new_file_urls_dict


def check_file_exists_from_s3(s3_file_path):
    try:
        s3_client.head_object(Bucket=S3_FILE_BUCKET, Key=s3_file_path)
        return True
    except Exception as e:
        return False


def get_file_from_s3(project_uuid, file_path):
    s3_file_path = gen_s3_file_path(project_uuid, file_path)
    response = s3_client.get_object(Bucket=S3_FILE_BUCKET, Key=s3_file_path)
    file = response['Body']
    return file


def get_file_from_s3_web_crawl(project_uuid, site_id, filename):
    s3_file_path = gen_s3_web_crawl_file_path(project_uuid, site_id, filename)
    response = s3_client.get_object(Bucket=S3_WEB_CRAWL_BUCKET, Key=s3_file_path)
    file = response['Body']
    return file

def delete_file_from_s3(project_uuid, file_path):
    s3_file_path = gen_s3_file_path(project_uuid, file_path)
    s3_client.delete_object(S3_FILE_BUCKET, s3_file_path)
    return s3_file_path


def delete_project_dir_from_s3(project_uuid):
    s3_dir_path = gen_s3_file_path(project_uuid, '')
    response = s3_client.list_objects_v2(Bucket=S3_FILE_BUCKET, Prefix=s3_dir_path)
    objects_to_delete = []
    if 'Contents' in response:
        for obj in response['Contents']:
            objects_to_delete.append({'Key': obj['Key']})
        s3_client.delete_objects(
            Bucket=S3_FILE_BUCKET, Delete={'Objects': objects_to_delete})
        logger.info(f'Deleted {project_uuid} s3 files.')
    return s3_dir_path


def replace_file_url_in_content(content, new_file_urls_dict):
    for new_file_url in new_file_urls_dict:
        old_file_url = new_file_urls_dict[new_file_url]
        content = content.replace(old_file_url, new_file_url)
    return content



def delete_project(project):
    project_uuid = str(project.uuid)
    try:
        DeletedProjects(project_uuid=project_uuid).save()
        Projects.objects.delete_project(project.workspace, project.name)
    except Exception as e:
        logger.error('delete project: %s error: %s', str(project_uuid), e)

    try:
        ConnectionsViews.objects.filter(project_uuid=project_uuid).delete()
        TicketViews.objects.filter(project_uuid=project_uuid).delete()
        KnowledgeBaseViews.objects.filter(project_uuid=project_uuid).delete()
        delete_session_uuids = ChatSessions.objects.filter(project_uuid=project_uuid).values_list('session_uuid', flat=True)
        for session_uuid in set(delete_session_uuids):
            delete_session(session_uuid)
        seadb_api = SeaDBAPI()
        seadb_api.delete_base(project_uuid)
    except Exception as e:
        logger.error(e)

    try:
        delete_project_dir_from_s3(project_uuid)
    except Exception as e:
        logger.error(e)


def get_current_table_metadata(tables, table_name):
    for table in tables:
        if table['name'] == table_name:
            return table
    return None


def url_to_filename(url):
    """
    Convert URL to valid filename
    """
    # Remove protocol prefix
    url = re.sub(r'^https?://', '', url)

    # Replace invalid characters
    filename = quote_plus(url)
    # filename = unquote(urllib.parse.quote_plus(url))

    # Ensure filename doesn't exceed maximum length limit (255 characters)
    if len(filename) > 240:
        # Keep beginning and end, use hash value in the middle
        hash_part = hashlib.md5(url.encode('utf-8')).hexdigest()[:16]
        filename = filename[:110] + '_' + hash_part + '_' + filename[-110:]

    # Add .json extension
    return filename + '.json'

def get_ai_credit_by_org_id(org_id):
    role = ORG_DEFAULT
    os = OrgSettings.objects.filter(org_id=org_id).first()
    if os:
        role = os.role
    ai_credit_per_user = get_enabled_role_permissions_by_role(role).get('ai_credit_per_user', -1)
    if ai_credit_per_user < 0:
        return -1
    max_user = OrgMemberQuota.objects.get_quota(org_id)
    ai_credit = ai_credit_per_user * max_user

    return ai_credit


def get_ai_credit_by_owner_id(owner_id):
    if '@seafile_group' in owner_id:
        return -1

    try:
        user_role = UserRole.objects.get_user_role(owner_id)
        role = user_role.role
    except UserRole.DoesNotExist:
        role = DEFAULT_USER

    ai_credit = get_enabled_role_permissions_by_role(role).get('ai_credit_per_user', -1)
    return ai_credit


def get_ai_cost_by_org_id(org_id):
    month = django_timezone.now().replace(day=1)
    cost = StatsAIByTeam.objects.filter(org_id=org_id, month=month).aggregate(
        total_cost=Coalesce(Sum('cost'), Value(0.0))
    )['total_cost']
    return cost


def get_ai_cost_by_owner_id(owner_id):
    month = django_timezone.now().replace(day=1)
    cost = StatsAIByOwner.objects.filter(owner_id=owner_id, month=month).aggregate(
        total_cost=Coalesce(Sum('cost'), Value(0.0))
    )['total_cost']
    return cost


def check_ai_limit(username, org_id):
    if org_id != -1:
        # Organization user
        credit = get_ai_credit_by_org_id(org_id)
        if credit == -1:
            return False
        cost = get_ai_cost_by_org_id(org_id)
    else:
        # Personal user
        credit = get_ai_credit_by_owner_id(username)
        if credit == -1:
            return False
        cost = get_ai_cost_by_owner_id(username)

    is_exceed = cost >= credit
    return is_exceed


def submit_embedding_analysis_task(params):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, JWT_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": f'Token {token}'}
    url = urljoin(SEAQA_EVENTS_INNER_SERVER_URL, '/add-embedding-analysis-task')
    resp = requests.post(url, json=params, headers=headers)
    if resp.status_code == 500:
        raise Exception(f'submit embedding analysis task error status: {resp.status_code} body: {resp.text}')
    
    response_data = resp.json()
    task_id = response_data.get('task_id')
    if not task_id:
        logger.error('No task_id returned from seaqa-events')
        raise Exception('Failed to submit analysis task.')
    
    return task_id


def get_embedding_analysis_task_status(task_id):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, JWT_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": f'Token {token}'}
    
    url = urljoin(SEAQA_EVENTS_INNER_SERVER_URL, f'/embedding-analysis-task-status')
    params = {'task_id': task_id}
    resp = requests.get(url, headers=headers, params=params)
    if resp.status_code == 500:
        raise Exception(f'get embedding analysis task status error status: {resp.status_code} body: {resp.text}')
    
    response_data = resp.json()
    is_finished = response_data.get('is_finished')
    records = response_data.get('records', [])
    
    return {
        'is_finished': is_finished,
        'records': records
    }


def get_all_available_projects(request):
    username = request.user.username
    groups = get_user_groups(username, return_ancestors=True)
    owner_list = [username] + ['%s@seafile_group' % group.group_id for group in groups]
    workspaces = Workspaces.objects.filter(owner__in=owner_list)
    projects = []
    projects_qs = Projects.objects.filter(workspace__in=workspaces, deleted=False)
    for project in projects_qs:
        info = project.to_dict()
        owner = project.workspace.owner
        if '@seafile_group' in owner:
            group_id = int(owner.split('@')[0])
            info['group_name'] = group_id_to_name(group_id)
            info['type'] = 'group'
        else:
            info['group_name'] = 'personal'
            info['type'] = 'personal'
        projects.append(info)
    return projects


def query_projects(request, query_str):
    all_projects = get_all_available_projects(request)
    query_result = []
    query_str = query_str.lower()
    for p in all_projects:
        name = (p.get('name') or '').lower()
        if query_str in name:
            query_result.append(p)
    return query_result


def query_items(request, query_str, query_type):
    if query_type == 'project':
        return query_projects(request, query_str)
    return []
