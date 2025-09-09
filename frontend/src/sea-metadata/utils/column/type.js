import { getRowById } from '../row';

export const getTypesOptions = (typesData) => {
  if (!typesData) return [];
  const options = Array.isArray(typesData.rows) ? typesData.rows : [];
  return options.map(o => {
    return {
      value: o._id,
      id: o._id,
      name: o.name,
      color: o.color,
      textColor: o.text_color,
    };
  });
};

export const getTypeDisplayString = (typesData, cellValue = '') => {
  if (!typesData) return '';
  if (!cellValue) return '';
  const type = getRowById(typesData, cellValue);
  return type?.name || '';
};
