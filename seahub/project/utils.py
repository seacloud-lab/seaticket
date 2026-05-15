import re
import logging
import hashlib
from urllib.parse import quote_plus
from email.utils import getaddresses, formataddr

from seahub.project.models import Projects, DeletedProjects, AIUsageStatistics, Workspaces, \
    AdditionalCredits
from seahub.chats.models import ChatSessions, ChatMessages, ChatMessageThoughtProcess
from seahub.portal.models import PortalChatSessions, PortalChatMessages
from django.db.models import Sum, Value
from django.db.models.functions import Coalesce
from django.core.cache import cache

from seahub.organizations.models import OrgSettings
from seahub.role_permissions.utils import get_enabled_role_permissions_by_role
from seahub.utils.user_permissions import get_user_role
from seahub.group.utils import is_group_admin_or_owner, is_group_member
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.auth.models import EmailUser
from seahub.group.models import Group, GroupUser
from seahub.group.utils import get_user_groups
from seahub.api2.utils import get_user_common_info
from seahub.utils import normalize_cache_key
from seahub.utils.timeutils import get_month_date_range
from seahub.utils.ai_client import rank_related_records
from seahub.constants import PERMISSION_READ_WRITE, TEAM_FREE
from seahub.constants import TEAM_STARTER, TEAM_PRO, TEAM_BUSINESS, TEAM_ENTERPRISE
from seahub.project.seadb_api import SeaDBAPI
from seahub.project.constants import USER_PROJECT_CACHE_PREFIX, USER_PROJECT_CACHE_CACHE_TIMEOUT, ConnectionType, AIScenario
from seahub.seadb_models.models import GithubIssuesTable, GeneralTaskUserMappingTable
from seahub.avatar.util import get_default_avatar_url


logger = logging.getLogger(__name__)

# Connection types that support linked_ticket
LINKED_TICKET_SUPPORT_TYPES = [
    ConnectionType.DISCOURSE_FORUM.value,
    ConnectionType.GITHUB_ISSUE.value,
    ConnectionType.EMAIL.value,
    ConnectionType.GENERAL_TASK.value,
]

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


def get_connection_general_task_related_users(project_uuid, connection_id):
    seadb_api = SeaDBAPI()
    related_users = {}
    default_avatar_url = get_default_avatar_url()
    table_name = GeneralTaskUserMappingTable.gen_table_name(connection_id)
    try:
        sql = f"SELECT `email`, `nickname` FROM `{table_name}`"
        results = seadb_api.query_rows(project_uuid, sql).get('results', [])
    except Exception:
        return []

    for item in results:
        email = str(item.get('email') or '').strip()
        nickname = str(item.get('nickname') or '').strip()
        if not email or not nickname or email in related_users:
            continue
        related_users[email] = {
            'email': email,
            'name': nickname,
            'avatar_url': default_avatar_url,
        }

    return list(related_users.values())


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


def delete_portal_sessions(session_uuids):
    try:
        PortalChatMessages.objects.filter(session_uuid__in=session_uuids).delete()
        PortalChatSessions.objects.filter(session_uuid__in=session_uuids).delete()
    except Exception as e:
        logger.error('delete portal sessions error: %s', e)


def delete_project(project):
    project_uuid = str(project.uuid)
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
    role = TEAM_FREE
    os = OrgSettings.objects.filter(org_id=org_id).first()
    if os:
        role = os.role
    return get_enabled_role_permissions_by_role(role).get('ai_credit', -1)


def get_additional_credits_by_org_id(org_id):
    credits_obj = AdditionalCredits.objects.filter(org_id=org_id).first()
    if not credits_obj:
        return 0
    return credits_obj.credits or 0


def get_total_ai_credit_by_org_id(org_id):
    monthly_credit = get_ai_credit_by_org_id(org_id)
    if monthly_credit < 0:
        return -1
    return monthly_credit + get_additional_credits_by_org_id(org_id)


def get_ai_cost_by_org_id(org_id):
    cache_key = f'ai_cost_org_{org_id}'
    cost = cache.get(cache_key)
    if not cost:
        cost = AIUsageStatistics.objects.filter(date__range=get_month_date_range(), org_id=org_id).aggregate(
            total_cost=Coalesce(Sum('cost'), Value(0.0))
        )['total_cost']
        cache_timeout = 600 # update / 10 min
        cache.set(cache_key, cost, cache_timeout)
    return cost

def check_ai_limit(org_id):
    if org_id >= 0:
        # Organization user
        credit = get_total_ai_credit_by_org_id(org_id)
        if credit == -1:
            return False
        used_credit = convert_cost_to_credit(get_ai_cost_by_org_id(org_id))
    else:
        # system admin mode
        return False

    is_exceed = used_credit >= credit
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

def rank_vector_search_results(query_record, results, org_id, project_uuid):
    if not results:
        return results

    candidate_records = []
    result_map = {}

    for result in results:
        _id = result.get('_id')
        connection_id = result.get('connection_id', '')

        candidate = {
            '_id': _id,
            'connection_id': connection_id,
            'title': result.get('title', ''),
            'ai_summary': result.get('ai_summary', '')
        }

        if 'snippets' in result:
            candidate['snippets'] = result['snippets']

        candidate_records.append(candidate)

        map_key = f"{_id}:{connection_id}"
        result_map[map_key] = result

    params = {
        'query_record': query_record,
        'candidate_records': candidate_records,
        'org_id': org_id,
        'project_uuid': project_uuid,
        'scenario': AIScenario.SEARCH.value,
    }

    try:
        ranked_ids = rank_related_records(params)
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

def convert_cost_to_credit(cost):
    return 100 * cost

_ADDR_WITH_NAME_RE = re.compile(r'([^<,]*?)\s*<([^@\s>]+@[^>]+)>')

# email utils
def extract_email_addresses(address_text):
    if not address_text:
        return []

    address_text = str(address_text).replace(';', ',')
    addresses = []
    seen_emails = set()
    for name, email in getaddresses([address_text]):
        email = email.strip()
        if email and email.lower() not in seen_emails:
            seen_emails.add(email.lower())
            addresses.append(formataddr((name, email)))

    for m in _ADDR_WITH_NAME_RE.finditer(address_text):
        display = m.group(1).strip().strip('"')
        email = m.group(2).strip()
        if not email or email.lower() in seen_emails:
            continue
        seen_emails.add(email.lower())
        if display:
            escaped = display.replace('\\', '\\\\').replace('"', '\\"')
            addresses.append('"%s" <%s>' % (escaped, email))
        else:
            addresses.append(email)
    return addresses

def collect_github_issue_type_options(seadb_api, project_uuid, connection_ids):
    if not connection_ids:
        return []

    try:
        base_metadata = seadb_api.get_base_metadata(project_uuid)
    except Exception as e:
        logger.warning(f'Failed to load SeaDB base metadata for {project_uuid}: {e}')
        return []

    tables = (base_metadata or {}).get('tables') or []
    merged = []
    seen_names = set()
    for connection_id in connection_ids:
        table_name = GithubIssuesTable.gen_table_name(connection_id)
        table_meta = get_current_table_metadata(tables, table_name)
        if not table_meta:
            continue
        for column in table_meta.get('columns') or []:
            if column.get('name') != GithubIssuesTable.issue_type.name:
                continue
            options = ((column.get('data') or {}).get('options')) or []
            for option in options:
                name = (option.get('name') or '').strip()
                if not name:
                    continue
                key = name.lower()
                if key in seen_names:
                    continue
                seen_names.add(key)
                merged.append({
                    'id': option.get('id'),
                    'name': name,
                    'color': option.get('color') or '',
                    'text_color': option.get('text_color') or option.get('textColor') or '',
                    'border_color': option.get('border_color') or option.get('borderColor') or '',
                    'type_id': option.get('type_id') or '',
                })
    return merged
