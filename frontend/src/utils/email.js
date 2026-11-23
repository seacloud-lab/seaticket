import { isObject, isString } from './type-detection';

const emailWithDisplayNamePattern = /^\s*(?:(?:"((?:[^"\\]|\\.)*)"|([^<>]*?))\s*)?<\s*([^<>]+?)\s*>\s*$/;
const emailDomainPattern = /^[^@\s<>]+@([^@\s<>]+)$/;

const SVG_AVATAR_COLORS = [
  '#293857',
  '#3c4497',
  '#0067b9',
  '#1e4c40',
  '#306721',
  '#4f8246',
  '#a82e26',
  '#e58231',
  '#321b5a',
  '#561e4b',
  '#7c1e4e',
  '#cd463c',
  '#617988',
  '#d63864',
  '#318074',
];

/**
 * Preserve the local part and normalize the domain's casing.
 * @param {string} value
 * @returns {string}
 */
export const normalizeEmailAddress = (value = '') => {
  const email = String(value ?? '').trim();
  const atIndex = email.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === email.length - 1) return email;
  return `${email.slice(0, atIndex)}@${email.slice(atIndex + 1).toLowerCase()}`;
};

/**
 * Parse the domain from one email address.
 * @param {string} value
 * @returns {string}
 */
export const parseEmailDomain = (value = '') => {
  const { email } = parseEmailAddress(value);
  const match = email.trim().toLowerCase().match(emailDomainPattern);
  return match ? match[1] : '';
};

const getEmailPrefix = (email) => {
  const atIndex = email.indexOf('@');
  if (atIndex <= 0 || atIndex !== email.lastIndexOf('@')) return '';

  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  if (!localPart || !domain || /[\s<>]/.test(localPart) || /[\s<>]/.test(domain)) return '';
  return localPart;
};

/**
 * Parse an email address with an optional display name.
 * @param {string} value
 * @returns {{ name: string, email: string, fullName: string }}
 */
export const parseEmailAddress = (value = '') => {
  const addressText = String(value ?? '').trim();
  if (!addressText) return { name: '', email: '', fullName: '', isCustomizedName: false };
  const match = emailWithDisplayNamePattern.exec(addressText);
  if (!match) {
    return {
      name: getEmailPrefix(addressText),
      email: addressText,
      fullName: addressText,
      isCustomizedName: false,
    };
  }

  const email = match[3].trim();
  const name = (match[1] ? match[1].replace(/\\(.)/g, '$1') : match[2] || '').trim() || '';
  const isCustomizedName = Boolean(name);

  return {
    name: name || getEmailPrefix(email),
    email,
    fullName: isCustomizedName ? `${name} <${email}>` : email,
    isCustomizedName,
  };
};

/**
 * Split a comma-separated email address list without splitting quoted names.
 * Empty entries are ignored so blank recipient fields produce an empty list.
 * @param {string} value
 * @returns {string[]}
 */
export const splitEmailAddresses = (value) => {
  const addressText = String(value ?? '');
  let addresses = [];
  let start = 0;
  let isQuoted = false;
  let isEscaped = false;
  let angleBracketDepth = 0;

  for (let index = 0; index < addressText.length; index++) {
    const character = addressText[index];
    if (isEscaped) {
      isEscaped = false;
      continue;
    }
    if (character === '\\' && isQuoted) {
      isEscaped = true;
      continue;
    }
    if (character === '"') {
      isQuoted = !isQuoted;
      continue;
    }
    if (!isQuoted && character === '<') {
      angleBracketDepth++;
      continue;
    }
    if (!isQuoted && character === '>') {
      angleBracketDepth = Math.max(0, angleBracketDepth - 1);
      continue;
    }
    if (!isQuoted && angleBracketDepth === 0 && character === ',') {
      const address = addressText.slice(start, index).trim();
      if (address) addresses.push(address);
      start = index + 1;
    }
  }

  const lastAddress = addressText.slice(start).trim();
  if (lastAddress) addresses.push(lastAddress);
  return addresses;
};

const generateInitials = (name) => {
  if (!name || !isString(name)) return '?';
  const trimmedName = name.trim();
  if (!trimmedName) return '?';

  const words = trimmedName.split(/[\s]+/).filter(word => word.length > 0);
  if (words.length === 0) return '?';
  if (/[\u4e00-\u9fa5]/.test(trimmedName)) return Array.from(trimmedName)[0];
  if (words.length > 1) {
    return (words[0].charAt(0) + words[words.length - 1].charAt(0));
  }

  const word = words[0];
  return Array.from(word).slice(0, 1).join('');
};

export const parseEmailUserInfo = (userOrEmail) => {
  const defaultUser = { displayName: '', name: '', email: '', color: '', fullName: '', isCustomizedName: false };
  if (!userOrEmail) return defaultUser;
  if (!isObject(userOrEmail) && !isString(userOrEmail)) return defaultUser;
  let user = userOrEmail;
  if (isString(userOrEmail)) {
    user = parseEmailAddress(userOrEmail);
  }
  const { name, email, fullName, isCustomizedName = true } = user;
  const initials = generateInitials(name);
  let hash = 0;
  const emailAddress = isString(email) ? normalizeEmailAddress(email) : '';
  for (let i = 0; i < emailAddress.length; i++) {
    hash = emailAddress.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const colorIndex = Math.abs(hash) % SVG_AVATAR_COLORS.length;
  const color = SVG_AVATAR_COLORS[colorIndex];

  return { initials, name, email, color, fullName, isCustomizedName };
};
