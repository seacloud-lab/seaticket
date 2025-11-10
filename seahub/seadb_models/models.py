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
          "name": "completed",
          "color": "#8250DF",
          "text_color": "#FFFFFF",
        },
        {
          "id": "0003",
          "name": "not_planned",
          "color": "#59636E",
          "text_color": "#FFFFFF"
        },
        {
          "id": "0004",
          "name": "duplicate",
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
          "text_color": "#FFFFFF",

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

    issue_type = {
      "options": [
        {
          "id": "0001",
          "name": "Bug",
          "color": "#ffebe9",
          "text_color": "#d1242f"
        },
        {
          "id": "0002",
          "name": "Feature",
          "color": "#ddf4ff",
          "text_color": "#0969da"
        },
        {
          "id": "0003",
          "name": "Task",
          "color": "#fff8c5",
          "text_color": "#9a6700"
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
    bumped_at = MappedColumn('bumped_at', PropertyTypes.DATETIME)
    deleted = MappedColumn('deleted', PropertyTypes.BOOL)
    updated_at = MappedColumn('updated_at', PropertyTypes.DATETIME)
    created_at = MappedColumn('created_at', PropertyTypes.DATETIME)

    @classmethod
    def gen_table_name(cls, connection_id):
        return ConnectionType.DISCOURSE_FORUM.value + '_' + str(connection_id)


class DiscourseRepliesTable(BaseModel):
    topic_id = MappedColumn('topic_id', PropertyTypes.INT)
    post_number = MappedColumn('post_number', PropertyTypes.INT)
    content = MappedColumn('content', PropertyTypes.TEXT, {'compressed': True})
    author = MappedColumn('author', PropertyTypes.TEXT)
    updated_at = MappedColumn('updated_at', PropertyTypes.DATETIME)

    @classmethod
    def gen_table_name(cls, connection_id):
        return ConnectionType.DISCOURSE_FORUM.value + '_replies' + '_' + str(connection_id)


class WebCrawlTable(BaseModel):
    url = MappedColumn('url', PropertyTypes.TEXT)
    title = MappedColumn('title', PropertyTypes.TEXT)
    etag = MappedColumn('etag', PropertyTypes.TEXT)
    last_modified = MappedColumn('last_modified', PropertyTypes.DATETIME)
    updated_at = MappedColumn('updated_at', PropertyTypes.DATETIME)
    deleted = MappedColumn('deleted', PropertyTypes.BOOL)
    hash = MappedColumn('hash', PropertyTypes.TEXT)

    @classmethod
    def gen_table_name(cls, connection_id):
        return ConnectionType.SITE.value + '_' + str(connection_id)


class GithubIssuesTable(BaseModel):
    issue_id = MappedColumn('issue_id', PropertyTypes.INT)
    issue_number = MappedColumn('issue_number', PropertyTypes.INT)
    title = MappedColumn('title', PropertyTypes.TEXT)
    ai_title = MappedColumn('ai_title', PropertyTypes.TEXT)
    body = MappedColumn('body', PropertyTypes.TEXT, {'compressed': True})
    state = MappedColumn('state', PropertyTypes.SINGLE_SELECT, SelectTypes.state)
    state_reason = MappedColumn('state_reason', PropertyTypes.SINGLE_SELECT, SelectTypes.state_reason)
    labels = MappedColumn('labels', PropertyTypes.MULTIPLE_SELECT)
    issue_type = MappedColumn('issue_type', PropertyTypes.SINGLE_SELECT, SelectTypes.issue_type)
    author = MappedColumn('author', PropertyTypes.TEXT)
    assignees = MappedColumn('assignees', PropertyTypes.TEXT)
    url = MappedColumn('url', PropertyTypes.TEXT)
    created_at = MappedColumn('created_at', PropertyTypes.DATETIME)
    updated_at = MappedColumn('updated_at', PropertyTypes.DATETIME)
    closed_at = MappedColumn('closed_at', PropertyTypes.DATETIME)
    comments_count = MappedColumn('comments_count', PropertyTypes.INT)
    deleted = MappedColumn('deleted', PropertyTypes.BOOL)

    @classmethod
    def gen_table_name(cls, connection_id):
        return ConnectionType.GITHUB_ISSUE.value + '_' + str(connection_id)


class GithubIssueCommentsTable(BaseModel):
    comment_id = MappedColumn('comment_id', PropertyTypes.INT)
    issue_id = MappedColumn('issue_id', PropertyTypes.INT)
    author = MappedColumn('author', PropertyTypes.TEXT)
    body = MappedColumn('body', PropertyTypes.TEXT, {'compressed': True})
    created_at = MappedColumn('created_at', PropertyTypes.DATETIME)
    updated_at = MappedColumn('updated_at', PropertyTypes.DATETIME)
    deleted = MappedColumn('deleted', PropertyTypes.BOOL)

    @classmethod
    def gen_table_name(cls, connection_id):
        return ConnectionType.GITHUB_ISSUE.value + '_comments' + '_' + str(connection_id)

class SeafileTable(BaseModel):
    path = MappedColumn('path', PropertyTypes.TEXT)
    filename = MappedColumn('filename', PropertyTypes.TEXT)
    mtime = MappedColumn('mtime', PropertyTypes.DATETIME)
    content = MappedColumn('content', PropertyTypes.TEXT, {'compressed': True})
    updated_at = MappedColumn('updated_at', PropertyTypes.DATETIME)
    deleted = MappedColumn('deleted', PropertyTypes.BOOL)

    @classmethod
    def gen_table_name(cls, connection_id):
        return ConnectionType.SEAFILE.value + '_' + str(connection_id)

class TicketsTable(BaseModel):
    title = MappedColumn('title', PropertyTypes.TEXT)
    description = MappedColumn('description', PropertyTypes.TEXT)
    status = MappedColumn('status', PropertyTypes.SINGLE_SELECT, data=SelectTypes.ticket_status)
    type = MappedColumn('type', PropertyTypes.SINGLE_SELECT)
    tags = MappedColumn('tags', PropertyTypes.MULTIPLE_SELECT)
    assignees = MappedColumn('assignees', PropertyTypes.LIST)
    participants = MappedColumn('participants', PropertyTypes.LIST)
    priority = MappedColumn('priority', PropertyTypes.INT)
    creator = MappedColumn('creator', PropertyTypes.TEXT)
    reply_count = MappedColumn('reply_count', PropertyTypes.INT)
    created_at = MappedColumn('created_at', PropertyTypes.DATETIME)
    updated_at = MappedColumn('updated_at', PropertyTypes.DATETIME)
    reply_updated_at = MappedColumn('reply_updated_at', PropertyTypes.DATETIME)
    deleted = MappedColumn('deleted', PropertyTypes.BOOL)
    delete_at = MappedColumn('delete_at', PropertyTypes.DATETIME)

class TicketRepliesTable(BaseModel):
    ticket_id = MappedColumn('ticket_id', PropertyTypes.INT)
    content = MappedColumn('content', PropertyTypes.TEXT)
    creator = MappedColumn('creator', PropertyTypes.TEXT)
    created_at = MappedColumn('created_at', PropertyTypes.DATETIME)
    updated_at = MappedColumn('updated_at', PropertyTypes.DATETIME)
    delete_at = MappedColumn('delete_at', PropertyTypes.DATETIME)
    deleted = MappedColumn('deleted', PropertyTypes.BOOL)


class EmailTable(BaseModel):
    email_from = MappedColumn('email_from', PropertyTypes.TEXT)
    email_to = MappedColumn('email_to', PropertyTypes.TEXT)
    message_id = MappedColumn('message_id', PropertyTypes.TEXT)
    subject = MappedColumn('subject', PropertyTypes.TEXT)
    cc = MappedColumn('cc', PropertyTypes.TEXT)
    content = MappedColumn('content', PropertyTypes.TEXT, {'compressed': True})
    html_content = MappedColumn('html_content', PropertyTypes.TEXT, {'compressed': True})
    email_date = MappedColumn('email_date', PropertyTypes.DATETIME)
    reply_to_message_id = MappedColumn('reply_to_message_id', PropertyTypes.TEXT)
    attachments = MappedColumn('attachments', PropertyTypes.LIST)
    is_sender = MappedColumn('is_sender', PropertyTypes.BOOL)
    updated_at = MappedColumn('updated_at', PropertyTypes.DATETIME)
    deleted = MappedColumn('deleted', PropertyTypes.BOOL)

    @classmethod
    def gen_table_name(cls, connection_id):
        return ConnectionType.EMAIL.value + '_' + str(connection_id)
