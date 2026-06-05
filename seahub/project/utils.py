import json
import re
import logging
import hashlib
import requests
import json
from urllib.parse import quote_plus, quote
from email.utils import getaddresses, formataddr

from seahub.settings import SERVICE_URL, ENABLE_GENERAL_TASK, PERSONAL_PROJECT_LIMIT, GROUP_PROJECT_LIMIT, FREE_ORG_PROJECT_LIMIT
from seahub.seadb_models.utils import get_current_table_metadata
from seahub.project.models import Projects, DeletedProjects, AIUsageStatistics, Workspaces, \
    AdditionalCredits, encrypt_config
from seahub.chats.models import ChatSessions, ChatMessages, ChatMessageThoughtProcess
from seahub.portal.models import PortalChatSessions, PortalChatMessages
from django.db.models import Sum, Value
from django.db.models.functions import Coalesce
from django.core.cache import cache
from rest_framework import status

from seahub.organizations.models import OrgSettings
from seahub.role_permissions.utils import get_enabled_role_permissions_by_role
from seahub.group.utils import is_group_admin_or_owner, is_group_member
from seahub.base.templatetags.seahub_tags import email2nickname
from seahub.auth.models import EmailUser
from seahub.group.models import Group, GroupUser
from seahub.group.utils import get_user_groups
from seahub.api2.utils import api_error, get_user_common_info
from seahub.utils import normalize_cache_key
from seahub.utils.timeutils import get_month_date_range
from seahub.utils.ai_client import rank_related_records
from seahub.utils.storage import delete_record_attachments_from_s3
from seahub.constants import PERMISSION_READ_WRITE, TEAM_FREE
from seahub.project.seadb_api import SeaDBAPI
from seahub.project.constants import USER_PROJECT_CACHE_PREFIX, USER_PROJECT_CACHE_CACHE_TIMEOUT, \
    ConnectionType, AIScenario, OAUTH_EMAIL_PROVIDERS, GMAIL_EMAIL_PROVIDER, MICROSOFT_EMAIL_PROVIDER
from seahub.avatar.util import get_default_avatar_url
from seahub.utils import mq
from seahub.settings import SITE_ROOT

from seahub.seadb_models.models import SchemaTables


logger = logging.getLogger(__name__)


class EmailOAuthProfileError(Exception):
    pass

# Connection types that support linked_ticket
LINKED_TICKET_SUPPORT_TYPES = [
    ConnectionType.DISCOURSE_FORUM.value,
    ConnectionType.GITHUB_ISSUE.value,
    ConnectionType.EMAIL.value,
    ConnectionType.GENERAL_TASK.value,
]


def get_email_oauth_callback_url(project_uuid):
    service_url = SERVICE_URL.rstrip('/')
    return f'{service_url}/api/v1/project/{project_uuid}/connections/email/oauth/callback/'


def is_oauth_email_provider(provider):
    return provider in OAUTH_EMAIL_PROVIDERS


def persist_project_connection_config(project_connection, config):
    project_connection.config = encrypt_config(config)
    project_connection.save(update_fields=['config'])


def fetch_oauth_email_sender_info(config, access_token):
    provider = config.get('server_provider')
    headers = {'Authorization': f'Bearer {access_token}'}

    try:
        if provider == GMAIL_EMAIL_PROVIDER:
            response = requests.get(
                'https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs',
                headers=headers,
                timeout=10,
            )
            response.raise_for_status()
            send_as_list = response.json().get('sendAs') or []
            sender_info = next(
                (item for item in send_as_list if item.get('isPrimary') or item.get('isDefault')),
                send_as_list[0] if send_as_list else None,
            )
            if not sender_info:
                raise EmailOAuthProfileError('No Gmail sender profile found.')

            sender_email = sender_info.get('sendAsEmail')
            if not sender_email:
                raise EmailOAuthProfileError('No Gmail sender email found.')

            return {
                'sender_name': sender_info.get('displayName', ''),
                'sender_email': sender_email,
                'username': sender_email,
            }

        if provider == MICROSOFT_EMAIL_PROVIDER:
            response = requests.get(
                'https://graph.microsoft.com/v1.0/me',
                headers=headers,
                timeout=10,
            )
            response.raise_for_status()
            sender_info = response.json()
            sender_email = sender_info.get('mail') or sender_info.get('userPrincipalName')
            if not sender_email:
                raise EmailOAuthProfileError('No Microsoft sender email found.')

            return {
                'sender_name': sender_info.get('displayName', ''),
                'sender_email': sender_email,
                'username': sender_email,
            }
    except requests.RequestException as e:
        logger.exception('Failed to fetch sender profile for provider %s: %s', provider, e)
        raise EmailOAuthProfileError('Failed to fetch sender profile.') from e

    raise EmailOAuthProfileError(f'Unsupported OAuth email provider: {provider}')


def create_connection(project, username, connection_type, name, config):
    from seahub.project.models import ProjectConnections
    from seahub.project.seadb_api import SeaDBAPI
    from seahub.seadb_models.utils import init_seadb_tables_from_schema
    from seahub.project.connections import add_connection_sync_task

    project_uuid = project.uuid
    enable_create = ProjectConnections.objects.enable_create(project_uuid, connection_type, config)
    if not enable_create:
        return None, api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Please check input')

    try:
        record = ProjectConnections.objects.create(username, project_uuid, connection_type, name, config)
    except Exception as e:
        logger.error(e)
        return None, api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

    connection_id = record.id
    seadb_api = SeaDBAPI()
    init_table_funcs = {
        ConnectionType.SITE.value: lambda api, project_uuid, connection_id: init_seadb_tables_from_schema(
            [SchemaTables.WEB_CRAWL], api, project_uuid, connection_id
        ),
        ConnectionType.DISCOURSE_FORUM.value: lambda api, project_uuid, connection_id: init_seadb_tables_from_schema(
            [SchemaTables.DISCOURSE_TOPICS, SchemaTables.DISCOURSE_REPLIES], api, project_uuid, connection_id
        ),
        ConnectionType.GITHUB_ISSUE.value: lambda api, project_uuid, connection_id: init_seadb_tables_from_schema(
            [SchemaTables.GITHUB_ISSUES, SchemaTables.GITHUB_ISSUE_COMMENTS], api, project_uuid, connection_id
        ),
        ConnectionType.SEAFILE.value: lambda api, project_uuid, connection_id: init_seadb_tables_from_schema(
            [SchemaTables.SEAFILE], api, project_uuid, connection_id
        ),
        ConnectionType.EMAIL.value: lambda api, project_uuid, connection_id: init_seadb_tables_from_schema(
            [SchemaTables.EMAIL, SchemaTables.THREAD], api, project_uuid, connection_id
        ),
        ConnectionType.NOTION.value: lambda api, project_uuid, connection_id: init_seadb_tables_from_schema(
            [SchemaTables.NOTION], api, project_uuid, connection_id
        ),
        ConnectionType.GENERAL_TASK.value: lambda api, project_uuid, connection_id: init_seadb_tables_from_schema(
            [SchemaTables.GENERAL_TASK, SchemaTables.GENERAL_TASK_USER], api, project_uuid, connection_id
        ),
    }

    if connection_type == ConnectionType.GENERAL_TASK.value and not ENABLE_GENERAL_TASK:
        return None, api_error(status.HTTP_400_BAD_REQUEST, 'General task connection is not enabled')

    try:
        init_table_func = init_table_funcs.get(connection_type)
        if init_table_func:
            init_table_func(seadb_api, project_uuid, connection_id)
    except Exception as e:
        logger.error(e)
        record.delete()
        return None, api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Internal Server Error')

    params = {
        'connection_id': connection_id,
        'type': connection_type,
    }
    add_connection_sync_task(params)
    return record, None

def check_project_limit(workspace, request):
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
    cache_key = f'gt_related_users_{project_uuid}_{connection_id}'
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    seadb_api = SeaDBAPI()
    related_users = {}
    default_avatar_url = get_default_avatar_url()
    table_name = SchemaTables.GENERAL_TASK_USER.table_name(connection_id)
    try:
        sql = f"SELECT `email`, `name` FROM `{table_name}`"
        results = seadb_api.query_rows(project_uuid, sql).get('results', [])
    except Exception as e:
        logger.error(f'get connection general task related users error: {e}')
        return []

    for item in results:
        email = str(item.get('email') or '').strip()
        name = str(item.get('name') or '').strip()
        if not email or not name or email in related_users:
            continue
        related_users[email] = {
            'email': email,
            'name': name,
            'avatar_url': default_avatar_url,
        }

    result = list(related_users.values())
    cache.set(cache_key, result, 60)
    return result


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
        session_project_map = dict(
            ChatSessions.objects.filter(session_uuid__in=session_uuids).values_list('session_uuid', 'project_uuid')
        )
        for session_uuid, project_uuid in session_project_map.items():
            try:
                delete_record_attachments_from_s3(project_uuid, 'chat', session_uuid)
            except Exception as e:
                logger.warning('clean s3 chat images for session %s error: %s', session_uuid, e)

        ChatMessages.objects.filter(session_uuid__in=session_uuids).delete()
        ChatMessageThoughtProcess.objects.filter(session_uuid__in=session_uuids).delete()
        ChatSessions.objects.filter(session_uuid__in=session_uuids).delete()
    except Exception as e:
        logger.error('delete sessions error: %s', e)


def delete_portal_sessions(session_uuids):
    try:
        session_project_map = dict(
            PortalChatSessions.objects.filter(session_uuid__in=session_uuids).values_list('session_uuid', 'project_uuid')
        )
        for session_uuid, project_uuid in session_project_map.items():
            try:
                delete_record_attachments_from_s3(project_uuid, 'portal-chat', session_uuid)
            except Exception as e:
                logger.warning('clean s3 portal chat images for session %s error: %s', session_uuid, e)

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


def get_ai_credit_exceeded_amount_by_org_id(org_id):
    if org_id < 0:
        return 0

    credit = get_total_ai_credit_by_org_id(org_id)
    if credit < 0:
        return 0

    used_credit = convert_cost_to_credit(get_ai_cost_by_org_id(org_id))
    return max(used_credit - credit, 0)

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

def _collect_github_issue_column_options(seadb_api, project_uuid, connection_ids, column_name, extra_id_field):
    """Merge select-column options from GitHub issue tables across connections."""
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
        table_name = SchemaTables.GITHUB_ISSUES.table_name(connection_id)
        table_meta = get_current_table_metadata(tables, table_name)
        if not table_meta:
            continue
        for column in table_meta.get('columns') or []:
            if column.get('name') != column_name:
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
                entry = {
                    'id': option.get('id'),
                    'name': name,
                    'color': option.get('color') or '',
                    'text_color': option.get('text_color') or option.get('textColor') or '',
                    'border_color': option.get('border_color') or option.get('borderColor') or '',
                }
                entry[extra_id_field] = option.get(extra_id_field) or ''
                merged.append(entry)
    return merged

def collect_github_issue_type_options(seadb_api, project_uuid, connection_ids):
    return _collect_github_issue_column_options(
        seadb_api,
        project_uuid,
        connection_ids,
        SchemaTables.GITHUB_ISSUES.column.issue_type.name,
        'type_id',
    )


def collect_github_issue_label_options(seadb_api, project_uuid, connection_ids):
    return _collect_github_issue_column_options(
        seadb_api,
        project_uuid,
        connection_ids,
        SchemaTables.GITHUB_ISSUES.column.labels.name,
        'label_id',
    )


def send_connection_data_event(project_uuid, connection_id, record_id, source_type, event):
    try:
        msg_content = json.dumps({
            'event': event,
            'project_uuid': project_uuid,
            'source_type': source_type,
            'connection_id': int(connection_id),
            'record_id': int(record_id),
        })
        if mq.publish('data_events', msg_content) > 0:
            logger.debug('Publish connection data event: %s', msg_content)
        else:
            logger.info('No one subscribed to data_events, event (%s) has not been sent', msg_content)
    except Exception as e:
        logger.error('send connection data event failed, error: %s', e)

def build_project_page_related_url(request, project, page_path) -> str:
    site_root = SITE_ROOT.rstrip('/')
    project_name = quote(project.project_name, safe='')
    path = (
        f'{site_root}/workspace/{project.workspace_id}/project/{project_name}/'
        f'{page_path.lstrip("/")}'
    )
    return request.build_absolute_uri(path)

def build_connection_record_related_url(request, project, connection_id, record_id):
    return build_project_page_related_url(
        request, project, f'connections/{connection_id}/records/{record_id}/'
    )

def build_portal_issue_related_url(request, project, issue_id):
    return build_project_page_related_url(
        request, project, f'portal-issues/{issue_id}/'
    )

def build_ticket_related_url(request, project, ticket_id):
    return build_project_page_related_url(
        request, project, f'tickets/{ticket_id}/'
    )
