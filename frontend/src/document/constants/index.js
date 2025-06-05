export const PAGE_TYPE = {
  LETTER: 'LETTER',
  LEGAL: 'LEGAL',
  A4: 'A4',
  INDEX_CARD: 'INDEX_CARD',
  BUSINESS_CARD: 'BUSINESS_CARD',
  CUSTOM: 'CUSTOM',
};

export const PAGE_TYPE_TITLE = {
  LETTER: 'Letter (8.5 x 11 in)',
  LEGAL: 'Legal (8.4 x 14 in)',
  A4: 'A4 (21 x 29.7 cm)',
  INDEX_CARD: 'Index card (3 x 5 in)',
  BUSINESS_CARD: 'Business card (2 x 3.5 in)',
  CUSTOM: 'Custom',
};

export const PAGE_SIZE = {
  LETTER: {
    width: 816,
    height: 1056,
  },
  LEGAL: {
    width: 816,
    height: 1345,
  },
  A4: {
    width: 793,
    height: 1121,
  },
  INDEX_CARD: {
    width: 288,
    height: 480,
  },
  BUSINESS_CARD: {
    width: 192,
    height: 336
  }
};

export const PAGE_LAYOUT_TYPE = {
  PORTRAIT: 'portrait',
  LANDSCAPE: 'landscape'
};

export const DEFAULT_PAGE_SIZE = {
  width: 793,
  height: 1121,
};

export const DEFAULT_PAGE_MARGIN = {
  top: 40,
  bottom: 40,
  left: 60,
  right: 60,
};

export const PLUGIN_NAME = 'document';
