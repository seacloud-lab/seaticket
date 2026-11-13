const BARE_ADDRESS_PATTERN = /[^\s,;<>]+@[^\s,;<>]+/;
const ANGLE_ADDRESS_PATTERN = /<([^<>]+)>\s*$/;

// Split on commas that are not inside quoted display names (e.g. "Comma, Recipient" <a@b>).
const splitAddressTokens = (addressText) => {
  const text = String(addressText || '');
  const tokens = [];
  let current = '';
  let inQuotes = false;
  let escaped = false;

  for (const char of text) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\' && inQuotes) {
      current += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
      continue;
    }
    if (char === ',' && !inQuotes) {
      tokens.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  tokens.push(current);
  return tokens.map(token => token.trim()).filter(Boolean);
};

export const getEmailAddress = (address) => {
  const text = String(address || '').trim();
  const angleMatch = text.match(ANGLE_ADDRESS_PATTERN);
  if (angleMatch) return angleMatch[1].trim().toLowerCase();

  const bareMatch = text.match(BARE_ADDRESS_PATTERN);
  return bareMatch ? bareMatch[0].toLowerCase() : '';
};

export const extractEmailAddresses = (addressText) => {
  if (!addressText) return [];

  const result = [];
  const seen = new Set();
  splitAddressTokens(addressText).forEach((token) => {
    const email = getEmailAddress(token);
    if (!email || seen.has(email)) return;
    seen.add(email);

    if (ANGLE_ADDRESS_PATTERN.test(token)) {
      result.push(token);
      return;
    }
    const bareMatch = token.match(BARE_ADDRESS_PATTERN);
    const name = bareMatch ? token.replace(bareMatch[0], '').trim() : token;
    result.push(name ? `${name} <${bareMatch[0]}>` : bareMatch[0]);
  });
  return result;
};
