import React from 'react';
import PropTypes from 'prop-types';
import CellMask from './cell-mask';

function DragMask({ draggedRange, getSelectedRangeDimensions, getSelectedDimensions }) {
  const { overRowIdx, bottomRight } = draggedRange;
  const { idx: endColumnIdx, rowIdx: endRowIdx, groupRowIndex: endGroupRowIndex } = bottomRight;
  if (overRowIdx !== null && endRowIdx < overRowIdx) {
    let dimensions = getSelectedRangeDimensions(draggedRange);
    for (let currentRowIdx = endRowIdx + 1; currentRowIdx <= overRowIdx; currentRowIdx++) {
      const { height } = getSelectedDimensions({ idx: endColumnIdx, rowIdx: currentRowIdx, groupRowIndex: endGroupRowIndex });
      dimensions.height += height;
    }
    return (
      <CellMask
        {...dimensions}
        className="react-grid-cell-dragged-over-down"
        id="sea-metadata-table-cell-dragged-over-down"
      />
    );
  }
  return null;
}


DragMask.propTypes = {
  draggedRange: PropTypes.object.isRequired,
  getSelectedRangeDimensions: PropTypes.func.isRequired,
  getSelectedDimensions: PropTypes.func.isRequired
};

export default DragMask;
