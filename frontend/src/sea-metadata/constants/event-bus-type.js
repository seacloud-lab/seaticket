/*
  Handle metadata internal events
*/

export const EVENT_BUS_TYPE = {
  // views
  ADD_VIEW: 'add_view',

  // collaborators
  QUERY_COLLABORATORS: 'query_collaborators',
  QUERY_COLLABORATOR: 'query_collaborator',

  // table
  LOCAL_DATA_CHANGED: 'local_table_changed',
  SERVER_DATA_CHANGED: 'server_table_changed',
  TABLE_ERROR: 'table_error',
  OPEN_EDITOR: 'open_editor',
  CLOSE_EDITOR: 'close_editor',
  SELECT_CELL: 'select_cell',
  SELECT_START: 'select_start',
  SELECT_UPDATE: 'select_update',
  SELECT_END: 'select_end',
  SELECT_END_WITH_SHIFT: 'select_end_with_shift',
  SELECT_NONE: 'select_none',
  COPY_CELLS: 'copy_cells',
  PASTE_CELLS: 'paste_cells',
  CUT_CELLS: 'cut_cells',
  SEARCH_CELLS: 'search_cells',
  CLOSE_SEARCH_CELLS: 'close_search_cells',
  OPEN_SELECT: 'open_select',
  SELECT_COLUMN: 'select_column',
  DRAG_ENTER: 'drag_enter',
  COLLAPSE_ALL_GROUPS: 'collapse_all_groups',
  EXPAND_ALL_GROUPS: 'expand_all_groups',
  LOCAL_ROW_CHANGED: 'local_row_changed',
  LOCAL_ROW_DETAIL_CHANGED: 'local_row_detail_changed',
  LOCAL_COLUMN_DATA_CHANGED: 'local_column_data_changed',
  FOCUS_CANVAS: 'focus_canvas',
  UPDATE_SELECTED_ROW_IDS: 'update_selected_row_ids',
  SELECT_ROWS: 'select_rows',
  MOVE_ROW: 'move_row',
  DELETE_ROWS: 'delete_rows',
  EXPAND_ROW: 'expand_row',
  UPDATE_TABLE_ROWS: 'update_table_rows',

  // metadata
  RELOAD_DATA: 'reload_data',
  UPDATE_SEARCH_RESULT: 'update_search_result',
  LOADING: 'loading',
  CLEAR_DATA: 'clear_data',

  // view
  MODIFY_FILTERS: 'modify_filters',
  MODIFY_SORTS: 'modify_sorts',
  MODIFY_GROUPBYS: 'modify_groupbys',
  MODIFY_HIDDEN_COLUMNS: 'modify_hidden_columns',
  MODIFY_SETTINGS: 'modify_settings',

  // column
  MODIFY_COLUMN_ORDER: 'modify_column_order',

  // data status
  SAVING: 'saving',
  SAVED: 'saved',
  ERROR: 'error',

  // search
  START_SEARCH_ROWS: 'start_search_rows',
  CLEAR_SEARCH_ROWS: 'clear_search_rows',
  RE_SEARCH_ROWS: 're_search_rows',

  DISPLAY_SORTS: 'display_sorts',

};
