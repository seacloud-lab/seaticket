import { gettext } from '@/constants';
import CellType from './type';

const COLUMNS_ICON_CONFIG = {
  [CellType.CREATOR]: 'creator',
  [CellType.LAST_MODIFIER]: 'creator',
  [CellType.CTIME]: 'ctime',
  [CellType.MTIME]: 'ctime',
  [CellType.DEFAULT]: 'text',
  [CellType.TEXT]: 'text',
  [CellType.CHECKBOX]: 'checkbox',
  [CellType.COLLABORATOR]: 'collaborator',
  [CellType.DATE]: 'date',
  [CellType.LONG_TEXT]: 'long-text',
  [CellType.SINGLE_SELECT]: 'single-select',
  [CellType.TYPE]: 'single-select',
  [CellType.MULTIPLE_SELECT]: 'multiple-select',
  [CellType.NUMBER]: 'number',
  [CellType.RATE]: 'rate',
  [CellType.TAGS]: 'tag',
  [CellType.TAG]: 'tag',
  [CellType.URL]: 'url',
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
};

export {
  COLUMNS_ICON_CONFIG,
  COLUMNS_ICON_NAME,
};
