from seahub.project.constants import ConnectionType


class FormulaResultType(object):
    NUMBER = 'number'
    STRING = 'string'
    DATE = 'date'
    BOOL = 'bool'
    ARRAY = 'array'


class DurationFormatsType(object):
    H_MM = 'h:mm'
    H_MM_SS = 'h:mm:ss'
    H_MM_SS_S = 'h:mm:ss.s'
    H_MM_SS_SS = 'h:mm:ss.ss'
    H_MM_SS_SSS = 'h:mm:ss.sss'


class PropertyTypes:
    TEXT = 'text'
    DATETIME = 'datetime'
    INT = 'int64'
    FLOAT = 'float64'
    SINGLE_SELECT = 'single-select'
    MULTIPLE_SELECT = 'multiple-select'
    BOOL = 'bool'
    IMAGE = 'image'
    DATE = 'date'
    LONG_TEXT = 'long-text'
    CHECKBOX = 'checkbox'
    URL = 'url'
    DURATION = 'duration'
    NUMBER = 'number'
    FILE = 'file'
    COLLABORATOR = 'collaborator'
    EMAIL = 'email'
    FORMULA = 'formula'
    CREATOR = 'creator'
    LAST_MODIFIER = 'last-modifier'
    AUTO_NUMBER = 'auto-number'
    LINK = 'link'
    LINK_FORMULA = 'link-formula'
    RATE = 'rate'
    GEOLOCATION = 'geolocation'
    BUTTON = 'button'
    LIST = 'list'


class ListTypes:
    vector = {
        "list_type": "float32",
    }
    int = {
        "list_type": "int64",
    }

class SelectTypes:
    ticket_status = {
      "options": [
        {
          "id": "0001",
          "name": "open",
          "color": "#1A7F37",
          "text_color": "#FFFFFF",
        },
        {
          "id": "0002",
          "name": "closed",
          "color": "#8250DF",
          "text_color": "#FFFFFF",
        }
      ]
    }
    ticket_substate = {
      "cascade_column_key": "",
      "cascade_settings": {
        "0001": [
          "0010",
          "0011",
          "0012",
          "0013"
        ],
        "0002": [
          "0014",
          "0015",
          "0016"
        ]
      },
      "options": [
        {
          "id": "0010",
          "name": "New",
          "color": "#59CB74",
          "text_color": "#FFFFFF",
        },
        {
          "id": "0011",
          "name": "Working on",
          "color": "#46A1FD",
          "text_color": "#FFFFFF",
        },
        {
          "id": "0012",
          "name": "Backlog",
          "color": "#9C9C9E",
          "text_color": "#FFFFFF",
        },
        {
          "id": "0013",
          "name": "Waiting on user",
          "color": "#EAA775",
          "text_color": "#FFFFFF"
        },
        {
          "id": "0014",
          "name": "Completed",
          "color": "#8250DF",
          "text_color": "#FFFFFF",
        },
        {
          "id": "0015",
          "name": "Not planned",
          "color": "#59636E",
          "text_color": "#FFFFFF"
        },
        {
          "id": "0016",
          "name": "Duplicate",
          "color": "#59636E",
          "text_color": "#FFFFFF"
        },
      ]
    }

    state = {
      "options": [
        {
          "id": "0001",
          "name": "open",
          "color": "#1A7F37",
          "text_color": "#FFFFFF"
        },
        {
          "id": "0002",
          "name": "closed",
          "color": "#8250DF",
          "text_color": "#FFFFFF"
        }
      ]
    }

    state_reason = {
      "options": [
        {
          "id": "0001",
          "name": "completed",
          "color": "#8250DF",
          "text_color": "#FFFFFF"
        },
        {
          "id": "0002",
          "name": "not_planned",
          "color": "#59636E",
          "text_color": "#FFFFFF"
        },
        {
          "id": "0003",
          "name": "duplicate",
          "color": "#59636E",
          "text_color": "#FFFFFF"
        },
        {
          "id": "0004",
          "name": "reopened",
          "color": "#1A7F37",
          "text_color": "#FFFFFF"
        }
      ]
    }

    ticket_type = {
      "options": [
        {
          "id": "0001",
          "name": "Bug",
          "color": "#ffebe9",
          "text_color": "#000000"
        },
        {
          "id": "0002",
          "name": "Feature",
          "color": "#ddf4ff",
          "text_color": "#000000"
        },
        {
          "id": "0003",
          "name": "Question",
          "color": "#fff8c5",
          "text_color": "#000000"
        }
      ]
    }


class MappedColumn(object):
    def __init__(self, name, type, data=None):
        self.name = name
        self.type = type
        self.data = data

    def to_dict(self, data=None):
        column_data = {
            'name': self.name,
            'type': self.type,
        }
        if self.data:
            column_data['data'] = self.data

        if data:
            column_data['data'] = data

        return column_data


class BaseModel:
    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        cls._meta = {
            'fields': []
        }

        for name, attr in cls.__dict__.items():
            if isinstance(attr, MappedColumn):
                cls._meta['fields'].append(attr)

    @classmethod
    def get_fields(cls):
        return cls._meta['fields'].copy()

    def __init__(self, **kwargs):
        for field in self.__class__._meta['fields']:
            setattr(self, field.name, field)

    def __repr__(self):
        fields = ", ".join([f"{k}={v!r}" for k, v in self.__dict__.items()])
        return f"{self.__class__.__name__}({fields})"


class DiscourseTopicsTable(BaseModel):
    topic_id = MappedColumn('topic_id', PropertyTypes.INT)
    title = MappedColumn('title', PropertyTypes.TEXT)
    slug = MappedColumn('slug', PropertyTypes.TEXT)
    views = MappedColumn('views', PropertyTypes.INT)
    category_id = MappedColumn('category_id', PropertyTypes.INT)
    modified_time = MappedColumn('modified_time', PropertyTypes.DATETIME)
    resolved = MappedColumn('resolved', PropertyTypes.BOOL)
    deleted = MappedColumn('deleted', PropertyTypes.BOOL)
    outdated = MappedColumn('outdated', PropertyTypes.BOOL)
    record_modified_time = MappedColumn('record_modified_time', PropertyTypes.DATETIME)
    sync_time = MappedColumn('sync_time', PropertyTypes.DATETIME)
    created_time = MappedColumn('created_time', PropertyTypes.DATETIME)
    ai_summary = MappedColumn('ai_summary', PropertyTypes.TEXT)
    ai_processed_time = MappedColumn('ai_processed_time', PropertyTypes.DATETIME)
    ai_summary_vector = MappedColumn('ai_summary_vector', PropertyTypes.LIST, ListTypes.vector)
    linked_ticket = MappedColumn('linked_ticket', PropertyTypes.INT)

    @classmethod
    def gen_table_name(cls, connection_id):
        return ConnectionType.DISCOURSE_FORUM.value + '_' + str(connection_id)


class DiscourseRepliesTable(BaseModel):
    topic_id = MappedColumn('topic_id', PropertyTypes.INT)
    post_number = MappedColumn('post_number', PropertyTypes.INT)
    content = MappedColumn('content', PropertyTypes.TEXT, {'compressed': True})
    author = MappedColumn('author', PropertyTypes.TEXT)
    modified_time = MappedColumn('modified_time', PropertyTypes.DATETIME)
    accepted_answer = MappedColumn('accepted_answer', PropertyTypes.BOOL)

    @classmethod
    def gen_table_name(cls, connection_id):
        return ConnectionType.DISCOURSE_FORUM.value + '_replies' + '_' + str(connection_id)


class WebCrawlTable(BaseModel):
    url = MappedColumn('url', PropertyTypes.TEXT)
    title = MappedColumn('title', PropertyTypes.TEXT)
    etag = MappedColumn('etag', PropertyTypes.TEXT)
    modified_time = MappedColumn('modified_time', PropertyTypes.DATETIME)
    sync_time = MappedColumn('sync_time', PropertyTypes.DATETIME)
    deleted = MappedColumn('deleted', PropertyTypes.BOOL)
    outdated = MappedColumn('outdated', PropertyTypes.BOOL)
    record_modified_time = MappedColumn('record_modified_time', PropertyTypes.DATETIME)
    hash = MappedColumn('hash', PropertyTypes.TEXT)
    ai_summary = MappedColumn('ai_summary', PropertyTypes.TEXT)
    ai_processed_time = MappedColumn('ai_processed_time', PropertyTypes.DATETIME)
    ai_summary_vector = MappedColumn('ai_summary_vector', PropertyTypes.LIST, ListTypes.vector)

    @classmethod
    def gen_table_name(cls, connection_id):
        return ConnectionType.SITE.value + '_' + str(connection_id)


class GithubIssuesTable(BaseModel):
    issue_id = MappedColumn('issue_id', PropertyTypes.INT)
    issue_number = MappedColumn('issue_number', PropertyTypes.INT)
    title = MappedColumn('title', PropertyTypes.TEXT)
    ai_title = MappedColumn('ai_title', PropertyTypes.TEXT)
    content = MappedColumn('content', PropertyTypes.TEXT, {'compressed': True})
    state = MappedColumn('state', PropertyTypes.SINGLE_SELECT, SelectTypes.state)
    state_reason = MappedColumn('state_reason', PropertyTypes.SINGLE_SELECT, SelectTypes.state_reason)
    labels = MappedColumn('labels', PropertyTypes.MULTIPLE_SELECT)
    issue_type = MappedColumn('issue_type', PropertyTypes.SINGLE_SELECT)
    author = MappedColumn('author', PropertyTypes.TEXT)
    assignees = MappedColumn('assignees', PropertyTypes.TEXT)
    url = MappedColumn('url', PropertyTypes.TEXT)
    created_time = MappedColumn('created_time', PropertyTypes.DATETIME)
    modified_time = MappedColumn('modified_time', PropertyTypes.DATETIME)
    sync_time = MappedColumn('sync_time', PropertyTypes.DATETIME)
    closed_time = MappedColumn('closed_time', PropertyTypes.DATETIME)
    comment_count = MappedColumn('comment_count', PropertyTypes.INT)
    deleted = MappedColumn('deleted', PropertyTypes.BOOL)
    outdated = MappedColumn('outdated', PropertyTypes.BOOL)
    record_modified_time = MappedColumn('record_modified_time', PropertyTypes.DATETIME)
    ai_summary = MappedColumn('ai_summary', PropertyTypes.TEXT)
    ai_processed_time = MappedColumn('ai_processed_time', PropertyTypes.DATETIME)
    ai_summary_vector = MappedColumn('ai_summary_vector', PropertyTypes.LIST, ListTypes.vector)
    linked_ticket = MappedColumn('linked_ticket', PropertyTypes.INT)

    @classmethod
    def gen_table_name(cls, connection_id):
        return ConnectionType.GITHUB_ISSUE.value + '_' + str(connection_id)


class GithubIssueCommentsTable(BaseModel):
    comment_id = MappedColumn('comment_id', PropertyTypes.INT)
    issue_id = MappedColumn('issue_id', PropertyTypes.INT)
    author = MappedColumn('author', PropertyTypes.TEXT)
    content = MappedColumn('content', PropertyTypes.TEXT, {'compressed': True})
    created_time = MappedColumn('created_time', PropertyTypes.DATETIME)
    modified_time = MappedColumn('modified_time', PropertyTypes.DATETIME)

    @classmethod
    def gen_table_name(cls, connection_id):
        return ConnectionType.GITHUB_ISSUE.value + '_comments' + '_' + str(connection_id)

class SeafileTable(BaseModel):
    file_id = MappedColumn('file_id', PropertyTypes.TEXT)
    path = MappedColumn('path', PropertyTypes.TEXT)
    title = MappedColumn('title', PropertyTypes.TEXT)
    modified_time = MappedColumn('modified_time', PropertyTypes.DATETIME)
    content = MappedColumn('content', PropertyTypes.TEXT, {'compressed': True})
    sync_time = MappedColumn('sync_time', PropertyTypes.DATETIME)
    deleted = MappedColumn('deleted', PropertyTypes.BOOL)
    outdated = MappedColumn('outdated', PropertyTypes.BOOL)
    record_modified_time = MappedColumn('record_modified_time', PropertyTypes.DATETIME)
    ai_summary = MappedColumn('ai_summary', PropertyTypes.TEXT)
    ai_processed_time = MappedColumn('ai_processed_time', PropertyTypes.DATETIME)
    ai_summary_vector = MappedColumn('ai_summary_vector', PropertyTypes.LIST, ListTypes.vector)

    @classmethod
    def gen_table_name(cls, connection_id):
        return ConnectionType.SEAFILE.value + '_' + str(connection_id)

class TicketsTable(BaseModel):
    title = MappedColumn('title', PropertyTypes.TEXT)
    content = MappedColumn('content', PropertyTypes.TEXT)
    ai_summary = MappedColumn('ai_summary', PropertyTypes.TEXT)
    ai_processed_time = MappedColumn('ai_processed_time', PropertyTypes.DATETIME)
    ai_summary_vector = MappedColumn('ai_summary_vector', PropertyTypes.LIST, ListTypes.vector)
    state = MappedColumn('state', PropertyTypes.SINGLE_SELECT, data=SelectTypes.ticket_status)
    substate = MappedColumn('substate', PropertyTypes.SINGLE_SELECT, data=SelectTypes.ticket_substate)
    type = MappedColumn('type', PropertyTypes.SINGLE_SELECT, data=SelectTypes.ticket_type)
    tags = MappedColumn('tags', PropertyTypes.LIST, ListTypes.int)
    assignees = MappedColumn('assignees', PropertyTypes.LIST)
    participants = MappedColumn('participants', PropertyTypes.LIST)
    linked_connection_records = MappedColumn('linked_connection_records', PropertyTypes.LIST)
    priority = MappedColumn('priority', PropertyTypes.INT)
    creator = MappedColumn('creator', PropertyTypes.TEXT)
    comment_count = MappedColumn('comment_count', PropertyTypes.INT)
    created_time = MappedColumn('created_time', PropertyTypes.DATETIME)
    modified_time = MappedColumn('modified_time', PropertyTypes.DATETIME)
    closed_time = MappedColumn('closed_time', PropertyTypes.DATETIME)
    deleted = MappedColumn('deleted', PropertyTypes.BOOL)
    due_date = MappedColumn('due_date', PropertyTypes.DATETIME)
    last_agent_processed_at = MappedColumn('last_agent_processed_at', PropertyTypes.DATETIME)

    @classmethod
    def gen_table_name(cls):
        return 'tickets'


class TicketCommentsTable(BaseModel):
    ticket_id = MappedColumn('ticket_id', PropertyTypes.INT)
    content = MappedColumn('content', PropertyTypes.TEXT)
    creator = MappedColumn('creator', PropertyTypes.TEXT)
    created_time = MappedColumn('created_time', PropertyTypes.DATETIME)
    modified_time = MappedColumn('modified_time', PropertyTypes.DATETIME)
    deleted = MappedColumn('deleted', PropertyTypes.BOOL)
    via_agent = MappedColumn('via_agent', PropertyTypes.BOOL)

    @classmethod
    def gen_table_name(cls):
        return 'ticket_comments'

class TicketActivitiesTable(BaseModel):
    ticket_id = MappedColumn('ticket_id', PropertyTypes.INT)
    activity_type = MappedColumn('activity_type', PropertyTypes.TEXT)
    detail = MappedColumn('detail', PropertyTypes.TEXT)  # JSON string storing field_name, old_value, new_value
    creator = MappedColumn('creator', PropertyTypes.TEXT)
    created_time = MappedColumn('created_time', PropertyTypes.DATETIME)

    @classmethod
    def gen_table_name(cls):
        return 'ticket_activities'

class EmailTable(BaseModel):
    email_from = MappedColumn('email_from', PropertyTypes.TEXT)
    email_to = MappedColumn('email_to', PropertyTypes.TEXT)
    message_id = MappedColumn('message_id', PropertyTypes.TEXT)
    title = MappedColumn('title', PropertyTypes.TEXT)
    cc = MappedColumn('cc', PropertyTypes.TEXT)
    content = MappedColumn('content', PropertyTypes.TEXT, {'compressed': True})
    text_content = MappedColumn('text_content', PropertyTypes.TEXT, {'compressed': True})
    html_content = MappedColumn('html_content', PropertyTypes.TEXT, {'compressed': True})
    modified_time = MappedColumn('modified_time', PropertyTypes.DATETIME)
    reply_to_message_id = MappedColumn('reply_to_message_id', PropertyTypes.TEXT)
    attachments = MappedColumn('attachments', PropertyTypes.LIST)
    is_sender = MappedColumn('is_sender', PropertyTypes.BOOL)
    sync_time = MappedColumn('sync_time', PropertyTypes.DATETIME)
    deleted = MappedColumn('deleted', PropertyTypes.BOOL)
    thread_id = MappedColumn('thread_id', PropertyTypes.INT)
    email_id = MappedColumn('email_id', PropertyTypes.TEXT)
    origin_thread_id = MappedColumn('origin_thread_id', PropertyTypes.TEXT)

    @classmethod
    def gen_table_name(cls, connection_id):
        return ConnectionType.EMAIL.value + '_' + str(connection_id)


class ThreadTable(BaseModel):
    title = MappedColumn('title', PropertyTypes.TEXT)
    modified_time = MappedColumn('modified_time', PropertyTypes.DATETIME)
    unread = MappedColumn('unread', PropertyTypes.BOOL)
    sync_time = MappedColumn('sync_time', PropertyTypes.DATETIME)
    deleted = MappedColumn('deleted', PropertyTypes.BOOL)
    tags = MappedColumn('tags', PropertyTypes.LIST, ListTypes.int)
    outdated = MappedColumn('outdated', PropertyTypes.BOOL)
    record_modified_time = MappedColumn('record_modified_time', PropertyTypes.DATETIME)
    ai_summary = MappedColumn('ai_summary', PropertyTypes.TEXT)
    ai_processed_time = MappedColumn('ai_processed_time', PropertyTypes.DATETIME)
    ai_summary_vector = MappedColumn('ai_summary_vector', PropertyTypes.LIST, ListTypes.vector)
    linked_ticket = MappedColumn('linked_ticket', PropertyTypes.INT)

    @classmethod
    def gen_table_name(cls, connection_id):
        return ConnectionType.EMAIL.value + '_' + 'thread_' + str(connection_id)


class GeneralTaskTable(BaseModel):
    source_task_id = MappedColumn('source_task_id', PropertyTypes.TEXT)
    title = MappedColumn('title', PropertyTypes.TEXT)
    status = MappedColumn('status', PropertyTypes.SINGLE_SELECT)
    size = MappedColumn('size', PropertyTypes.SINGLE_SELECT)
    priority = MappedColumn('priority', PropertyTypes.SINGLE_SELECT)
    assignees = MappedColumn('assignees', PropertyTypes.LIST)
    participants = MappedColumn('participants', PropertyTypes.LIST)
    version = MappedColumn('version', PropertyTypes.TEXT)
    others = MappedColumn('others', PropertyTypes.TEXT, {'compressed': True})
    content = MappedColumn('content', PropertyTypes.TEXT, {'compressed': True})
    due_date = MappedColumn('due_date', PropertyTypes.DATETIME)
    modified_time = MappedColumn('modified_time', PropertyTypes.DATETIME)
    created_time = MappedColumn('created_time', PropertyTypes.DATETIME)
    sync_time = MappedColumn('sync_time', PropertyTypes.DATETIME)
    deleted = MappedColumn('deleted', PropertyTypes.BOOL)
    outdated = MappedColumn('outdated', PropertyTypes.BOOL)
    record_modified_time = MappedColumn('record_modified_time', PropertyTypes.DATETIME)
    ai_summary = MappedColumn('ai_summary', PropertyTypes.TEXT)
    ai_processed_time = MappedColumn('ai_processed_time', PropertyTypes.DATETIME)
    ai_summary_vector = MappedColumn('ai_summary_vector', PropertyTypes.LIST, ListTypes.vector)
    linked_ticket = MappedColumn('linked_ticket', PropertyTypes.INT)

    @classmethod
    def gen_table_name(cls, connection_id):
        return ConnectionType.GENERAL_TASK.value + '_' + str(connection_id)


class GeneralTaskUserTable(BaseModel):
    email = MappedColumn('email', PropertyTypes.TEXT)
    name = MappedColumn('name', PropertyTypes.TEXT)
    record_modified_time = MappedColumn('record_modified_time', PropertyTypes.DATETIME)

    @classmethod
    def gen_table_name(cls, connection_id):
        return ConnectionType.GENERAL_TASK.value + '_user_' + str(connection_id)


class KnowledgeBaseTable(BaseModel):
    title = MappedColumn('title', PropertyTypes.TEXT)
    content = MappedColumn('content', PropertyTypes.TEXT, {'compressed': True})
    tags = MappedColumn('tags', PropertyTypes.LIST, ListTypes.int)
    ai_summary = MappedColumn('ai_summary', PropertyTypes.TEXT)
    creator = MappedColumn('creator', PropertyTypes.TEXT)
    last_modifier = MappedColumn('last_modifier', PropertyTypes.TEXT)
    created_time = MappedColumn('created_time', PropertyTypes.DATETIME)
    modified_time = MappedColumn('modified_time', PropertyTypes.DATETIME)
    deleted = MappedColumn('deleted', PropertyTypes.BOOL)
    ai_processed_time = MappedColumn('ai_processed_time', PropertyTypes.DATETIME)
    ai_summary_vector = MappedColumn('ai_summary_vector', PropertyTypes.LIST, ListTypes.vector)

    @classmethod
    def gen_table_name(cls):
        return 'knowledge_base'


class TagTable(BaseModel):
    name = MappedColumn('name', PropertyTypes.TEXT)
    color = MappedColumn('color', PropertyTypes.TEXT)
    text_color = MappedColumn('text_color', PropertyTypes.TEXT)
    description = MappedColumn('description', PropertyTypes.TEXT)

    @classmethod
    def gen_table_name(cls):
        return 'tag'


class AgentRunsTable(BaseModel):
    """Agent single run record, each project has its own agent_runs table in SeaDB"""
    status = MappedColumn('status', PropertyTypes.TEXT)              # pending / running / completed / failed
    started_at = MappedColumn('started_at', PropertyTypes.DATETIME)
    finished_at = MappedColumn('finished_at', PropertyTypes.DATETIME)
    items_processed = MappedColumn('items_processed', PropertyTypes.INT)
    error_message = MappedColumn('error_message', PropertyTypes.TEXT)
    events = MappedColumn('events', PropertyTypes.TEXT)  # JSON array of event payloads that triggered this run

    @classmethod
    def gen_table_name(cls):
        return 'agent_runs'


class AgentActionsTable(BaseModel):
    """Agent generated actions.

    source_type values: 'ticket' | 'github_issue' | 'discourse_topic' | 'email_thread'
    source_id format:
      - ticket: str(ticket._pk)
      - others: '{connection_id}_{record_id}'
    """
    run_id = MappedColumn('run_id', PropertyTypes.INT)               # references agent_runs._pk
    source_type = MappedColumn('source_type', PropertyTypes.TEXT)    # ticket / github_issue / discourse_topic / email_thread
    source_id = MappedColumn('source_id', PropertyTypes.TEXT)        # ticket _pk or '{connection_id}_{record_id}'
    source_title = MappedColumn('source_title', PropertyTypes.TEXT)  # human-readable title of the source record
    phase = MappedColumn('phase', PropertyTypes.TEXT)                # prelude, analysis, handling
    prompt = MappedColumn('prompt', PropertyTypes.TEXT)              # system prompt of the specific phase
    result = MappedColumn('result', PropertyTypes.TEXT)              # result of a phase
    action_type = MappedColumn('action_type', PropertyTypes.TEXT)    # analysis / tool_call / suggestion
    status = MappedColumn('status', PropertyTypes.TEXT)              # action status, i.e., pending / confirmed / cancelled / executed / completed
    step = MappedColumn('step', PropertyTypes.INT)
    is_max_step = MappedColumn('is_max_step', PropertyTypes.BOOL)
    tool_name = MappedColumn('tool_name', PropertyTypes.TEXT)        # notify_assignee / add_comment / suggest_create_ticket etc.
    tool_arguments = MappedColumn('tool_arguments', PropertyTypes.TEXT)   # arguments of the tool call
    forced_tool_call = MappedColumn('forced_tool_call', PropertyTypes.BOOL)
    observation = MappedColumn('observation', PropertyTypes.TEXT)    # tool execution result
    suggestion_content = MappedColumn('suggestion_content', PropertyTypes.TEXT) # suggestion content in editor
    sources = MappedColumn('sources', PropertyTypes.TEXT)            # JSON array of references used by analysis action
    statistics = MappedColumn('statistics', PropertyTypes.TEXT)      # JSON: {input_tokens, output_tokens, total_tokens, duration_ms}
    created_at = MappedColumn('created_at', PropertyTypes.DATETIME)
    executed_at = MappedColumn('executed_at', PropertyTypes.DATETIME)

    @classmethod
    def gen_table_name(cls):
        return 'agent_actions'


class NotionTable(BaseModel):
    title = MappedColumn('title', PropertyTypes.TEXT)
    content = MappedColumn('content', PropertyTypes.TEXT, {'compressed': True})
    creator = MappedColumn('creator', PropertyTypes.TEXT)
    last_modifier = MappedColumn('last_modifier', PropertyTypes.TEXT)
    ai_summary = MappedColumn('ai_summary', PropertyTypes.TEXT)
    parent_page_id = MappedColumn('parent_page_id', PropertyTypes.TEXT)
    modified_time = MappedColumn('modified_time', PropertyTypes.DATETIME)
    sync_time = MappedColumn('sync_time', PropertyTypes.DATETIME)
    record_modified_time = MappedColumn('record_modified_time', PropertyTypes.DATETIME)
    outdated = MappedColumn('outdated', PropertyTypes.BOOL)
    created_time = MappedColumn('created_time', PropertyTypes.DATETIME)
    page_id = MappedColumn('page_id', PropertyTypes.TEXT)
    deleted = MappedColumn('deleted', PropertyTypes.BOOL)
    ai_processed_time = MappedColumn('ai_processed_time', PropertyTypes.DATETIME)
    ai_summary_vector = MappedColumn('ai_summary_vector', PropertyTypes.LIST, ListTypes.vector)

    @classmethod
    def gen_table_name(cls, connection_id):
        return ConnectionType.NOTION.value + '_' + str(connection_id)
  
class PortalIssuesTable(BaseModel):
    """Issues submitted by external users through the support portal."""
    title = MappedColumn('title', PropertyTypes.TEXT)
    content = MappedColumn('content', PropertyTypes.TEXT)
    ai_summary = MappedColumn('ai_summary', PropertyTypes.TEXT)
    ai_processed_time = MappedColumn('ai_processed_time', PropertyTypes.DATETIME)
    ai_summary_vector = MappedColumn('ai_summary_vector', PropertyTypes.LIST, ListTypes.vector)
    creator = MappedColumn('creator', PropertyTypes.TEXT)
    state = MappedColumn('state', PropertyTypes.SINGLE_SELECT, data=SelectTypes.ticket_status)
    substate = MappedColumn('substate', PropertyTypes.SINGLE_SELECT, data=SelectTypes.ticket_substate)
    type = MappedColumn('type', PropertyTypes.SINGLE_SELECT, data=SelectTypes.ticket_type)
    tags = MappedColumn('tags', PropertyTypes.LIST, ListTypes.int)
    priority = MappedColumn('priority', PropertyTypes.INT)
    linked_ticket = MappedColumn('linked_ticket', PropertyTypes.INT)
    comment_count = MappedColumn('comment_count', PropertyTypes.INT)
    created_time = MappedColumn('created_time', PropertyTypes.DATETIME)
    modified_time = MappedColumn('modified_time', PropertyTypes.DATETIME)
    closed_time = MappedColumn('closed_time', PropertyTypes.DATETIME)
    deleted = MappedColumn('deleted', PropertyTypes.BOOL)

    @classmethod
    def gen_table_name(cls):
        return 'portal_issues'


class PortalIssueCommentsTable(BaseModel):
    """Comments on portal issues submitted by external users."""
    issue_id = MappedColumn('issue_id', PropertyTypes.INT)
    content = MappedColumn('content', PropertyTypes.TEXT)
    creator = MappedColumn('creator', PropertyTypes.TEXT)
    created_time = MappedColumn('created_time', PropertyTypes.DATETIME)
    modified_time = MappedColumn('modified_time', PropertyTypes.DATETIME)
    deleted = MappedColumn('deleted', PropertyTypes.BOOL)

    @classmethod
    def gen_table_name(cls):
        return 'portal_issue_comments'
