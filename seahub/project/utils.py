import logging
import jwt
import time
import requests
import json
from urllib.parse import urljoin

from seahub.project.models import Projects
from seahub.group.utils import is_group_admin_or_owner
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.auth.models import EmailUser
from seahub.group.models import Group

from seahub.settings import WEB_CRAWL_INDEX_SERVER_URL, SEAQA_PRIVATE_KEY


logger = logging.getLogger(__name__)


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


def convert_project_trash_names(project):
    """
    convert project's name to trash name
    """
    assert project.deleted is False
    new_project_name = '_(deleted_' + str(project.id) + ') ' + project.name

    return new_project_name


def add_init_crawl_site_task(params):
    payload = {'exp': int(time.time()) + 300, }
    token = jwt.encode(payload, SEAQA_PRIVATE_KEY, algorithm='HS256')
    headers = {"Authorization": "Token %s" % token}
    url = urljoin(WEB_CRAWL_INDEX_SERVER_URL, '/add-init-crawl-site-task')
    resp = requests.get(url, params=params, headers=headers)

    return json.loads(resp.content)

