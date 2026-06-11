import { gettext } from '@/constants';

export const DATE_FORMAT = 'YYYY-MM-DD';

export const presetLabelMapping = {
  'all': gettext('All'),
  '7D': gettext('7 days'),
  '30D': gettext('30 days'),
  '90D': gettext('90 days'),
  '180D': gettext('180 days'),
  'YTD': gettext('1 year'),
};
