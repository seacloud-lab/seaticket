import { CellType } from 'dtable-utils';

export const SUPPORT_COLUMN_TYPE = [
  CellType.DEFAULT,
  CellType.TEXT,
  CellType.NUMBER,
  CellType.CHECKBOX,
  CellType.DATE,
  CellType.SINGLE_SELECT,
  CellType.LONG_TEXT,
  CellType.IMAGE,
  CellType.FILE,
  CellType.MULTIPLE_SELECT,
  CellType.COLLABORATOR,
  CellType.LINK,
  CellType.CREATOR,
  CellType.CTIME,
  CellType.LAST_MODIFIER,
  CellType.MTIME,
  CellType.GEOLOCATION,
  CellType.AUTO_NUMBER,
  CellType.URL,
  CellType.EMAIL,
  CellType.DURATION,
  CellType.FORMULA,
  CellType.LINK_FORMULA,
  CellType.BUTTON,
  CellType.RATE,
  CellType.DIGITAL_SIGN,
];

export const FORMULA_COLUMN_TYPES = [
  CellType.FORMULA,
  CellType.LINK_FORMULA
];

export const STATIC_CELL_TYPE = {
  STATIC_IMAGE: 'static_image',
  STATIC_TEXT: 'static_text'
};

export const DYNAMIC_CELL_TYPE = {
  CURRENT_DATE: 'current_date',
  PAGE_NUMBER: 'page_number',
  TEMPLATE_NAME: 'template_name',
  CURRENT_USER: 'current_user',
};

export const VIEW_TYPE = {
  ALL_RECORDS_TABLE: 'all_records_table',
  VIEW_NAME: 'view_name',
};

export const PAGE_HEADER_FOOTER_TYPE = {
  PAGE_HEADER: 'page_header',
  PAGE_FOOTER: 'page_footer',
};

export const LINK_TABLE = 'link_table';

export const TABLE_TYPES = [
  VIEW_TYPE.ALL_RECORDS_TABLE,
  LINK_TABLE,
];

export const IMAGE_TYPES = [
  CellType.IMAGE,
  CellType.FILE,
  STATIC_CELL_TYPE.STATIC_IMAGE,
  CellType.DIGITAL_SIGN,
];

export const MULTIPLE_IMAGE_TYPES = [
  CellType.IMAGE,
  CellType.FILE
];

export const PAGE_HEADER_FOOTER_TYPES = [
  PAGE_HEADER_FOOTER_TYPE.PAGE_HEADER,
  PAGE_HEADER_FOOTER_TYPE.PAGE_FOOTER,
];

export const PAGE_HEADER_FOOTER_WIDGET_TYPES = [
  STATIC_CELL_TYPE.STATIC_TEXT,
  DYNAMIC_CELL_TYPE.PAGE_NUMBER,
  STATIC_CELL_TYPE.STATIC_IMAGE,
  DYNAMIC_CELL_TYPE.CURRENT_DATE,
  DYNAMIC_CELL_TYPE.CURRENT_USER,
  DYNAMIC_CELL_TYPE.TEMPLATE_NAME,
];
