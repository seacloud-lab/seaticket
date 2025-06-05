import { CellType, FORMULA_RESULT_TYPE } from 'dtable-utils';
import { PAGE_SIZE, LAYOUT_TYPE, IMAGE_TYPES } from '../constants';

export const getFormatProperties = (str) => {
  const validStr = str || '';
  return validStr.replace(/([ ]|,)/g, '_').toLowerCase();
};

const generatorBase64Code = (keyLength = 4) => {
  let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  for (let i = 0; i < keyLength; i++) {
    key += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return key;
};

export const generatorElementId = (elements) => {
  let _id;
  let isUnique = false;
  while (!isUnique) {
    _id = generatorBase64Code();

    // eslint-disable-next-line
    isUnique = !elements.find(id => id === _id);
    if (isUnique) {
      break;
    }
  }
  return _id;
};

export const getPageSize = (settings = {}) => {
  const layout = LAYOUT_TYPE['PORTRAIT'];
  const {
    page_type = 'A4',
    page_orientation = layout,
    page_size = {
      'width': 793,
      'height': 1121
    }
  } = settings;
  const pageOrientation = page_orientation.toLowerCase(); // old version it is uppercase

  switch (page_type) {
    case 'LETTER':
    case 'INDEX_CARD':
    case 'BUSINESS_CARD': {
      const pageSize = PAGE_SIZE[page_type];
      return pageOrientation === layout ? pageSize : {
        width: pageSize.height,
        height: pageSize.width,
      };
    }
    case 'LEGAL': {
      const pageSize = PAGE_SIZE[page_type];
      return pageOrientation === layout ? pageSize : {
        width: pageSize.height - 1,
        height: pageSize.width,
      };
    }
    case 'A4': {
      const pageSize = PAGE_SIZE[page_type];
      return pageOrientation === layout ? {
        width: pageSize.width - 1,
        height: pageSize.height,
      } : {
        width: pageSize.height,
        height: pageSize.width,
      };
    }
    case 'CUSTOM':
    default: {
      return page_size;
    }
  }
};

export const isImageColumn = (column) => {
  const { type, data } = column;
  if (IMAGE_TYPES.includes(type)) return true;
  if (type === CellType.FORMULA || type === CellType.LINK_FORMULA) {
    if (!data) return false;
    const { result_type, array_type } = data;
    if (result_type === FORMULA_RESULT_TYPE.ARRAY && IMAGE_TYPES.includes(array_type)) return true;
  }
  return false;
};
