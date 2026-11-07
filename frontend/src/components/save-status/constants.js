import { gettext } from '@/constants';

export const SAVE_STATUS_TYPE = {
  SAVING: 'saving',
  SAVED: 'saved',
  SAVE_ERROR: 'save_error',
};

export const SAVE_STATUS = {
  [SAVE_STATUS_TYPE.SAVING]: {
    icon: 'loading',
    name: gettext('Saving...'),
    className: '',
  },
  [SAVE_STATUS_TYPE.SAVED]: {
    icon: 'check-mark',
    name: gettext('Saved'),
    className: 'text-success',
  },
  [SAVE_STATUS_TYPE.SAVE_ERROR]: {
    icon: 'exclamation-triangle-filled',
    name: gettext('Error'),
    className: 'text-danger',
  },
};
