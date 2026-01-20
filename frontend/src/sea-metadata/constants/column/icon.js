import { gettext } from '@/constants';
import CellType from './type';

const COLUMNS_ICON_CONFIG = {
  [CellType.CREATOR]: 'user',
  [CellType.LAST_MODIFIER]: 'user',
  [CellType.CTIME]: 'date-time',
  [CellType.MTIME]: 'date-time',
  [CellType.DEFAULT]: 'text',
  [CellType.TEXT]: 'text',
  [CellType.CHECKBOX]: 'check-box',
  [CellType.COLLABORATOR]: 'group',
  [CellType.DATE]: 'date',
  [CellType.LONG_TEXT]: 'long-text',
  [CellType.SINGLE_SELECT]: 'single-select',
  [CellType.TYPE]: 'single-select',
  [CellType.MULTIPLE_SELECT]: 'multiple-select',
  [CellType.NUMBER]: 'number',
  [CellType.RATE]: 'rate',
  [CellType.TAGS]: 'tag-filled',
  [CellType.TAG]: 'tag-filled',
  [CellType.URL]: 'url',
  [CellType.PRIORITY]: 'flag',
  [CellType.LINK]: 'link',
};

const COLUMNS_ICON_NAME = {
  [CellType.CREATOR]: gettext('Creator'),
  [CellType.LAST_MODIFIER]: gettext('Last modifier'),
  [CellType.CTIME]: gettext('CTime'),
  [CellType.MTIME]: gettext('Last modified time'),
  [CellType.DEFAULT]: gettext('Text'),
  [CellType.TEXT]: gettext('Text'),
  [CellType.CHECKBOX]: gettext('Checkbox'),
  [CellType.COLLABORATOR]: gettext('Collaborator'),
  [CellType.DATE]: gettext('Date'),
  [CellType.LONG_TEXT]: gettext('Long text'),
  [CellType.SINGLE_SELECT]: gettext('Single select'),
  [CellType.TYPE]: gettext('Single select'),
  [CellType.MULTIPLE_SELECT]: gettext('Multiple select'),
  [CellType.NUMBER]: gettext('Number'),
  [CellType.RATE]: gettext('Rate'),
  [CellType.TAGS]: gettext('Tags'),
  [CellType.TAG]: gettext('Tag'),
  [CellType.URL]: gettext('URL'),
  [CellType.PRIORITY]: gettext('Priority'),
  [CellType.LINK]: gettext('Link'),
};

export {
  COLUMNS_ICON_CONFIG,
  COLUMNS_ICON_NAME,
};
