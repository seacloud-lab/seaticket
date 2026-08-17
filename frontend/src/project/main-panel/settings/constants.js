import { gettext } from '@/constants';

export const SETTINGS_TAB_TYPE = {
  GENERAL: 'general',
  AGENT: 'agent',
};

export const SETTINGS_TABS = [
  {
    value: SETTINGS_TAB_TYPE.GENERAL,
    label: gettext('General'),
  }, {
    value: SETTINGS_TAB_TYPE.AGENT,
    label: gettext('Agent'),
  },
];
