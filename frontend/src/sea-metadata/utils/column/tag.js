import { getRowById } from '../row';

export const getTagsDisplayString = (tagsData, cellValue) => {
  if (!tagsData) return '';
  if (!Array.isArray(cellValue) || cellValue.length === 0) return '';
  return cellValue.map(v => getRowById(tagsData, v)).filter(tag => tag).map(tag => tag.name).join(', ');
};
