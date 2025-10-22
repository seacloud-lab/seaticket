const ROW_HEIGHT_TYPE = {
  DEFAULT: 'default',
  DOUBLE: 'double',
  TRIPLE: 'triple',
  QUADRUPLE: 'quadruple',
};

const ROW_HEIGHT_DEFAULT = 32;

const ROW_HEIGHT_MAP = {
  [ROW_HEIGHT_TYPE.DEFAULT]: ROW_HEIGHT_DEFAULT,
  [ROW_HEIGHT_TYPE.DOUBLE]: 56,
  [ROW_HEIGHT_TYPE.TRIPLE]: 88,
  [ROW_HEIGHT_TYPE.QUADRUPLE]: 128
};

const ROW_HEIGHT_CLASS_MAP = {
  32: 'sea-metadata-table-row-height-32-cell',
  56: 'sea-metadata-table-row-height-56-cell',
  88: 'sea-metadata-table-row-height-88-cell',
  128: 'sea-metadata-table-row-height-128-cell',
};

export {
  ROW_HEIGHT_TYPE,
  ROW_HEIGHT_DEFAULT,
  ROW_HEIGHT_MAP,
  ROW_HEIGHT_CLASS_MAP
};
