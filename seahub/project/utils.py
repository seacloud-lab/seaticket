import re
import logging
import hashlib
from urllib.parse import quote_plus

from seahub.project.models import Projects, DeletedProjects, ConnectionsViews, \
    StatsAIByTeam, StatsAIByOwner, Workspaces
from seahub.chats.models import ChatSessions, ChatMessages, ChatMessageThoughtProcess
from seahub.tickets.models import TicketViews
from seahub.knowledge_base.models import KnowledgeBaseViews
from django.db.models import Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone as django_timezone
from django.core.cache import cache

from seahub.organizations.models import OrgSettings, OrgMemberQuota
from seahub.role_permissions.utils import get_enabled_role_permissions_by_role
from seahub.role_permissions.models import UserRole
from seahub.group.utils import is_group_admin_or_owner, is_group_member
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.auth.models import EmailUser
from seahub.group.models import Group, GroupUser
from seahub.group.utils import get_user_groups
from seahub.api2.utils import get_user_common_info
from seahub.utils import normalize_cache_key
from seahub.notifications.models import ProjectNotification
from seahub.utils import normalize_cache_key
from seahub.utils.ai_client import rank_related_issues
from seahub.utils.storage import delete_project_dir_from_s3
from seahub.constants import PERMISSION_READ_WRITE, ORG_DEFAULT, DEFAULT_USER
from seahub.project.seadb_api import SeaDBAPI
from seahub.project.constants import USER_PROJECT_CACHE_PREFIX, USER_PROJECT_CACHE_CACHE_TIMEOUT


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


def check_same_org_permission(user, workspace):
    """Check if user is in the same organization as the workspace.
    """
    project_org_id = workspace.org_id
    user_org_id = user.org.org_id if hasattr(user, 'org') else -1
    if project_org_id == -1 or user_org_id != project_org_id:
        return False
    return True


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


def replace_file_url_in_content(content, new_file_urls_dict):
    for new_file_url in new_file_urls_dict:
        old_file_url = new_file_urls_dict[new_file_url]
        content = content.replace(old_file_url, new_file_url)
    return content


def delete_sessions(session_uuids):
    try:
        ChatMessages.objects.filter(session_uuid__in=session_uuids).delete()
        ChatMessageThoughtProcess.objects.filter(session_uuid__in=session_uuids).delete()
        ChatSessions.objects.filter(session_uuid__in=session_uuids).delete()
    except Exception as e:
        logger.error('delete sessions error: %s', e)


def delete_project(project):
    project_uuid = str(project.uuid)
    try:
        ConnectionsViews.objects.filter(project_uuid=project_uuid).delete()
        TicketViews.objects.filter(project_uuid=project_uuid).delete()
        KnowledgeBaseViews.objects.filter(project_uuid=project_uuid).delete()
        ProjectNotification.objects.filter(project_uuid=project_uuid).delete()
        session_uuids = ChatSessions.objects.filter(project_uuid=project_uuid).values_list('session_uuid', flat=True)
        delete_sessions(session_uuids)
        seadb_api = SeaDBAPI()
        seadb_api.delete_base(project_uuid)
    except Exception as e:
        logger.error(e)

    try:
        delete_project_dir_from_s3(project_uuid)
    except Exception as e:
        logger.error(e)

    try:
        Projects.objects.delete_project(project.workspace, project.name)
        DeletedProjects(project_uuid=project_uuid).save()
    except Exception as e:
        logger.error('delete project: %s error: %s', str(project_uuid), e)

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


def get_all_available_projects(request):
    username = request.user.username
    cache_key = normalize_cache_key(username, USER_PROJECT_CACHE_PREFIX)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    groups = get_user_groups(username, return_ancestors=True)
    owner_list = [username] + ['%s@seafile_group' % group.group_id for group in groups]
    workspaces = Workspaces.objects.filter(owner__in=owner_list)
    projects = []
    projects_qs = Projects.objects.filter(workspace__in=workspaces, deleted=False)
    for project in projects_qs:
        project_info = {
            'workspace_id': project.workspace_id,
            'name': project.name,
            'icon': project.icon,
            'color': project.color,
        }
        projects.append(project_info)
    cache.set(cache_key, projects, USER_PROJECT_CACHE_CACHE_TIMEOUT)
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


def rank_search_results(query, results, username, org_id, project_uuid):
    if not results:
        return results

    candidate_records = []
    result_map = {}

    for result in results:
        _id = result.get('_id')
        connection_id = result.get('connection_id', '')
        source_type = result.get('source_type', '')
        title = result.get('title', '')
        content = result.get('content', '')

        candidate = {
            '_id': _id,
            'connection_id': connection_id,
            'title': title,
        }

        if source_type == 'chunk':
            candidate['snippets'] = content
        else:
            candidate['ai_summary'] = content

        candidate_records.append(candidate)

        map_key = f"{_id}:{connection_id}"
        result_map[map_key] = result

    query_record = {'ai_summary': query}
    params = {
        'query_record': query_record,
        'candidate_records': candidate_records,
        'username': username,
        'org_id': org_id,
        'project_uuid': project_uuid,
    }

    try:
        ranked_ids = rank_related_issues(params)
    except Exception as e:
        logger.warning(f'rank search results failed: {e}')
        return results

    ranked_results = []
    seen_keys = set()

    for ranked_id in ranked_ids:
        if ranked_id in result_map and ranked_id not in seen_keys:
            ranked_results.append(result_map[ranked_id])
            seen_keys.add(ranked_id)

    return ranked_results
