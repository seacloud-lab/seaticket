export const Z_INDEX = {
  // CellMasks should render in front of the cells
  // Unfrozen cells do not have a zIndex specifed
  CELL_MASK: 1,
  TABLE_MAIN_INTERVAL: 1,
  RESIZE_HANDLE: 1,
  SEQUENCE_COLUMN: 2,

  //  higher than unfrozen header cell(0), RESIZE_HANDLE
  FROZEN_HEADER_CELL: 2,
  GROUP_FROZEN_HEADER: 2,
  SCROLL_BAR: 2,

  // In front of CELL_MASK/non-frozen cell(1)、back of the frozen cells (2)
  GROUP_BACKDROP: 2,
  FROZEN_GROUP_CELL: 2,

  // Frozen cells have a zIndex value of 2 so CELL_MASK should have a higher value
  FROZEN_CELL_MASK: 3,

  // need higher than the doms(etc. cell, cell_mask) which behind of the grid header
  GRID_FOOTER: 4,

  // EditorContainer is rendered outside the grid and it higher FROZEN_GROUP_CELL(2)
  EDITOR_CONTAINER: 9,

  RESIZE_BAR: 104,
  INBOX: 103,
  LONG_TEXT_EDITOR: 102,
  // home header should higher than resize bar (104)
  HOME_HEADER: 105,
  // search mask should higher than others but lower than modal mask (1050)
  SEARCH_MASK: 1045,
  SEARCH_CONTAINER: 1046,
};
