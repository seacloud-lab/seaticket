import { gettext } from '@/constants';

const RATE_MAP = {
  '1': {
    name: gettext('No priority'),
    icon: 'priority-00',
  },
  '2': {
    name: gettext('Urgent'),
    icon: 'priority-01',
  },
  '3': {
    name: gettext('High'),
    icon: 'priority-02',
  },
  '4': {
    name: gettext('Medium'),
    icon: 'priority-03',
  },
  '5': {
    name: gettext('Low'),
    icon: 'priority-04',
  },
};

export { RATE_MAP };
