import { gettext } from '@/constants';

export const STATUS_OPTIONS = [
  { id: '1', name: gettext('Active'), color: '#59CB74', text_color: '#fff' },
  { id: '0', name: gettext('Inactive'), color: '#c2c2c2', text_color: '#fff' },
];

export const USER_DISABLED_OPTIONS = [
  { id: '1', name: gettext('Disabled'), color: '#c2c2c2', text_color: '#fff' },
  { id: '0', name: gettext('Enabled'), color: '#59CB74', text_color: '#fff' },
];
