import { gettext } from '@/constants';

export const validateTitle = (name, canIncludeSpecialCharacters = []) => {
  if (typeof name !== 'string') {
    return { isValid: false, message: gettext('Title should be string') };
  }
  name = name.trim();
  if (!canIncludeSpecialCharacters.includes('') && name === '') {
    return { isValid: false, message: gettext('Title is required') };
  }
  if (!canIncludeSpecialCharacters.includes('/') && name.includes('/')) {
    return { isValid: false, message: gettext('Title cannot contain slash') };
  }
  if (!canIncludeSpecialCharacters.includes('\\') && name.includes('\\')) {
    return { isValid: false, message: gettext('Title cannot contain backslash') };
  }
  return { isValid: true, message: name };
};
