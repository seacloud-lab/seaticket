import { TRANSFER_TYPES } from '../constants';
import { getClientCellValueDisplayString } from './cell';
import { getColumnByIndex } from './column';
import { toggleSelection } from './toggle-selection';

const { TEXT, FRAGMENT } = TRANSFER_TYPES;

function setEventTransfer({
  type, selectedRowIds, copiedRange, copiedColumns, copiedRows, copiedTableId, copiedViewId, tableData, copiedText,
  rowGetterById, isGroupView, rowGetterByIndex, event = {}, collaborators, tagsData,
}) {
  const transfer = event.dataTransfer || event.clipboardData;
  if (type === TRANSFER_TYPES.METADATA_FRAGMENT) {
    const copiedText = Array.isArray(selectedRowIds) && selectedRowIds.length > 0 ?
      getCopiedTextFormSelectedRowIds(selectedRowIds, tableData, rowGetterById, { collaborators, tagsData }) :
      getCopiedTextFromSelectedCells(copiedRange, tableData, isGroupView, rowGetterByIndex, { collaborators, tagsData });
    const copiedGrid = {
      selectedRowIds,
      copiedRange,
      copiedColumns,
      copiedRows,
      copiedTableId,
      copiedViewId,
    };
    const serializeCopiedGrid = JSON.stringify(copiedGrid);
    if (transfer) {
      transfer.setData(TEXT, copiedText);
      transfer.setData(FRAGMENT, serializeCopiedGrid);
    } else {
      execCopyWithNoEvents(copiedText, serializeCopiedGrid);
    }
  } else {
    let format = TRANSFER_TYPES[type.toUpperCase()];
    if (transfer) {
      transfer.setData(format, copiedText);
    } else {
      execCopyWithNoEvents(copiedText, { format });
    }
  }
}

function getCopiedTextFormSelectedRowIds(selectedRowIds, tableData, rowGetterById, { collaborators = [] } = {}) {
  const rows = selectedRowIds.map(rowId => rowGetterById(rowId));
  return getCopiedText(rows, tableData.columns, { collaborators });
}

function getCopiedTextFromSelectedCells(copiedRange, tableData, isGroupView, rowGetterByIndex, { collaborators, tagsData }) {
  const { topLeft, bottomRight } = copiedRange;
  const { rowIdx: minRowIndex, idx: minColumnIndex, groupRowIndex } = topLeft;
  const { rowIdx: maxRowIndex, idx: maxColumnIndex } = bottomRight;
  const { columns } = tableData;
  let currentGroupRowIndex = groupRowIndex;
  let operateRows = [];
  let operateColumns = [];
  for (let i = minRowIndex; i <= maxRowIndex; i++) {
    operateRows.push(rowGetterByIndex({ isGroupView, groupRowIndex: currentGroupRowIndex, rowIndex: i }));
    if (isGroupView) {
      currentGroupRowIndex++;
    }
  }
  for (let i = minColumnIndex; i <= maxColumnIndex; i++) {
    operateColumns.push(getColumnByIndex(i, columns));
  }
  return getCopiedText(operateRows, operateColumns, { collaborators, tagsData });
}

function getCopiedText(rows, columns, { collaborators = [], tagsData } = {}) {
  const lastRowIndex = rows.length - 1;
  const lastColumnIndex = columns.length - 1;
  let copiedText = '';
  rows.forEach((row, rowIndex) => {
    columns.forEach((column, columnIndex) => {
      copiedText += (row && getClientCellValueDisplayString(row, column, { collaborators, tagsData })) || '';
      if (columnIndex < lastColumnIndex) {
        copiedText += '\t';
      }
    });
    if (rowIndex < lastRowIndex) {
      copiedText += '\n';
    }
  });
  return copiedText;
}

export function execCopyWithNoEvents(text, serializeContent) {
  let reselectPrevious;
  let range;
  let selection;
  let mark;
  let success = false;
  try {
    reselectPrevious = toggleSelection();
    range = document.createRange();
    selection = document.getSelection();
    mark = document.createElement('span');
    mark.textContent = text;
    mark.addEventListener('copy', function (e) {
      e.stopPropagation();
      e.preventDefault();
      let transfer = e.dataTransfer || e.clipboardData;
      transfer.clearData();
      transfer.setData(TEXT, text);
      transfer.setData(FRAGMENT, serializeContent);
    });
    document.body.appendChild(mark);
    range.selectNodeContents(mark);
    selection.addRange(range);
    success = document.execCommand('copy');
    if (!success) {
      return false;
    }
  } catch {
    return false;
  } finally {
    if (mark) {
      document.body.removeChild(mark);
    }
    reselectPrevious();
  }
}

export default setEventTransfer;
