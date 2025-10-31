import { gettext } from '@/constants';

export const validateTitle = (name) => {
  if (typeof name !== 'string') {
    return { isValid: false, message: gettext('Title should be string') };
  }
  name = name.trim();
  if (name === '') {
    return { isValid: false, message: gettext('Title is required') };
  }
  if (name.includes('/')) {
    return { isValid: false, message: gettext('Title cannot contain slash') };
  }
  if (name.includes('\\')) {
    return { isValid: false, message: gettext('Title cannot contain backslash') };
  }
  return { isValid: true, message: name };
};
