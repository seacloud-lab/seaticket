import { CellType, INPUT_LENGTH_LIMIT } from '../../constants';

export const isLongTextValueExceedLimit = (value) => {
  const limit = INPUT_LENGTH_LIMIT[CellType.LONG_TEXT];
  const { text } = value;
  return text ? text.length >= limit : false;
};

export const getValidLongTextValue = (value) => {
  const limit = INPUT_LENGTH_LIMIT[CellType.LONG_TEXT];
  const newValue = { ...value };
  const { text, preview } = newValue;
  newValue.text = text ? text.slice(0, limit) : '';
  newValue.preview = preview ? preview.slice(0, limit) : '';
  return newValue;
};

/**
 * Get text from long-text to display.
 * @param {object} longText e.g. { text, ... }
 * @returns text from long-text, string
 */
export const getLongtextDisplayString = (longText) => {
  if (!longText) return '';
  const longTextType = typeof longText;
  if (longTextType === 'string') return longText;
  if (longTextType === 'object') return longText.text || '';
  return '';
};
