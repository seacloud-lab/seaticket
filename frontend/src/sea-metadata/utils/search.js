const escapeRegExp = (value) => {
  if (typeof value !== 'string') return '';
  return value.replace(/[.\\[\]{}()|^$?*+]/g, '\\$&');
};

export const getSearchRule = (value) => {
  if (!value || typeof value !== 'string') {
    return false;
  }
  const searchContents = value.split(/ +/g);
  return searchContents.map((content) => {
    const reg = new RegExp(escapeRegExp(content), 'i');
    return { reg, content, isMatched: false };
  });
};

export const checkHasSearchResult = (searchResult) => {
  const { matchedCells } = searchResult || {};
  return Array.isArray(matchedCells) ? matchedCells.length > 0 : false;
};
