const AVATAR_COLORS = [
  '#293857', '#3c4497', '#0067b9', '#1e4c40', '#306721',
  '#4f8246', '#a82e26', '#e58231', '#321b5a', '#561e4b',
  '#7c1e4e', '#cd463c', '#617988', '#d63864', '#318074',
];

// Match Fastmail's email color mapping using Overture's SuperFastHash.
const hashEmail = (email) => {
  let hash = email.length;
  const pairedLength = email.length - (email.length & 1);

  for (let index = 0; index < pairedLength; index += 2) {
    hash += email.charCodeAt(index);
    hash = (hash << 16) ^ ((email.charCodeAt(index + 1) << 11) ^ hash);
    hash += hash >> 11;
  }
  if (email.length & 1) {
    hash += email.charCodeAt(pairedLength);
    hash ^= hash << 11;
    hash += hash >> 17;
  }
  hash ^= hash << 3;
  hash += hash >> 5;
  hash ^= hash << 4;
  hash += hash >> 17;
  hash ^= hash << 25;
  hash += hash >> 6;
  return hash;
};

const firstCharacter = (value) => Array.from(value.normalize('NFC'))[0] || '';

const getInitials = (name) => {
  if (/^[^\s<>]+@[^\s<>]+$/.test(name)) return firstCharacter(name.split('@')[0]);

  const words = name
    .replace(/\s+\(?\s*via\s+.*$/, '')
    .replace(/\s+\(.*\)/g, '')
    .replace(/(?:,.*|\s+[js]r\.?)$/i, '')
    .replace(/"/g, '')
    .trim()
    .split(/\s+/);

  while (words.length > 1 && /^(?:the|mr\.?|mrs\.?|ms\.?)$/i.test(words[0])) {
    words.shift();
  }
  const first = firstCharacter(words[0]);
  return words.length > 1 ? first + firstCharacter(words[words.length - 1]) : first;
};

export const getEmailAvatar = ({ username, email }) => {
  const mailboxName = email.split('@')[0];
  const initials = getInitials(username || mailboxName) || firstCharacter(mailboxName) || '?';
  const identity = (email || username).toLowerCase();
  const colorIndex = ((hashEmail(identity) % AVATAR_COLORS.length) + AVATAR_COLORS.length) % AVATAR_COLORS.length;

  return {
    initials,
    color: identity ? AVATAR_COLORS[colorIndex] : AVATAR_COLORS[12],
  };
};
