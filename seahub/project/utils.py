import logging
import jwt
import time
import requests
import json
from urllib.parse import urljoin
from copy import deepcopy

from seahub.project.models import Projects
from seahub.group.utils import is_group_admin_or_owner, is_group_member
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.auth.models import EmailUser
from seahub.group.models import Group, GroupUser
from seahub.api2.utils import get_user_common_info

from seahub.settings import SEAQA_INDEX_SERVER_URL, JWT_PRIVATE_KEY,\
    SEAQA_AI_SERVER_URL
from seahub.constants import PERMISSION_READ_WRITE
from seahub.utils.hasher import AESPasswordHasher


logger = logging.getLogger(__name__)

ENCRYPT_KEYS = ['api_token']


def check_project_limit(workspace, request):
    from seahub.settings import PERSONAL_BASE_LIMIT, GROUP_BASE_LIMIT, FREE_ORG_BASE_LIMIT
    org_id = workspace.org_id
    if org_id != -1 and not request.user.permissions.can_use_advanced_permissions():
        org_project_count = Projects.objects.filter(deleted=False, workspace__org_id=org_id).select_related('workspace').count()
        if org_project_count >= FREE_ORG_BASE_LIMIT:
            return False

    try:
        project_count = Projects.objects.filter(workspace=workspace, deleted=False).count()
    except Exception as e:
        logger.error('check workspace %d project count error, invalid error: %s', workspace.id, e)
        return False

    owner = workspace.owner
    if '@seafile_group' in owner:
        return project_count < GROUP_BASE_LIMIT

    return project_count < PERSONAL_BASE_LIMIT


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


def encrypt_config(config):
    config_clone = deepcopy(config)
    cryptor = AESPasswordHasher()
    encrypted_details = {
        key: cryptor.encode(config_clone[key])
        for key in ENCRYPT_KEYS if key in config_clone and config_clone[key]
    }
    config_clone.update(encrypted_details)
    return json.dumps(config_clone)


def decrypt_config(config):
    config_clone = deepcopy(config)
    cryptor = AESPasswordHasher()
    decrypted_details = {
        key: cryptor.decode(config_clone[key])
        for key in ENCRYPT_KEYS if key in config_clone and config_clone[key]
    }
    config_clone.update(decrypted_details)
    return config_clone


def add_init_crawl_site_task(params):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, JWT_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(SEAQA_INDEX_SERVER_URL, '/add-init-crawl-site-task')
    resp = requests.get(url, params=params, headers=headers)

    return json.loads(resp.content)


def add_index_seafile_task(params):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, JWT_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(SEAQA_INDEX_SERVER_URL, '/add-index-seafile-task')
    resp = requests.get(url, params=params, headers=headers)

    return json.loads(resp.content)


def search(params):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, JWT_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(SEAQA_INDEX_SERVER_URL, '/search')
    resp = requests.post(url, json=params, headers=headers)
    if resp.status_code == 500:
        raise Exception('search error status: %s body: %s', resp.status_code, resp.text)
    resp_json = resp.json()
    results = resp_json.get('results')
    return results


def ask_ai_question(params):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, JWT_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(SEAQA_AI_SERVER_URL, '/generate-answer')
    resp = requests.post(url, json=params, headers=headers)
    if resp.status_code == 500:
        raise Exception('ask ai error status: %s body: %s', resp.status_code, resp.text)
    resp_json = resp.json()
    ai_answer = resp_json.get('answer', '')
    sources = resp_json.get('sources', [])
    return ai_answer, sources
