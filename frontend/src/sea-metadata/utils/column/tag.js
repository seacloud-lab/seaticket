import { getRowById } from '../row';

export const getTagsOptions = (tagsData) => {
  if (!tagsData) return [];
  const options = Array.isArray(tagsData.rows) ? tagsData.rows : [];
  return options.map(o => {
    return {
      value: o._id,
      id: o._id,
      name: o.name,
      color: o.color,
      text_color: o.text_color,
    };
  });
};

export const getTagsDisplayString = (tagsData, cellValue) => {
  if (!tagsData) return '';
  if (!Array.isArray(cellValue) || cellValue.length === 0) return '';
  return cellValue.map(v => getRowById(tagsData, v)).filter(tag => tag).map(tag => tag.name).join(', ');
};
