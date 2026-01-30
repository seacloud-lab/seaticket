import CellType from '@/sea-metadata/constants/column/type';
import { gettext } from '@/constants';

export const TAGS_PREDEFINED_COLUMN_NAME = {
  PK: '_pk',
  DESCRIPTION: 'description',
};

export const TAGS_PREDEFINED_COLUMN_CONFIG = {
  [TAGS_PREDEFINED_COLUMN_NAME.DESCRIPTION]: {
    display_name: gettext('Description'),
    type: CellType.TEXT,
    editable: true,
    is_required: false,
  },
};
