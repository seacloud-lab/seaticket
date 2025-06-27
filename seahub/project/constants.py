# dtable columns types
class ColumnTypes:
    COLLABORATOR = 'collaborator'
    NUMBER = 'number'
    DATE = 'date'
    GEOLOCATION = 'geolocation'
    CREATOR = 'creator'
    LAST_MODIFIER = 'last-modifier'
    TEXT = 'text'
    IMAGE = 'image'
    LONG_TEXT = 'long-text'
    CHECKBOX = 'checkbox'
    SINGLE_SELECT = 'single-select'
    MULTIPLE_SELECT = 'multiple-select'
    URL = 'url'
    DURATION = 'duration'
    FILE = 'file'
    EMAIL = 'email'
    RATE = 'rate'
    FORMULA = 'formula'
    LINK_FORMULA = 'link-formula'
    AUTO_NUMBER = 'auto-number'
    LINK = 'link'
    CTIME = 'ctime'
    MTIME = 'mtime'
    BUTTON = 'button'
    DEPARTMENT_SINGLE_SELECT = 'department-single-select'
    DIGITAL_SIGN = 'digital-sign'

    @classmethod
    def is_valid(cls, item):
        if not getattr(cls, 'column_types_set', None):
            cls.column_types_set = {
                getattr(cls, attr)
                for attr in dir(cls)
                if not attr.startswith('__') and not callable(getattr(cls, attr))
            }
        return item in getattr(cls, 'column_types_set')


# dtable formula result type
FORMULA_RESULT_TYPE_STRING = 'string'
FORMULA_RESULT_TYPE_NUMBER = 'number'
FORMULA_RESULT_TYPE_DATE = 'date'
FORMULA_RESULT_TYPE_BOOL = 'bool'
FORMULA_RESULT_TYPE_ARRAY = 'array'

ARRAY_FORMAL_COLUMNS = [
    ColumnTypes.IMAGE,
    ColumnTypes.FILE,
    ColumnTypes.MULTIPLE_SELECT,
    ColumnTypes.COLLABORATOR
]

# duration format
class DurationFormatsType(object):
    H_MM = 'h:mm'
    H_MM_SS = 'h:mm:ss'
    H_MM_SS_S = 'h:mm:ss.s'
    H_MM_SS_SS = 'h:mm:ss.ss'
    H_MM_SS_SSS = 'h:mm:ss.sss'

DURATION_ZERO_DISPLAY = {
    DurationFormatsType.H_MM: '0:00',
    DurationFormatsType.H_MM_SS: '0:00',
    DurationFormatsType.H_MM_SS_S: '0:00.0',
    DurationFormatsType.H_MM_SS_SS: '0:00.00',
    DurationFormatsType.H_MM_SS_SSS: '0:00.000'
}

# button modify row
BUTTON_MODIFY_ROW_COLUMN_TYPES = [
    ColumnTypes.CHECKBOX,
    ColumnTypes.COLLABORATOR,
    ColumnTypes.DATE,
    ColumnTypes.DURATION,
    ColumnTypes.MULTIPLE_SELECT,
    ColumnTypes.SINGLE_SELECT,
    ColumnTypes.RATE,
    ColumnTypes.EMAIL,
    ColumnTypes.NUMBER,
    ColumnTypes.TEXT,
    ColumnTypes.URL
]


# cache
ORG_STORAGE_SIZE_PREFIX = 'ORG_STORAGE_SIZE_'
ORG_STORAGE_SIZE_CACHE_TIMEOUT = 60 * 60 * 24

ORG_BIG_DATA_TOTAL_STORAGE_PREFIX = 'ORG_BIG_DATA_TOTAL_STORAGE_'
ORG_BIG_DATA_TOTAL_STORAGE_CACHE_TIMEOUT = 60 * 60 * 24

ORG_BIG_DATA_TOTAL_ROWS_PREFIX = 'ORG_BIG_DATA_TOTAL_ROWS_'
ORG_BIG_DATA_TOTAL_ROWS_CACHE_TIMEOUT = 60 * 60 * 24

DTABLE_RELATED_USERS_PREFIX = 'DTABLE_RELATED_USERS_'
DTABLE_RELATED_USERS_INFO_PREFIX = 'DTABLE_RELATED_USERS_INFO_'
DTABLE_RELATED_USERS_CACHE_TIMEOUT = 60 * 60 * 24

DTABLE_APP_USERS_PREFIX = 'DTABLE_APP_USERS_'
DTABLE_APP_USERS_INFO_PREFIX = 'DTABLE_APP_USERS_INFO_'
DTABLE_APP_USERS_CACHE_TIMEOUT = 60 * 60 * 24

DTABLE_IS_ADVANCE_PREFIX = 'DTABLE_IS_ADVANCE_'
DTABLE_IS_ADVANCE_CACHE_TIMEOUT = 60 * 60

DTABLE_ASSET_READ_PERMISSION = 'ASSET_READ_PERM_'
DTABLE_ASSET_DOWNLOAD_PERMISSION = 'ASSET_DOWNLOAD_PERM_'

# single/multiple select options
VALID_OPTION_TAGS = [
    {'color': '#FFFCB5', 'border_color': '#E8E79D', 'text_color': '#212529'},
    {'color': '#FFEAB6', 'border_color': '#ECD084', 'text_color': '#212529'},
    {'color': '#FFD9C8', 'border_color': '#EFBAA3', 'text_color': '#212529'},
    {'color': '#FFDDE5', 'border_color': '#EDC4C1', 'text_color': '#212529'},
    {'color': '#FFD4FF', 'border_color': '#E6B6E6', 'text_color': '#212529'},
    {'color': '#DAD7FF', 'border_color': '#C3BEEF', 'text_color': '#212529'},
    {'color': '#DDFFE6', 'border_color': '#BBEBCD', 'text_color': '#212529'},
    {'color': '#DEF7C4', 'border_color': '#C5EB9E', 'text_color': '#212529'},
    {'color': '#D8FAFF', 'border_color': '#B4E4E9', 'text_color': '#212529'},
    {'color': '#D7E8FF', 'border_color': '#BAD1E9', 'text_color': '#212529'},
    {'color': '#B7CEF9', 'border_color': '#96B2E1', 'text_color': '#212529'},
    {'color': '#E9E9E9', 'border_color': '#DADADA', 'text_color': '#212529'},
    {'color': '#FBD44A', 'border_color': '#E5C142', 'text_color': '#FFFFFF'},
    {'color': '#EAA775', 'border_color': '#D59361', 'text_color': '#FFFFFF'},
    {'color': '#F4667C', 'border_color': '#DC556A', 'text_color': '#FFFFFF'},
    {'color': '#DC82D2', 'border_color': '#D166C5', 'text_color': '#FFFFFF'},
    {'color': '#9860E5', 'border_color': '#844BD2', 'text_color': '#FFFFFF'},
    {'color': '#9F8CF1', 'border_color': '#8F75E2', 'text_color': '#FFFFFF'},
    {'color': '#59CB74', 'border_color': '#4EB867', 'text_color': '#FFFFFF'},
    {'color': '#ADDF84', 'border_color': '#9CCF72', 'text_color': '#FFFFFF'},
    {'color': '#89D2EA', 'border_color': '#7BC0D6', 'text_color': '#FFFFFF'},
    {'color': '#4ECCCB', 'border_color': '#45BAB9', 'text_color': '#FFFFFF'},
    {'color': '#46A1FD', 'border_color': '#3C8FE4', 'text_color': '#FFFFFF'},
    {'color': '#C2C2C2', 'border_color': '#ADADAD', 'text_color': '#FFFFFF'},
]

EMAIL_SYNC_TABLES_DICT = {
    "email_table": [
        {"column_name": "From", "type": "text"},
        {"column_name": "Message ID", "type": "text"},
        {"column_name": "To", "type": "text"},
        {"column_name": "Subject", "type": "text"},
        {"column_name": "cc", "type": "text"},
        {"column_name": "Content", "type": "long-text"},
        {"column_name": "HTML Content", "type": "long-text", "check_required": False},
        {"column_name": "Attachment", "type": "file", "check_required": False},
        {"column_name": "Date", "type": "date", "data": {"format": "YYYY-MM-DD HH:mm"}},
        {"column_name": "Reply to Message ID", "type": "text"},
        {"column_name": "Thread ID", "type": "text"}
    ],
    "link_table": [
        {"column_name": "Subject", "type": "text"},
        {"column_name": "Last Updated", "type": "date", "data": {"format": "YYYY-MM-DD HH:mm"}},
        {"column_name": "Thread ID", "type": "text"},
        {"column_name": "Unread", "type": "checkbox", "check_required": False}
    ]
}
