import { CellType, DATE_DEFAULT_TYPES } from 'dtable-utils';
import { gettext } from '../utils/constants';

export const FORM_SUPPORT_EDIT_TYPE = [
  CellType.TEXT,
  CellType.NUMBER,
  CellType.CHECKBOX,
  CellType.DATE,
  CellType.SINGLE_SELECT,
  CellType.LONG_TEXT,
  CellType.IMAGE,
  CellType.FILE,
  CellType.MULTIPLE_SELECT,
  CellType.GEOLOCATION,
  CellType.EMAIL,
  CellType.URL,
  CellType.DURATION,
  CellType.RATE,
  CellType.LINK,
  CellType.DIGITAL_SIGN,
];

export const FORM_SUPPORT_PRESET_TYPE = [
  CellType.TEXT,
  CellType.NUMBER,
  CellType.CHECKBOX,
  CellType.DATE,
  CellType.SINGLE_SELECT,
  CellType.MULTIPLE_SELECT,
  CellType.EMAIL,
  CellType.URL,
  CellType.DURATION,
  CellType.RATE,
];

export const COLLECTION_TABLE_SUPPORT_EDIT_TYPE = [
  CellType.TEXT,
  CellType.NUMBER,
  CellType.CHECKBOX,
  CellType.DATE,
  CellType.SINGLE_SELECT,
  CellType.LONG_TEXT,
  CellType.IMAGE,
  CellType.FILE,
  CellType.MULTIPLE_SELECT,
  CellType.GEOLOCATION,
  CellType.EMAIL,
  CellType.URL,
  CellType.DURATION,
  CellType.RATE,
  CellType.CREATOR,
  CellType.CTIME,
  CellType.LAST_MODIFIER,
  CellType.MTIME,
  CellType.FORMULA,
  CellType.LINK,
  CellType.LINK_FORMULA
];

export const LINKED_TABLE_SUPPORT_EDIT_TYPE_MAP = {
  [CellType.TEXT]: true,
  [CellType.DATE]: true,
  [CellType.NUMBER]: true,
  [CellType.SINGLE_SELECT]: true,
  [CellType.MULTIPLE_SELECT]: true,
  [CellType.COLLABORATOR]: true,
  [CellType.LONG_TEXT]: true,
  [CellType.IMAGE]: true,
  [CellType.FILE]: true,
  [CellType.GEOLOCATION]: true,
  [CellType.CHECKBOX]: true,
  [CellType.EMAIL]: true,
  [CellType.URL]: true,
  [CellType.DURATION]: true,
  [CellType.RATE]: true,
  [CellType.DIGITAL_SIGN]: true,
};

export const FORM_ELEMENTS_TYPE = {
  SPLIT_LINE: 'split_line',
  REMARKS: 'remarks',
  COLUMN: 'column'
};

export const DATE_COLUMN_DEFAULT_OPTIONS = [
  { name: gettext('Specific date'), type: DATE_DEFAULT_TYPES.SPECIFIC_DATE },
  { name: gettext('Current date'), type: DATE_DEFAULT_TYPES.CURRENT_DATE },
  // {name: gettext('x_days_before_current_date'), type: DATE_DEFAULT_TYPES.DAYS_BEFORE},
  // {name: gettext('x_days_after_current_date'), type: DATE_DEFAULT_TYPES.DAYS_AFTER},
];

export const OPTIONS_SHOW_TYPE = {
  DROPDOWN: 'dropdown',
  LIST: 'list'
};

export const FORM_CONFIG_STATE = {
  REMARK_CONTENT: 'remarkContent',
  IS_REMARK_CONTENT_SHOW: 'isRemarkContentShow',
  TOP_REMARK_CONTENT: 'topRemarkContent',
  IS_TOP_REMARK_CONTENT_SHOW: 'isTopRemarkContentShow',
  SUCCESS_MESSAGE: 'successMessage',
  IS_SUCCESS_MESSAGE_SHOW: 'isSuccessMessageShow',
  SUCCESS_REDIRECT: 'successRedirect',
  IS_SUCCESS_REDIRECT_SHOW: 'isSuccessRedirectShow',
  SUBMIT_DEADLINE: 'submitDeadline',
  IS_SUBMIT_DEADLINE_SHOW: 'isSubmitDeadlineShow',
  IS_HIDE_POWERED_BY: 'isHidePoweredBy',
  IS_TRIGGER_WORKFLOW: 'isTriggerWorkflow',
};

export const SEATABLE_FORM = 'seaTableForm';

export const SAVE_COMMIT_HISTORY_TYPES = [
  CellType.TEXT,
  CellType.URL,
  CellType.EMAIL,
  CellType.DURATION,
  CellType.NUMBER,
];

export const FORM_SETTINGS_TYPE = {
  BASE: 'base',
  THEME: 'theme',
};

export const FORM_THEME_TYPE = {
  COLOR: 'color',
  IMAGE: 'image',
};

export const FORM_THEME_COLORS = [
  'ED7109',
  'FFB600',
  'E91E63',
  'EB00B1',
  '7626FD',
  '972CB0',
  '1DDD1D',
  '4CAF50',
  '02C0FF',
  '00C9C7',
  '1688FC',
  '656463'
];

export const FORM_THEME_BACKGROUND_COLOR = {
  'ED7109': '#F5F5F5',
  'FFB600': '#F5F5F5',
  'E91E63': '#F5F5F5',
  'EB00B1': '#F5F5F5',
  '7626FD': '#F5F5F5',
  '972CB0': '#F5F5F5',
  '1DDD1D': '#F5F5F5',
  '4CAF50': '#F5F5F5',
  '02C0FF': '#F5F5F5',
  '00C9C7': '#F5F5F5',
  '1688FC': '#F5F5F5',
  '656463': '#F5F5F5',
};

export const DEFAULT_FORM_BACKGROUND_COLOR = '#F5F5F5';

export const FORM_THEME_BACKGROUND_IMAGES = [
  'img/form-background-image/form-background-image-1.jpg',
  'img/form-background-image/form-background-image-2.jpg',
  'img/form-background-image/form-background-image-3.jpg',
  'img/form-background-image/form-background-image-4.jpg',
  'img/form-background-image/form-background-image-5.jpg',
  'img/form-background-image/form-background-image-6.jpg',
  'img/form-background-image/form-background-image-7.jpg',
  'img/form-background-image/form-background-image-8.jpg',
];

export const FORM_REMARK_DEFAULT_TEXT_COLOR = '#666666';

export const FORM_REMARK_DEFAULT_BACKGROUND_COLOR = '#f9f9f9';

export const TRANSPARENT_COLOR = 'transparent';

export const BACKGROUND_TYPE = {
  TRANSPARENT: 'transparent',
  FILLED: 'filled',
};

export const BACKGROUND_TYPES = [
  BACKGROUND_TYPE.TRANSPARENT,
  BACKGROUND_TYPE.FILLED,
];

export const INPUT_MODE_MAP = {
  ANY_LOCATION: 'any_location',
  ONLY_MOBILE_POSITIONING: 'only_mobile_positioning'
};
