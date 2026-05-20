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
