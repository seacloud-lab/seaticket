import logging
import requests
import jwt
import time
import json
from urllib.parse import urljoin

from django.db.models import Sum, Value
from django.utils import timezone
from django.db.models.functions import Coalesce

from seaserv import ccnet_api

from seahub.dtable.external_app_views import check_universal_app_users
from seahub.dtable.models import DTables, Workspaces, DTableGroupShare, DTableExternalApps
from seahub.group.utils import get_user_groups, is_group_admin_or_owner, is_group_member
from seahub.settings import SEATABLE_AI_SERVER_URL, DTABLE_PRIVATE_KEY
from seahub.utils import is_org_context, uuid_str_to_32_chars
from seahub.api2.authentication import AUTHORIZATION_PREFIX
from seahub.ai.models import AIAssistantOwner, StatsAIByTeam, StatsAIByOwner
from seahub.organizations.models import OrgSettings, OrgMemberQuota
from seahub.constants import ORG_DEFAULT
from seahub.role_permissions.utils import get_enabled_role_permissions_by_role


logger = logging.getLogger(__name__)

SEMANTIC_SEARCH_PREFIX = 'SEMANTIC_SEARCH_'
SEMANTIC_SEARCH_CACHE_TIMEOUT = 24 * 60 * 60


def gen_headers():
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, DTABLE_PRIVATE_KEY, algorithm='HS256')
    return {"Authorization": "Token %s" % token}


def is_valid_jwt(auth, return_payload=False):
    """
    can decode a valid jwt payload
    """
    is_valid, payload = False, None
    if not auth or auth[0].lower() not in AUTHORIZATION_PREFIX or len(auth) != 2:
        return (is_valid, payload) if return_payload else is_valid

    token = auth[1]
    if not token:
        return (is_valid, payload) if return_payload else is_valid

    try:
        payload = jwt.decode(token, DTABLE_PRIVATE_KEY, algorithms=['HS256'])
        is_valid = True
    except:
        is_valid = False

    if return_payload:
        return is_valid, payload
    return is_valid


def get_user_related_dtables(request):
    username = request.user.username
    org_id = -1
    if is_org_context(request):
        org_id = request.user.org.org_id

    groups = get_user_groups(username, return_ancestors=True)

    group_id_list = [group.id for group in groups]
    owner_list = [username] + ['%s@seafile_group' % group_id for group_id in group_id_list]

    workspaces = Workspaces.objects.filter(owner__in=owner_list)

    group_and_personal_dtables = DTables.objects.filter(workspace__in=workspaces, deleted=False)
    group_shared_table_list = DTableGroupShare.objects.filter(
        group_id__in=group_id_list, dtable__deleted=False).select_related('dtable')

    # group and personal tables
    related_dtables = []
    exist_dtables = {}
    for table in group_and_personal_dtables:
        table_info = table.to_dict()
        dtable_uuid = uuid_str_to_32_chars(table_info.get('uuid'))
        related_dtables.append(
            (dtable_uuid, table_info.get('name'), table_info.get('color'), table_info.get('icon'))
        )
        exist_dtables[dtable_uuid] = True

    # shared to group tables
    for table in group_shared_table_list:
        table_info = table.dtable.to_dict()
        dtable_uuid = uuid_str_to_32_chars(table_info.get('uuid'))
        if exist_dtables.get(dtable_uuid):
            continue
        related_dtables.append(
            (table_info.get('uuid'), table_info.get('name'), table_info.get('color'), table_info.get('icon')))

    return related_dtables


def get_ai_assistant(assistant_uuid):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/assistant/' + assistant_uuid + '/')
    resp = requests.get(url, headers=headers, timeout=30)
    return resp


def delete_ai_assistant(assistant_uuid):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/assistant/' + assistant_uuid + '/')
    resp = requests.delete(url, headers=headers, timeout=30)
    return resp


def get_ai_assistants(params):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/assistants/')
    resp = requests.get(url, json=params, headers=headers, timeout=30)
    return resp


def add_ai_assistant(params):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/assistants/')
    resp = requests.post(url, json=params, headers=headers, timeout=30)
    return resp


def update_ai_assistant(assistant_uuid, params):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/assistant/' + assistant_uuid + '/')
    resp = requests.put(url, json=params, headers=headers, timeout=30)
    return resp


def add_assistant_table(assistant_uuid, params):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/assistant/' + assistant_uuid + '/assistant-tables/')
    resp = requests.post(url, json=params, headers=headers, timeout=30)
    return resp


def add_assistant_template_tables(assistant_uuid, params):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/assistant/' + assistant_uuid + '/assistant-template-tables/')
    resp = requests.post(url, json=params, headers=headers, timeout=30)
    return resp


def get_assistant_tables(assistant_uuid, params):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/assistant/' + assistant_uuid + '/assistant-tables/')
    resp = requests.get(url, params=params, headers=headers, timeout=30)
    return resp


def delete_assistant_table(assistant_uuid, params):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/assistant/' + assistant_uuid + '/assistant-table/')
    resp = requests.delete(url, params=params, headers=headers, timeout=30)
    return resp


def extract_task_info(params, image=None):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/task-manager/extract-task-info/')
    resp = requests.post(url, data=params, files=image, headers=headers, timeout=30)
    return resp


def is_assistant_admin(owner, username, admin_group_ids):
    if '@seafile_group' in owner:
        group_id = int(owner.split('@')[0])
        if group_id in admin_group_ids:
            return True
    else:
        if username == owner:
            return True
    return False


def check_assistant_admin_permission(assistant_owner, username):
    if '@seafile_group' in assistant_owner:
        group_id = assistant_owner[:-len('@seafile_group')]
        return is_group_admin_or_owner(group_id, username)
    else:
        if username == assistant_owner:
            return True
    return False


def check_assistant_permission(assistant_owner, request):
    if hasattr(request.user, 'is_auth_by_jwt') and request.user.is_auth_by_jwt:
        return True
    username = request.user.username
    if '@seafile_group' in assistant_owner:
        group_id = assistant_owner[:-len('@seafile_group')]
        return is_group_member(group_id, username)
    else:
        if username == assistant_owner:
            return True
    return False


def add_assistant_member(assistant_uuid, params):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/assistant/' + assistant_uuid + '/assistant-members/')
    resp = requests.post(url, json=params, headers=headers, timeout=30)
    return resp


def get_assistant_members(assistant_uuid):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/assistant/' + assistant_uuid + '/assistant-members/')
    resp = requests.get(url, headers=headers, timeout=30)
    return resp


def delete_assistant_member(assistant_uuid, params):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/assistant/' + assistant_uuid + '/assistant-member/')
    resp = requests.delete(url, params=params, headers=headers, timeout=30)
    return resp


def add_task_record(params):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/task-manager/add-task-record/')
    resp = requests.post(url, json=params, headers=headers, timeout=30)
    return resp

def add_qa_record(params):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/qa/add-qa-record/')
    resp = requests.post(url, json=params, headers=headers, timeout=30)
    return resp

def add_recognition_record(params):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/document-and-receipt-recognition/add-recognition-record/')
    resp = requests.post(url, json=params, headers=headers, timeout=30)
    return resp


def add_issue_record(params):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/issue-manage/add-issue-record/')
    resp = requests.post(url, json=params, headers=headers, timeout=30)
    return resp


def create_table(params):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/task-manager/create-table/')
    resp = requests.post(url, json=params, headers=headers, timeout=30)
    return resp


def tasks_detail(params):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/task-manager/tasks-detail/')
    resp = requests.post(url, json=params, headers=headers, timeout=30)
    return resp


def get_candidate_members(assistant_uuid):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, f'/api/v1/assistant/{assistant_uuid}/candidate-members/')
    resp = requests.get(url, headers=headers, timeout=30)
    return resp


def get_assistant_tables_index(assistant_uuid):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/assistant/' + assistant_uuid + '/tables-index/')
    resp = requests.get(url, headers=headers, timeout=30)
    return resp


def update_assistant_tables_index(assistant_uuid):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/assistant/' + assistant_uuid + '/tables-index/')
    resp = requests.put(url, headers=headers, timeout=30)
    return resp


def tasks_stats_by_assignee(params):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/task-manager/tasks-by-assignee/tasks-stats/')
    resp = requests.post(url, json=params, headers=headers, timeout=30)
    return resp


def assignee_future_tasks(params):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/task-manager/tasks-by-assignee/future-tasks/')
    resp = requests.post(url, json=params, headers=headers, timeout=30)
    return resp


def assignee_task_details(params):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/task-manager/tasks-by-assignee/tasks-details/')
    resp = requests.post(url, json=params, headers=headers, timeout=30)
    return resp


def get_assistant_settings(assistant_uuid):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/assistant/' + assistant_uuid + '/settings/')
    resp = requests.get(url, headers=headers, timeout=30)
    return resp


def update_assistant_settings(assistant_uuid, params):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/assistant/' + assistant_uuid + '/setting/')
    resp = requests.put(url, json=params, headers=headers, timeout=30)
    return resp


def issue_details(params):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/issue-manage/issue-details/')
    resp = requests.post(url, json=params, headers=headers, timeout=30)
    return resp


def is_valid_ai_assistant_access_token(auth, assistant_uuid):
    """
    can decode a valid jwt payload
    """

    is_valid, payload = False, None
    if not auth or auth[0].lower() not in AUTHORIZATION_PREFIX:
        return is_valid, payload

    key = auth[1]
    try:
        payload = jwt.decode(key, DTABLE_PRIVATE_KEY, algorithms=['HS256'])
    except Exception as e:
        logger.error('Failed to decode jwt: %s' % e)
        return is_valid, payload

    if assistant_uuid and assistant_uuid != payload.get('assistant_uuid'):
        return is_valid, payload

    return True, payload


def upload_file(assistant_uuid, file, params):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/assistant/' + assistant_uuid + '/upload-file/')
    resp = requests.post(url, files=file, data=params, headers=headers, timeout=30)
    return resp


def download_img(assistant_uuid, path):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/asset/' + assistant_uuid + '/' + path)
    resp = requests.get(url, headers=headers, timeout=30)
    return resp


def query_row(assistant_uuid, params):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/assistant/' + assistant_uuid + '/row/')
    resp = requests.get(url, params=params, headers=headers, timeout=30)
    return resp


def update_row(assistant_uuid, params):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/assistant/' + assistant_uuid + '/row/')
    resp = requests.put(url, json=params, headers=headers, timeout=30)
    return resp


def check_universal_app_permission(request, assistant_uuid):
    username = request.user.username
    app_uuid = request.GET.get('app_uuid')
    page_id = request.GET.get('page_id')
    external_app = DTableExternalApps.objects.filter(app_uuid=app_uuid).first()
    if external_app.app_type != 'universal-app':
        return False

    try:
        app_config = json.loads(external_app.app_config)
    except:
        return False
    pages = app_config.get('settings').get('pages', [])
    page = None
    for tmp_page in pages:
        if tmp_page['id'] == page_id:
            page = tmp_page
            break
    if not page:
        return False

    if not assistant_uuid == page.get('assistant_uuid'):
        return False

    dtable_uuid = external_app.dtable_uuid
    dtable = DTables.objects.get_dtable_by_uuid(dtable_uuid)
    if not dtable:
        return False

    if dtable.deleted:
        return False

    workspace_id = dtable.workspace_id
    workspace = Workspaces.objects.get_workspace_by_id(workspace_id)
    if not workspace:
        return False

    app_user = check_universal_app_users(username, workspace.owner, external_app, external_app.can_anonymous_access)
    if app_user:
        return True

    return False


def agent(assistant_uuid, params):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/assistant/' + assistant_uuid + '/agent/')
    resp = requests.post(url, json=params, headers=headers, timeout=60)
    return resp


def assistant_history(assistant_uuid, params):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/assistant/' + assistant_uuid + '/history/')
    resp = requests.get(url, params=params, headers=headers, timeout=30)
    return resp


def extract_web_page_info(params):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/chrome-extension/extract/full-page/')
    resp = requests.post(url, json=params, headers=headers, timeout=30)
    return resp


def extract_selected_content_info(params):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/chrome-extension/extract/selected-content/')
    resp = requests.post(url, json=params, headers=headers, timeout=30)
    return resp


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
    user = ccnet_api.get_emailuser(owner_id)
    role = user.role
    ai_credit = get_enabled_role_permissions_by_role(role).get('ai_credit_per_user', -1)
    return ai_credit


def get_ai_cost_by_org_id(org_id):
    month = timezone.now().replace(day=1)
    cost = StatsAIByTeam.objects.filter(org_id=org_id, month=month).aggregate(total_cost=Coalesce(Sum('cost'), Value(0.0)))['total_cost']
    return cost


def get_ai_cost_by_owner_id(owner_id):
    month = timezone.now().replace(day=1)
    cost = StatsAIByOwner.objects.filter(owner_id=owner_id, month=month).aggregate(total_cost=Coalesce(Sum('cost'), Value(0.0)))['total_cost']
    return cost


def get_ai_credit_by_assistant(assistant: AIAssistantOwner):
    workspace = Workspaces.objects.filter(owner=assistant.owner).first()
    if not workspace:
        raise Exception(f'There is no a workspace for {assistant.owner}')

    org_id = workspace.org_id
    owner_id = None if org_id != -1 else assistant.owner

    if org_id != -1:
        role = ORG_DEFAULT
        os = OrgSettings.objects.filter(org_id=org_id).first()
        if os:
            role = os.role
        ai_credit_per_user = get_enabled_role_permissions_by_role(role).get('ai_credit_per_user', -1)
        max_user = OrgMemberQuota.objects.get_quota(org_id)
        ai_credit = ai_credit_per_user * max_user
    else:
        if '@seafile_group' in owner_id:
            return -1
        user = ccnet_api.get_emailuser(owner_id)
        role = user.role
        ai_credit = get_enabled_role_permissions_by_role(role).get('ai_credit_per_user', -1)

    return -1 if ai_credit < 0 else ai_credit


def get_ai_cost_by_assistant(assistant: AIAssistantOwner):
    workspace = Workspaces.objects.filter(owner=assistant.owner).first()
    if not workspace:
        raise Exception(f'There is no a workspace for {assistant.owner}')

    org_id = workspace.org_id
    owner_id = None if org_id != -1 else assistant.owner

    month = timezone.now().replace(day=1).date()
    if org_id != -1:
        cost = StatsAIByTeam.objects.filter(org_id=org_id, month=month).aggregate(total_cost=Coalesce(Sum('cost'), Value(0.0)))['total_cost']
    else:
        cost = StatsAIByOwner.objects.filter(owner_id=owner_id, month=month).aggregate(total_cost=Coalesce(Sum('cost'), Value(0.0)))['total_cost']

    return cost


def is_ai_exceed_by_assistant(assistant: AIAssistantOwner):
    ai_credit = get_ai_credit_by_assistant(assistant)
    cost = get_ai_cost_by_assistant(assistant)

    if ai_credit < 0:
        return False

    return ai_credit <= round(cost, 2)


def receipt_recognition(params):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/document-and-receipt-recognition/receipt-recognition/')
    resp = requests.post(url, json=params, headers=headers, timeout=30)
    return resp


def text_information_extraction(params):
    headers = gen_headers()
    url = urljoin(SEATABLE_AI_SERVER_URL, '/api/v1/text-information-extraction/record/')
    resp = requests.post(url, json=params, headers=headers, timeout=30)
    return resp
