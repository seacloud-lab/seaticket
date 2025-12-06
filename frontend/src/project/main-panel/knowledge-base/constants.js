import { CellType } from '@/sea-metadata';
import { gettext } from '@/constants';

export const KNOWLEDGE_PREDEFINED_COLUMN_NAME = {
  PK: '_pk',
  QUESTION: 'question',
  ANSWER: 'answer',
  CREATOR: 'creator',
  CREATED_TIME: 'created_time',
  LAST_MODIFIER: 'last_modifier',
  MODIFIED_TIME: 'modified_time',
};

export const KNOWLEDGE_PREDEFINED_COLUMN_CONFIG = {
  [KNOWLEDGE_PREDEFINED_COLUMN_NAME.QUESTION]: {
    display_name: gettext('Question'),
    type: CellType.TEXT,
  },
  [KNOWLEDGE_PREDEFINED_COLUMN_NAME.ANSWER]: {
    display_name: gettext('Answer'),
    type: CellType.LONG_TEXT,
  },
  [KNOWLEDGE_PREDEFINED_COLUMN_NAME.CREATOR]: {
    display_name: gettext('Creator'),
    type: CellType.CREATOR,
  },
  [KNOWLEDGE_PREDEFINED_COLUMN_NAME.CREATED_TIME]: {
    display_name: gettext('Created time'),
    type: CellType.CTIME,
  },
  [KNOWLEDGE_PREDEFINED_COLUMN_NAME.LAST_MODIFIER]: {
    display_name: gettext('Last modifier'),
    type: CellType.LAST_MODIFIER,
  },
  [KNOWLEDGE_PREDEFINED_COLUMN_NAME.MODIFIED_TIME]: {
    display_name: gettext('Last modified time'),
    type: CellType.MTIME,
  },
};

export const KNOWLEDGE_NOT_DISPLAY_COLUMNS = [
  KNOWLEDGE_PREDEFINED_COLUMN_NAME.PK,
];

export const KNOWLEDGE_PAGE_SLUG_ID = {
  ALL: 'all',
  NEW: 'new',
};
