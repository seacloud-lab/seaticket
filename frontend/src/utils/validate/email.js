import { parseEmailAddress } from '../email';

const emailPattern = /^[A-Za-z0-9]+([-_.][A-Za-z0-9]+)*@([A-Za-z0-9]+[-.])+[A-Za-z0-9]{2,20}$/;

/**
 * Check email format is valid.
 * @param {string} email
 * @returns true/false, bool
 */
export const isValidEmail = (email) => {
  return emailPattern.test(parseEmailAddress(email).email);
};
