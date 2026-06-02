import CellType from '@/sea-metadata/constants/column/type';
import { gettext } from '@/constants';

export const KNOWLEDGE_PREDEFINED_COLUMN_NAME = {
  PK: '_pk',
  TITLE: 'title',
  CONTENT: 'content',
  TAGS: 'tags',
  AI_SUMMARY: 'ai_summary',
  AI_PROCESSED_TIME: 'ai_processed_time',
  CREATOR: 'creator',
  CREATED_TIME: 'created_time',
  LAST_MODIFIER: 'last_modifier',
  MODIFIED_TIME: 'modified_time',
};

export const KNOWLEDGE_PREDEFINED_COLUMN_CONFIG = {
  [KNOWLEDGE_PREDEFINED_COLUMN_NAME.TITLE]: {
    display_name: gettext('Title'),
    type: CellType.TEXT,
  },
  [KNOWLEDGE_PREDEFINED_COLUMN_NAME.TAGS]: {
    type: CellType.TAGS,
    display_name: gettext('Tags'),
    editable: true,
    modify_data_able: true,
  },
  [KNOWLEDGE_PREDEFINED_COLUMN_NAME.AI_SUMMARY]: {
    display_name: gettext('AI summary'),
    type: CellType.TEXT,
    // is_hover_show_content: true,
  },
  [KNOWLEDGE_PREDEFINED_COLUMN_NAME.AI_PROCESSED_TIME]: {
    display_name: gettext('AI processed time'),
    type: CellType.DATE,
    data: { format: 'YYYY-MM-DD HH:mm:ss' },
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
  TRASH: 'trash',
};

export const KNOWLEDGE_CHILDREN_PAGE_SLUG_ID = {
  ALL: 'all',
};

export const KNOWLEDGE_BASE_TYPE = 'knowledge_base';

export const KB_TABLE_NAME = 'kb';
