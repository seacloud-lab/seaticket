export const IMAGE_QUALITY = {
  GOOD: 'Good',
  BETTER: 'Better',
  BEST: 'Best',
  ORIGINAL: 'Original'
};

export const PAGE_TYPE = {
  LETTER: 'Letter(8.5 x 11 in)',
  LEGAL: 'Legal(8.5 x 14 in)',
  A4: 'A4(210 x 297 mm)',
  INDEX_CARD: 'Index card(3 x 5 in)',
  BUSINESS_CARD: 'Business card(2 x 3.5 in)',
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

export const LAYOUT_TYPE = {
  PORTRAIT: 'portrait',
  LANDSCAPE: 'landscape'
};

export const ROW_TYPE = {
  CURRENT_ROW: 'current_row',
  VIEW_ROWS: 'view_rows'
};

export const DEFAULT_PRINT_SETTINGS = {
  'row_type': ROW_TYPE['CURRENT_ROW'],
  // 'image_quality': 'BEST',
  'page_type': 'A4',
  'page_size': {
    'width': 794,
    'height': 1123
  },
  'page_orientation': LAYOUT_TYPE['PORTRAIT']
};
