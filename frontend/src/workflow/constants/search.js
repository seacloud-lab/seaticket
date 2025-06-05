import { CellType } from 'dtable-utils';

// button | file | image | rate | checkbox is not support
const SUPPORT_SEARCH_COLUMN_LIST = [
  CellType.DATE,
  CellType.TEXT,
  CellType.LONG_TEXT,
  CellType.NUMBER,
  CellType.URL,
  CellType.EMAIL,
  CellType.SINGLE_SELECT,
  CellType.CTIME,
  CellType.MTIME,
  CellType.MULTIPLE_SELECT,
  CellType.LAST_MODIFIER,
  CellType.CREATOR,
  CellType.COLLABORATOR,
  CellType.LINK,
  CellType.FORMULA,
  CellType.LINK_FORMULA,
  CellType.AUTO_NUMBER,
  CellType.GEOLOCATION,
  CellType.DURATION,
];

const SUPPORT_SEARCH_FORMULA_ARRAY_TYPES = [
  CellType.STRING,
  ...SUPPORT_SEARCH_COLUMN_LIST,
];

export {
  SUPPORT_SEARCH_COLUMN_LIST,
  SUPPORT_SEARCH_FORMULA_ARRAY_TYPES,
};
