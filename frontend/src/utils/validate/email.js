/**
 * Check email format is valid.
 * @param {string} email
 * @returns true/false, bool
 */
const emailPattern = /^[A-Za-z0-9]+([-_.][A-Za-z0-9]+)*@([A-Za-z0-9]+[-.])+[A-Za-z0-9]{2,20}$/;
const emailWithDisplayNamePattern = /^\s*(?:(?:"((?:[^"\\]|\\.)*)"|([^<>]*?))\s*)?<\s*([^<>]+?)\s*>\s*$/;

/**
 * Parse an email address with an optional display name.
 * @param {string} value
 * @returns {{ username: string, email: string }}
 */
const parseEmailAddress = (value = '') => {
  const addressText = String(value ?? '').trim();
  if (!addressText) return { username: '', email: '' };
  const match = emailWithDisplayNamePattern.exec(addressText);
  if (!match) return { username: '', email: addressText };

  return {
    username: (match[1] ? match[1].replace(/\\(.)/g, '$1') : match[2] || '').trim(),
    email: match[3].trim(),
  };
};

/**
 * Split a comma-separated email address list without splitting quoted names.
 * Empty entries are ignored so blank recipient fields produce an empty list.
 * @param {string} value
 * @returns {string[]}
 */
const splitEmailAddresses = (value) => {
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

const isValidEmail = (email) => {
  return emailPattern.test(parseEmailAddress(email).email);
};

export { isValidEmail, parseEmailAddress, splitEmailAddresses };
