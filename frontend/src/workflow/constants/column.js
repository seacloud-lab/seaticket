import { CellType } from 'dtable-utils';

export const WORKFLOW_SUPPORT_EDIT_TYPE_MAP = {
  [CellType.TEXT]: true,
  [CellType.NUMBER]: true,
  [CellType.CHECKBOX]: true,
  [CellType.DATE]: true,
  [CellType.SINGLE_SELECT]: true,
  [CellType.LONG_TEXT]: true,
  [CellType.IMAGE]: true,
  [CellType.FILE]: true,
  [CellType.MULTIPLE_SELECT]: true,
  [CellType.GEOLOCATION]: true,
  [CellType.EMAIL]: true,
  [CellType.URL]: true,
  [CellType.DURATION]: true,
  [CellType.RATE]: true,
  [CellType.LINK]: true,
  [CellType.COLLABORATOR]: true,
  [CellType.DIGITAL_SIGN]: true,
};

export const WORKFLOW_SUPPORT_VISIBLE_TYPE_MAP = {
  [CellType.TEXT]: true,
  [CellType.NUMBER]: true,
  [CellType.CHECKBOX]: true,
  [CellType.DATE]: true,
  [CellType.SINGLE_SELECT]: true,
  [CellType.LONG_TEXT]: true,
  [CellType.IMAGE]: true,
  [CellType.FILE]: true,
  [CellType.MULTIPLE_SELECT]: true,
  [CellType.GEOLOCATION]: true,
  [CellType.EMAIL]: true,
  [CellType.URL]: true,
  [CellType.DURATION]: true,
  [CellType.RATE]: true,
  [CellType.LINK]: true,
  [CellType.COLLABORATOR]: true,
  [CellType.DIGITAL_SIGN]: true,
  [CellType.FORMULA]: true,
  [CellType.AUTO_NUMBER]: true,
};

export const COLUMN_CONFIG_KEY = {
  DESCRIPTION: 'description',
  IS_REQUIRED: 'is_required',

  ENABLE_ADD_NEW_RECORDS: 'enable_add_new_records',
  ENABLE_LINK_EXISTING_RECORDS: 'enable_link_existing_records',

  LINK_VISIBLE_COLUMN_FIELDS: 'link_visible_column_fields',
  LINK_REQUIRED_COLUMN_FIELDS: 'link_required_column_fields',
  LINK_EXISTED_VISIBLE_COLUMN_FIELDS: 'link_existed_visible_column_fields',

  LINK_FILTER_CONJUNCTION: 'link_filter_conjunction',
  LINK_FILTERS: 'link_filters',

  SHOW_ON_CONDITION: 'show_on_condition',
  FILTERS: 'filters',
  FILTER_CONJUNCTION: 'filter_conjunction',

  OPTIONS_SHOW_TYPE: 'options_show_type',

  CUSTOM_NAME: 'custom_name',

  ENABLE_FILL_DEFAULT_VALUE: 'enable_fill_default_value',
  DEFAULT_VALUE: 'default_value',
  ENABLE_NOT_CHANGE_DEFAULT_VALUE: 'enable_not_change_default_value',

  LINK_AT_MOST_ONE_RECORD: 'link_at_most_one_record',
  ENABLE_CUSTOMIZE_EXISTING_LINK_BTN_NAME: 'enable_customize_existing_link_btn_name',
  ENABLE_CUSTOMIZE_NEW_LINK_BTN_NAME: 'enable_customize_new_link_btn_name',
  EXISTING_LINK_BTN_NAME: 'existing_link_btn_name',
  NEW_LINK_BTN_NAME: 'new_link_btn_name',

  // ENABLE_SCAN_CODE_ENTRY: 'enable_scan_code_entry',
  // PERMISSION: 'permission'
};

export const COLUMN_OPTIONS_SHOW_TYPE = {
  DROPDOWN: 'dropdown',
  LIST: 'list'
};
