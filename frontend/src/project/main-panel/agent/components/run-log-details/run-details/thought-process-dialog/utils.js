const hasValue = (value) => value !== undefined && value !== null && value !== '';
const JSON_HIGHLIGHT_DETAIL_KEYS = new Set(['input']);

export const formatDetailsJSONValue = (value) => {
  if (!hasValue(value)) return '';
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch (e) {
      return JSON.stringify(value, null, 2);
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch (e) {
    return JSON.stringify(String(value), null, 2);
  }
};

export const shouldHighlightDetailsAsJSON = (fieldKey) => JSON_HIGHLIGHT_DETAIL_KEYS.has(fieldKey);
