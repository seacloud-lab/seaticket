import { SORT_COLUMN_OPTIONS } from '../sort';

export * from './table';

export const VIEW_TYPE = {
  TABLE: 'table',
};

export const FACE_RECOGNITION_VIEW_ID = '_face_recognition';

export const VIEW_TYPE_ICON = {
  [VIEW_TYPE.TABLE]: 'table',
};

export const VIEW_TYPE_DEFAULT_SORTS = {
  [VIEW_TYPE.TABLE]: [],
};

export const VIEW_SORT_COLUMN_RULES = {
  [VIEW_TYPE.TABLE]: (column) => SORT_COLUMN_OPTIONS.includes(column.type) && column.sort_able,
};

export const VIEW_FIRST_SORT_COLUMN_RULES = {
  [VIEW_TYPE.TABLE]: (column) => SORT_COLUMN_OPTIONS.includes(column.type),
};

export const VIEW_DEFAULT_SETTINGS = {
  [VIEW_TYPE.TABLE]: {},
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

export const VIEW_TOOL = {
  VIEWS: 'views',
  ROWS_TOOLS: 'rows_tools',
  SEARCH: 'search',
  FILTERS: 'filters',
  SORTS: 'sorts',
  GROUPBYS: 'groupbys',
  ROW_HEIGHT: 'row_height',
  ORDER_HIDDEN: 'order_and_hidden',
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
];
