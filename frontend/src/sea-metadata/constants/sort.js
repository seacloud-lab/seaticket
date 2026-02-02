import { CellType } from './column';

const SORT_TYPE = {
  UP: 'up',
  DOWN: 'down',
};

const SORT_COLUMN_OPTIONS = [
  CellType.TEXT,
  CellType.CTIME,
  CellType.MTIME,
  CellType.DATE,
  CellType.SINGLE_SELECT,
  CellType.TYPE,
  CellType.MULTIPLE_SELECT,
  CellType.TAGS,
  CellType.COLLABORATOR,
  CellType.CHECKBOX,
  CellType.NUMBER,
  CellType.RATE,
  CellType.TAG,
  CellType.PRIORITY,
];

const SHOW_DISABLED_SORT_COLUMNS = [
  CellType.LONG_TEXT,
  CellType.CREATOR,
  CellType.LAST_MODIFIER,
];

const TEXT_SORTER_COLUMN_TYPES = [CellType.TEXT];
const NUMBER_SORTER_COLUMN_TYPES = [
  CellType.NUMBER,
  CellType.RATE,
  CellType.PRIORITY,
];

export {
  SORT_TYPE,
  SORT_COLUMN_OPTIONS,
  SHOW_DISABLED_SORT_COLUMNS,
  TEXT_SORTER_COLUMN_TYPES,
  NUMBER_SORTER_COLUMN_TYPES,
};
