import { isValidEmailAddress, parseEmailAddress } from '../email';

/**
 * Check email format is valid.
 * @param {string} email
 * @returns true/false, bool
 */
export const isValidEmail = (email) => {
  return isValidEmailAddress(parseEmailAddress(email).email);
};
