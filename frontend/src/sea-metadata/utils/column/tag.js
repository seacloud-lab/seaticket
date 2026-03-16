import { getRowById } from '../row';
import { getColumnByName } from './core';

export const getTagNameColumn = (tagsData) => {
  return getColumnByName(tagsData.columns, 'name');
};

export const getTagColorColumn = (tagsData) => {
  return getColumnByName(tagsData.columns, 'color');
};

export const getTagTextColorColumn = (tagsData) => {
  return getColumnByName(tagsData.columns, 'text_color');
};

export const getTagDescriptionColumn = (tagsData) => {
  return getColumnByName(tagsData.columns, 'description');
};

export const convertTagToNameValue = (tagsData, tag) => {
  if (!tag) return null;
  let _tag = { _id: tag._id };
  const nameColumn = getTagNameColumn(tagsData);
  const colorColumn = getTagColorColumn(tagsData);
  const textColorColumn = getTagTextColorColumn(tagsData);
  const descriptionColumn = getTagDescriptionColumn(tagsData);
  if (nameColumn) {
    _tag[nameColumn.name] = tag[nameColumn.key] || tag[nameColumn.name];
  }
  if (colorColumn) {
    _tag[colorColumn.name] = tag[colorColumn.key] || tag[colorColumn.name];
  }
  if (textColorColumn) {
    _tag[textColorColumn.name] = tag[textColorColumn.key] || tag[textColorColumn.name];
  }
  if (descriptionColumn) {
    _tag[descriptionColumn.name] = tag[descriptionColumn.key] || tag[descriptionColumn.name];
  }
  return _tag;
};

export const convertTagToNameValueByTagId = (tagsData, tagID) => {
  const tag = getRowById(tagsData, tagID + '');
  if (!tag) return null;
  return convertTagToNameValue(tagsData, tag);
};

export const getTagsOptions = (tagsData) => {
  if (!tagsData) return [];
  const tags = Array.isArray(tagsData.rows) ? tagsData.rows : [];
  return tags.map(tag => {
    return {
      value: tag._id,
      id: tag._id,
      ...tag,
    };
  });
};

export const getTagsDisplayString = (tagsData, cellValue) => {
  if (!tagsData) return '';
  if (!Array.isArray(cellValue) || cellValue.length === 0) return '';
  return cellValue.map(v => convertTagToNameValueByTagId(tagsData, v)).filter(tag => tag).map(tag => tag.name).join(', ');
};
