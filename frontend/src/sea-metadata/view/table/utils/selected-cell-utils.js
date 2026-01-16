import { isFunction } from '@/utils/type-detection';
import { getCellValueByColumn, canEditCell } from '../../../utils/cell';
import { getGroupByPath } from '../../../utils/view';
import { getColumnByIndex, checkIsColumnEditable } from '../../../utils/column';
import { SUPPORT_PREVIEW_COLUMN_TYPES, NOT_SUPPORT_EDIT_COLUMN_TYPE_MAP } from '../../../constants';
import { Z_INDEX } from '@/constants/zIndexes';
import { getGroupRowByIndex } from './group-metrics';
import context from '../../../context';

const SELECT_DIRECTION = {
  UP: 'upwards',
  DOWN: 'downwards',
};

export const getRowTop = (rowIdx, rowHeight) => rowIdx * rowHeight;

export const getColumnsFromSelectedRange = ({ selectedRange, columns }, editable = false) => {
  const { topLeft, bottomRight } = selectedRange;
  const { idx: startColumnIdx } = topLeft;
  const { idx: endColumnIdx } = bottomRight;
  let selectedColumns = [];

  for (let j = startColumnIdx; j <= endColumnIdx; j++) {
    const column = columns[j];
    if (!column) continue;
    selectedColumns.push(column);
  }
  if (!editable) return selectedColumns;

  return selectedColumns.filter(column => !(!column.editable || NOT_SUPPORT_EDIT_COLUMN_TYPE_MAP[column.type]));
};

export const getRowsFromSelectedRange = ({ selectedRange, isGroupView, rowGetterByIndex }) => {
  const { topLeft, bottomRight } = selectedRange;
  const { rowIdx: startRowIdx, groupRowIndex } = topLeft;
  const { rowIdx: endRowIdx } = bottomRight;
  let currentGroupRowIndex = groupRowIndex;
  let rows = [];
  for (let rowIndex = startRowIdx, endIdx = endRowIdx + 1; rowIndex < endIdx; rowIndex++) {
    const row = rowGetterByIndex({ isGroupView, groupRowIndex: currentGroupRowIndex, rowIndex });
    if (isGroupView) {
      currentGroupRowIndex++;
    }
    if (row) {
      rows.push(row);
    }
  }
  return rows;
};

export const getSelectedRow = ({ selectedPosition, isGroupView, rowGetterByIndex }) => {
  const { groupRowIndex, rowIdx } = selectedPosition;
  return rowGetterByIndex({ isGroupView, groupRowIndex, rowIndex: rowIdx });
};

export const getSelectedColumn = ({ selectedPosition, columns }) => {
  const { idx } = selectedPosition;
  return getColumnByIndex(idx, columns);
};

export const getSelectedCellValue = ({ selectedPosition, columns, isGroupView, rowGetterByIndex }) => {
  const column = getSelectedColumn({ selectedPosition, columns });
  const row = getSelectedRow({ selectedPosition, isGroupView, rowGetterByIndex });
  return getCellValueByColumn(row, column);
};

export const isSelectedCellSupportOpenEditor = (cell, columns, isGroupView, rowGetterByIndex) => {
  const { idx, groupRowIndex, rowIdx } = cell;
  const column = columns[idx];
  if (!column) return false;
  if (SUPPORT_PREVIEW_COLUMN_TYPES.includes(column.type)) {
    return true;
  }

  const row = rowGetterByIndex({ isGroupView, groupRowIndex, rowIndex: rowIdx });
  if (!row) return false;
  return true;
};

export const isSelectedCellEditable = ({ enableCellSelect, selectedPosition, columns, isGroupView, rowGetterByIndex, onCheckCellIsEditable }) => {
  const column = getSelectedColumn({ selectedPosition, columns });
  const row = getSelectedRow({ selectedPosition, isGroupView, rowGetterByIndex });
  if (!context.canModifyCell(column, row)) return false;
  let isCellEditable = isFunction(onCheckCellIsEditable) ? onCheckCellIsEditable({ row, column, ...selectedPosition }) : true;
  return isCellEditable && canEditCell(column, row, enableCellSelect);
};

export const checkIsSelectedCellEditable = ({ enableCellSelect, selectedPosition, columns, isGroupView, rowGetterByIndex }) => {
  const column = getSelectedColumn({ selectedPosition, columns });
  if (!checkIsColumnEditable(column)) return false;
  const row = getSelectedRow({ selectedPosition, isGroupView, rowGetterByIndex });
  return context.canModifyCell(column, row);
};

export const checkIsSelectedCellsEditable = ({ columns, selectedRange }) => {
  const selectedColumns = getColumnsFromSelectedRange({ selectedRange, columns }, true);
  if (selectedColumns.length === 0) return false;
  return true;
};

export function selectedRangeIsSingleCell(selectedRange) {
  const { topLeft, bottomRight } = selectedRange;
  if (
    topLeft.idx !== bottomRight.idx ||
    topLeft.rowIdx !== bottomRight.rowIdx
  ) {
    return false;
  }
  return true;
}

export const getSelectedDimensions = ({
  selectedPosition, columns, rowHeight, scrollLeft, isGroupView, groupOffsetLeft,
  getRowTopFromRowsBody,
}) => {
  const { idx, rowIdx, groupRowIndex } = selectedPosition;
  const defaultDimensions = { width: 0, left: 0, top: 0, height: rowHeight, zIndex: 1 };
  if (idx >= 0) {
    const column = columns && columns[idx];
    if (!column) {
      return defaultDimensions;
    }
    const { frozen, width } = column;
    let left = frozen ? scrollLeft + column.left : column.left;
    let top;
    if (isGroupView) {
      left += groupOffsetLeft;
      // group view uses border-top, No group view uses border-bottom (for group animation) so selected top should be increased 1
      top = getRowTopFromRowsBody(groupRowIndex) + 1;
    } else {
      top = getRowTopFromRowsBody(rowIdx);
    }
    const zIndex = frozen ? Z_INDEX.FROZEN_CELL_MASK : Z_INDEX.CELL_MASK;
    return { width, left, top, height: rowHeight, zIndex };
  }
  return defaultDimensions;
};

export function getNewSelectedRange(startCell, nextCellPosition) {
  const { idx: currentIdx, rowIdx: currentRowIdx, groupRowIndex: currentGroupRowIndex } = startCell;
  const { idx: newIdx, rowIdx: newRowIdx, groupRowIndex: newGroupRowIndex } = nextCellPosition;
  const colIndexes = [currentIdx, newIdx].sort((a, b) => a - b);
  const rowIndexes = [currentRowIdx, newRowIdx].sort((a, b) => a - b);
  const groupRowIndexes = [currentGroupRowIndex, newGroupRowIndex].sort((a, b) => a - b);
  const topLeft = { idx: colIndexes[0], rowIdx: rowIndexes[0], groupRowIndex: groupRowIndexes[0] };
  const bottomRight = { idx: colIndexes[1], rowIdx: rowIndexes[1], groupRowIndex: groupRowIndexes[1] };
  return { topLeft, bottomRight };
}

const getColumnRangeProperties = (from, to, columns, scrollLeft) => {
  let totalWidth = 0;
  let anyColFrozen = false;
  for (let i = from; i <= to; i++) {
    const column = columns[i];
    if (column) {
      totalWidth += column.width;
      anyColFrozen = anyColFrozen || column.frozen;
    }
  }
  return { totalWidth, anyColFrozen, left: anyColFrozen ? columns[from].left + scrollLeft : columns[from].left };
};

export const getSelectedRangeDimensions = ({
  selectedRange, columns, rowHeight, isGroupView, groups, groupMetrics,
  groupOffsetLeft, getRowTopFromRowsBody, scrollLeft,
}) => {
  const { topLeft, bottomRight, startCell, cursorCell } = selectedRange;
  if (topLeft.idx < 0) {
    return { width: 0, left: 0, top: 0, height: rowHeight, zIndex: Z_INDEX.CELL_MASK };
  }

  let { totalWidth, anyColFrozen, left } = getColumnRangeProperties(topLeft.idx, bottomRight.idx, columns, scrollLeft);
  let height;
  let top;
  if (isGroupView) {
    let { groupRowIndex: startGroupRowIndex } = startCell;
    let { groupRowIndex: endGroupRowIndex } = cursorCell;
    const startGroupRow = getGroupRowByIndex(startGroupRowIndex, groupMetrics);
    const endGroupRow = getGroupRowByIndex(endGroupRowIndex, groupMetrics);
    const startGroupPathString = startGroupRow.groupPathString;
    const endGroupPathString = endGroupRow.groupPathString;
    let topGroupRowIndex;
    let selectDirection;
    if (startGroupRowIndex < endGroupRowIndex) {
      topGroupRowIndex = startGroupRowIndex;
      selectDirection = SELECT_DIRECTION.DOWN;
    } else {
      topGroupRowIndex = endGroupRowIndex;
      selectDirection = SELECT_DIRECTION.UP;
    }

    if (startGroupPathString === endGroupPathString) {
      // within the same group.
      height = (Math.abs(endGroupRowIndex - startGroupRowIndex) + 1) * rowHeight;
    } else if (selectDirection === SELECT_DIRECTION.DOWN) {
      // within different group: select cells from top to bottom.
      const groupPath = startGroupRow.groupPath;
      const group = getGroupByPath(groupPath, groups);
      const groupRowIds = group.row_ids || [];
      height = (groupRowIds.length - startGroupRow.rowIdx || 0) * rowHeight;
    } else if (selectDirection === SELECT_DIRECTION.UP) {
      // within different group: select cells from bottom to top.
      const startGroupRowIdx = startGroupRow.rowIdx || 0;
      topGroupRowIndex = startGroupRowIndex - startGroupRowIdx;
      height = (startGroupRowIdx + 1) * rowHeight;
    }
    height += 1; // row height: 32
    left += groupOffsetLeft;
    top = getRowTopFromRowsBody(topGroupRowIndex);
  } else {
    height = (bottomRight.rowIdx - topLeft.rowIdx + 1) * rowHeight;
    top = getRowTopFromRowsBody(topLeft.rowIdx);
  }

  const zIndex = anyColFrozen ? Z_INDEX.FROZEN_CELL_MASK : Z_INDEX.CELL_MASK;
  return { width: totalWidth, left, top, height, zIndex };
};
