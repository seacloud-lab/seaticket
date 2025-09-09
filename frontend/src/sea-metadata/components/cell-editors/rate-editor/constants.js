import { gettext } from '@/constants';

const RATE_MAP = {
  '0': {
    name: gettext('No priority'),
    hotKey: '0',
    // No priority, no icon
  },
  '4': {
    name: gettext('Urgent'),
    icon: 'priority-01',
    hotKey: '1',
  },
  '3': {
    name: gettext('High'),
    icon: 'priority-02',
    hotKey: '2',
  },
  '2': {
    name: gettext('Medium'),
    icon: 'priority-03',
    hotKey: '3',
  },
  '1': {
    name: gettext('Low'),
    icon: 'priority-04',
    hotKey: '4',
  },
};

const RATE_LIST = [
  {
    name: gettext('No priority'),
    hotKey: '0',
    value: 0,
    // No priority, no icon
  },
  {
    name: gettext('Urgent'),
    icon: 'priority-01',
    hotKey: '1',
    value: 4,
  },
  {
    name: gettext('High'),
    icon: 'priority-02',
    hotKey: '2',
    value: 3,
  },
  {
    name: gettext('Medium'),
    icon: 'priority-03',
    hotKey: '3',
    value: 2,
  },
  {
    name: gettext('Low'),
    icon: 'priority-04',
    hotKey: '4',
    value: 1,
  },
];

export { RATE_MAP, RATE_LIST };
