function selectRow(rowId, rowMetrics) {
  if (isRowSelected(rowId, rowMetrics)) {
    return;
  }
  rowMetrics.idSelectedRowMap[rowId] = true;
}

function selectRowsById(rowIds, rowMetrics) {
  rowIds.forEach(rowId => {
    selectRow(rowId, rowMetrics);
  });
}

function deselectRow(rowId, rowMetrics) {
  if (!isRowSelected(rowId, rowMetrics)) {
    return;
  }
  delete rowMetrics.idSelectedRowMap[rowId];
}

function deselectAllRows(rowMetrics) {
  rowMetrics.idSelectedRowMap = {};
}

function isRowSelected(rowId, rowMetrics) {
  return rowMetrics.idSelectedRowMap[rowId];
}

function getSelectedIds(rowMetrics) {
  return Object.keys(rowMetrics.idSelectedRowMap);
}

function hasSelectedRows(rowMetrics) {
  return getSelectedIds(rowMetrics).length > 0;
}

function isSelectedAll(rowIds, rowMetrics) {
  const selectedRowsLen = getSelectedIds(rowMetrics).length;
  if (selectedRowsLen === 0) {
    return false;
  }
  return rowIds.every(rowId => isRowSelected(rowId, rowMetrics));
}

const RowMetrics = {
  selectRow,
  selectRowsById,
  deselectRow,
  deselectAllRows,
  isRowSelected,
  getSelectedIds,
  hasSelectedRows,
  isSelectedAll,
};

export default RowMetrics;
