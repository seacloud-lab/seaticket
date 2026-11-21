import { parseEmailAddress } from '../email';

/**
 * Check email format is valid.
 * @param {string} email
 * @returns true/false, bool
 */
const emailPattern = /^[A-Za-z0-9]+([-_.][A-Za-z0-9]+)*@([A-Za-z0-9]+[-.])+[A-Za-z0-9]{2,20}$/;

export const isValidEmail = (email) => {
  return emailPattern.test(parseEmailAddress(email).email);
};
