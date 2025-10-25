export const OPERATION_TYPE = {
  // view
  MODIFY_FILTERS: 'modify_filters',
  MODIFY_SORTS: 'modify_sorts',
  MODIFY_GROUPBYS: 'modify_groupbys',
  MODIFY_ROW_HEIGHT: 'modify_row_height',
  MODIFY_HIDDEN_COLUMNS: 'modify_hidden_columns',
  MODIFY_SETTINGS: 'modify_settings',
  MODIFY_LOCAL_VIEW: 'modify_local_view',
  MODIFY_VIEW_TYPE: 'modify_view_type',

  // column
  INSERT_COLUMN: 'insert_column',
  DELETE_COLUMN: 'delete_column',
  RENAME_COLUMN: 'rename_column',
  MODIFY_COLUMN_DATA: 'modify_column_data',
  MODIFY_LOCAL_COLUMN_DATA: 'modify_local_column_data',
  MODIFY_COLUMN_WIDTH: 'modify_column_width',
  MODIFY_COLUMN_ORDER: 'modify_column_order',

  // row
  INSERT_ROW: 'insert_row',
  MODIFY_ROW: 'modify_row',
  MODIFY_ROWS: 'modify_rows',
  DELETE_ROW: 'delete_row',
  DELETE_ROWS: 'delete_rows',
  RESTORE_ROWS: 'restore_rows',
  RELOAD_ROWS: 'reload_rows',
  LOCK_ROW_VIA_BUTTON: 'lock_row_via_button',
  MODIFY_ROW_VIA_BUTTON: 'modify_row_via_button',
  MODIFY_LOCAL_ROW: 'modify_local_row',
  MOVE_ROW: 'move_row',
  DUPLICATE_ROW: 'duplicate_row',
  SEARCH_ROWS: 'search_rows',
};

export const COLUMN_DATA_OPERATION_TYPE = {
  ADD_OPTION: 'add_options',
  DELETE_OPTION: 'delete_option',
  RENAME_OPTION: 'rename_option',
  MODIFY_OPTION_COLOR: 'modify_option_color',
  MOVE_OPTION: 'move_option',
  INIT_NEW_OPTION: 'init_new_option',
};

export const OPERATION_ATTRIBUTES = {
  [OPERATION_TYPE.INSERT_ROW]: ['row', 'row_data'],
  [OPERATION_TYPE.MODIFY_ROW]: ['row_id', 'row_update', 'original_update', 'old_row_data', 'original_old_row_data', 'is_copy_paste'],
  [OPERATION_TYPE.MODIFY_ROWS]: ['row_ids', 'id_row_updates', 'id_original_row_updates', 'id_old_row_data', 'id_original_old_row_data', 'is_copy_paste'],
  [OPERATION_TYPE.DELETE_ROW]: ['row_id', 'row_data'],
  [OPERATION_TYPE.DELETE_ROWS]: ['rows_ids', 'deleted_rows'],
  [OPERATION_TYPE.RELOAD_ROWS]: ['row_ids'],
  [OPERATION_TYPE.MOVE_ROW]: ['row_id', 'update_data'],
  [OPERATION_TYPE.DUPLICATE_ROW]: ['row_id'],
  [OPERATION_TYPE.MODIFY_LOCAL_ROW]: ['row_id', 'updates'],

  [OPERATION_TYPE.MODIFY_FILTERS]: ['view_id', 'filter_conjunction', 'filters', 'basic_filters'],
  [OPERATION_TYPE.MODIFY_SORTS]: ['view_id', 'sorts'],
  [OPERATION_TYPE.MODIFY_GROUPBYS]: ['view_id', 'groupbys'],
  [OPERATION_TYPE.MODIFY_ROW_HEIGHT]: ['view_id', 'row_height'],
  [OPERATION_TYPE.MODIFY_HIDDEN_COLUMNS]: ['view_id', 'hidden_columns'],
  [OPERATION_TYPE.MODIFY_LOCAL_VIEW]: ['view_id', 'update'],
  [OPERATION_TYPE.MODIFY_VIEW_TYPE]: ['view_id', 'update'],

  [OPERATION_TYPE.INSERT_COLUMN]: ['name', 'column_type', 'column_key', 'data', 'column'],
  [OPERATION_TYPE.RENAME_COLUMN]: ['column_key', 'new_name', 'old_name'],
  [OPERATION_TYPE.MODIFY_COLUMN_DATA]: ['column_key', 'new_data', 'old_data', 'option_modify_type'],
  [OPERATION_TYPE.MODIFY_LOCAL_COLUMN_DATA]: ['column_key', 'new_data', 'old_data'],
  [OPERATION_TYPE.DELETE_COLUMN]: ['column_key', 'column'],
  [OPERATION_TYPE.MODIFY_COLUMN_WIDTH]: ['column_key', 'new_width', 'old_width'],
  [OPERATION_TYPE.MODIFY_COLUMN_ORDER]: ['view_id', 'new_columns_keys', 'old_columns_keys'],

  [OPERATION_TYPE.MODIFY_SETTINGS]: ['view_id', 'settings'],

  [OPERATION_TYPE.SEARCH_ROWS]: ['value'],
};

export const UNDO_OPERATION_TYPE = [
  OPERATION_TYPE.INSERT_ROW,
  OPERATION_TYPE.DELETE_ROW,
  OPERATION_TYPE.MODIFY_ROW,
  OPERATION_TYPE.MODIFY_ROWS,
  OPERATION_TYPE.INSERT_COLUMN,
  OPERATION_TYPE.DELETE_COLUMN,
  OPERATION_TYPE.RENAME_COLUMN,
  OPERATION_TYPE.MODIFY_COLUMN_DATA,
  OPERATION_TYPE.MODIFY_COLUMN_WIDTH,
  OPERATION_TYPE.MODIFY_COLUMN_ORDER,
];

// only apply operation on the local
export const LOCAL_APPLY_OPERATION_TYPE = [
  OPERATION_TYPE.MODIFY_COLUMN_WIDTH,
  OPERATION_TYPE.MODIFY_LOCAL_ROW,
  OPERATION_TYPE.MODIFY_LOCAL_COLUMN_DATA,
  OPERATION_TYPE.MODIFY_LOCAL_VIEW,
  OPERATION_TYPE.SEARCH_ROWS,
];

// apply operation after exec operation on the server
export const NEED_APPLY_AFTER_SERVER_OPERATION = [
  OPERATION_TYPE.INSERT_ROW,
  OPERATION_TYPE.INSERT_COLUMN,
  OPERATION_TYPE.MODIFY_FILTERS,
  OPERATION_TYPE.MODIFY_SORTS,
  OPERATION_TYPE.MOVE_ROW,
  OPERATION_TYPE.DUPLICATE_ROW,
];

export const VIEW_OPERATION = [
  OPERATION_TYPE.MODIFY_FILTERS,
  OPERATION_TYPE.MODIFY_SORTS,
  OPERATION_TYPE.MODIFY_GROUPBYS,
  OPERATION_TYPE.MODIFY_HIDDEN_COLUMNS,
  OPERATION_TYPE.MODIFY_VIEW_TYPE,
];

export const COLUMN_OPERATION = [
  OPERATION_TYPE.INSERT_COLUMN,
  OPERATION_TYPE.DELETE_COLUMN,
  OPERATION_TYPE.RENAME_COLUMN,
  OPERATION_TYPE.MODIFY_COLUMN_DATA,
  OPERATION_TYPE.MODIFY_COLUMN_WIDTH,
  OPERATION_TYPE.MODIFY_COLUMN_ORDER,
  OPERATION_TYPE.MODIFY_LOCAL_COLUMN_DATA,
];

export const RE_SEARCH_ROWS_OPERATION = [
  // view
  OPERATION_TYPE.MODIFY_SORTS,
  OPERATION_TYPE.MODIFY_GROUPBYS,
  OPERATION_TYPE.MODIFY_HIDDEN_COLUMNS,
  OPERATION_TYPE.MODIFY_SETTINGS,
  OPERATION_TYPE.MODIFY_LOCAL_VIEW,
  OPERATION_TYPE.MODIFY_VIEW_TYPE,

  // column
  OPERATION_TYPE.INSERT_COLUMN,
  OPERATION_TYPE.DELETE_COLUMN,
  OPERATION_TYPE.MODIFY_COLUMN_DATA,
  OPERATION_TYPE.MODIFY_LOCAL_COLUMN_DATA,

  // row
  OPERATION_TYPE.INSERT_ROW,
  OPERATION_TYPE.MODIFY_ROW,
  OPERATION_TYPE.MODIFY_ROWS,
  OPERATION_TYPE.DELETE_ROW,
  OPERATION_TYPE.DELETE_ROWS,
  OPERATION_TYPE.RESTORE_ROWS,
  OPERATION_TYPE.RELOAD_ROWS,
  OPERATION_TYPE.MODIFY_ROW_VIA_BUTTON,
  OPERATION_TYPE.MODIFY_LOCAL_ROW,
  OPERATION_TYPE.MOVE_ROW,
  OPERATION_TYPE.DUPLICATE_ROW,
];
