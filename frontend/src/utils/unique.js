/**
 * Generate a random string of specified length.
 * @param {number} keyLength
 * @returns random code, string
 */
export const generatorBase64Code = (length = 4) => {
  let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  for (let i = 0; i < length; i++) {
    key += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return key;
};

export const generatorUniqueValue = (existingData = [], key = 'key', length) => {
  let value = '';
  let isUnique = false;
  while (!isUnique) {
    value = generatorBase64Code(length);

    // eslint-disable-next-line
    isUnique = existingData.every(d => d[key] !== value);
    if (isUnique) {
      break;
    }
  }
  return value;
};
