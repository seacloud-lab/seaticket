import { gettext } from '@/constants';

export const validateName = (name) => {
  if (typeof name !== 'string') {
    return { isValid: false, message: gettext('Name should be string') };
  }
  name = name.trim();
  if (name === '') {
    return { isValid: false, message: gettext('Name is required') };
  }
  if (name.includes('/')) {
    return { isValid: false, message: gettext('Name cannot contain slash') };
  }
  if (name.includes('\\')) {
    return { isValid: false, message: gettext('Name cannot contain backslash') };
  }
  return { isValid: true, message: name };
};
