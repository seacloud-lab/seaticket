import { gettext } from '@/constants';

export const STATISTIC_TYPE = {
  CARD: 'card',
  LINE: 'line',
};

export const STATISTIC_SUMMARY_TYPE = {
  COUNT: 'count',
};

export const STATISTIC_SUMMARY_TYPE_DISPLAY = {
  [STATISTIC_SUMMARY_TYPE.COUNT]: gettext('Count')
};
