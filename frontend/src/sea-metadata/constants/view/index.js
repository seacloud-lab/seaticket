import { SORT_COLUMN_OPTIONS, GALLERY_SORT_COLUMN_OPTIONS, GALLERY_FIRST_SORT_COLUMN_OPTIONS,
} from '../sort';

export * from './gallery';
export * from './kanban';
export * from './table';

export const METADATA_VIEWS_KEY = 'sea-metadata-views';

export const METADATA_VIEWS_DRAG_DATA_KEY = 'application/drag-sea-metadata-views';

export const TREE_NODE_LEFT_INDENT = 20;

export const VIEWS_TYPE_FOLDER = 'folder';

export const VIEWS_TYPE_VIEW = 'view';

export const VIEW_TYPE = {
  TABLE: 'table',
  GALLERY: 'gallery',
  KANBAN: 'kanban',
};

export const FACE_RECOGNITION_VIEW_ID = '_face_recognition';

export const VIEW_TYPE_ICON = {
  [VIEW_TYPE.TABLE]: 'table',
  [VIEW_TYPE.GALLERY]: 'gallery',
  [VIEW_TYPE.KANBAN]: 'kanban',
};

export const VIEW_TYPE_DEFAULT_BASIC_FILTER = {
  [VIEW_TYPE.TABLE]: [],
  [VIEW_TYPE.GALLERY]: [],
  [VIEW_TYPE.KANBAN]: [],
};

export const VIEW_TYPE_DEFAULT_SORTS = {
  [VIEW_TYPE.TABLE]: [],
  [VIEW_TYPE.GALLERY]: [],
  [VIEW_TYPE.KANBAN]: [],
};

export const VIEW_SORT_COLUMN_RULES = {
  [VIEW_TYPE.TABLE]: (column) => SORT_COLUMN_OPTIONS.includes(column.type) && column.sort_able,
  [VIEW_TYPE.GALLERY]: (column) => GALLERY_SORT_COLUMN_OPTIONS.includes(column.type) && column.sort_able,
  [VIEW_TYPE.KANBAN]: (column) => SORT_COLUMN_OPTIONS.includes(column.type) && column.sort_able,
};

export const VIEW_FIRST_SORT_COLUMN_RULES = {
  [VIEW_TYPE.TABLE]: (column) => SORT_COLUMN_OPTIONS.includes(column.type),
  [VIEW_TYPE.GALLERY]: (column) => GALLERY_FIRST_SORT_COLUMN_OPTIONS.includes(column.type),
  [VIEW_TYPE.KANBAN]: (column) => SORT_COLUMN_OPTIONS.includes(column.type),
};

export const KANBAN_SETTINGS_KEYS = {
  GROUP_BY_COLUMN_KEY: 'group_by_column_key',
  TITLE_COLUMN_KEY: 'title_column_key',
  HIDE_EMPTY_VALUE: 'hide_empty_value',
  SHOW_COLUMN_NAME: 'show_column_name',
  TEXT_WRAP: 'text_wrap',
  COLUMNS: 'columns', // display and order
};

export const VIEW_DEFAULT_SETTINGS = {
  [VIEW_TYPE.TABLE]: {},
  [VIEW_TYPE.GALLERY]: {},
  [VIEW_TYPE.KANBAN]: {
    [KANBAN_SETTINGS_KEYS.GROUP_BY_COLUMN_KEY]: '',
    [KANBAN_SETTINGS_KEYS.TITLE_COLUMN_KEY]: '',
    [KANBAN_SETTINGS_KEYS.HIDE_EMPTY_VALUE]: false,
    [KANBAN_SETTINGS_KEYS.SHOW_COLUMN_NAME]: false,
    [KANBAN_SETTINGS_KEYS.TEXT_WRAP]: false,
    [KANBAN_SETTINGS_KEYS.COLUMNS]: [],
  }
};

export const VIEW_PROPERTY_KEYS = {
  ID: '_id',
  TABLE_ID: 'table_id',
  NAME: 'name',
  BASIC_FILTERS: 'basic_filters',
  FILTERS: 'filters',
  FILTER_CONJUNCTION: 'filter_conjunction',
  SORTS: 'sorts',
  GROUPBYS: 'groupbys',
  HIDDEN_COLUMNS: 'hidden_columns',
  TYPE: 'type',
  SETTINGS: 'settings',
};

export const VIEW_INCOMPATIBLE_PROPERTIES = [
  VIEW_PROPERTY_KEYS.GROUPBYS,
  VIEW_PROPERTY_KEYS.HIDDEN_COLUMNS,
  VIEW_PROPERTY_KEYS.SETTINGS,
];

export const VIEW_TYPES_SUPPORT_SHOW_DETAIL = [VIEW_TYPE.GALLERY, VIEW_TYPE.KANBAN];

export const VIEW_TOOL = {
  VIEWS: 'views',
  ROWS_TOOLS: 'rows_tools',
  SEARCH: 'search',
  FILTERS: 'filters',
  SORTS: 'sorts',
  GROUPBYS: 'groupbys',
  ROW_HEIGHT: 'row_height',
  ORDER_HIDDEN: 'order_and_hidden',
  MANAGE: 'manage'
};

export const VIEW_TOOLS = [
  VIEW_TOOL.VIEWS,
  VIEW_TOOL.ROWS_TOOLS,
  VIEW_TOOL.SEARCH,
  VIEW_TOOL.FILTERS,
  VIEW_TOOL.SORTS,
  VIEW_TOOL.GROUPBYS,
  VIEW_TOOL.ROW_HEIGHT,
  VIEW_TOOL.ORDER_HIDDEN,
  VIEW_TOOL.MANAGE,
];
