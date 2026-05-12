import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import Formatter from './formatter';
import CellOperationBtn from './operation-btn';
import { isFunction } from '@/utils/type-detection';
import ObjectUtils from '@utils/object-utils';
import { isCellValueChanged, getCellValueByColumn } from '../../../../../../utils/cell';
import { TABLE_SUPPORT_EDIT_TYPE_MAP } from '../../../../../../constants';
import context from '../../../../../../context';
import { getEventClassName } from '@/utils/dom';

import './index.css';

const Cell = React.memo(({
  needBindEvents = true,
  column,
  row,
  groupRowIndex,
  rowIndex,
  cellMetaData,
  highlightClassName,
  rowHeightClassName,
  isLastCell,
  isLastFrozenCell,
  isCellSelected,
  bgColor,
  frozen,
  height,
}) => {
  const canEditable = useMemo(() => {
    if (!context.canModifyCell(column, row)) return false;
    const { type } = column;
    if (!TABLE_SUPPORT_EDIT_TYPE_MAP[type]) return false;
    return true;
  }, [column, row]);

  const className = useMemo(() => {
    const { type } = column;
    return classnames('sea-metadata-table-cell', `sea-metadata-table-${type}-cell`, highlightClassName, rowHeightClassName, {
      'table-cell-uneditable': !canEditable,
      'table-cell-clickable': column.click,
      'last-cell': isLastCell,
      'table-last--frozen': isLastFrozenCell,
      'cell-selected': isCellSelected,
      // 'dragging-file-to-cell': ,
      // 'row-comment-cell': ,
    });
  }, [canEditable, column, rowHeightClassName, highlightClassName, isLastCell, isLastFrozenCell, isCellSelected]);
  const style = useMemo(() => {
    const { left, width } = column;
    let value = {
      width,
      height,
    };
    if (!frozen) {
      value.left = left;
    }
    if (bgColor) {
      value['backgroundColor'] = bgColor;
    }
    return value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frozen, height, column, column.left, bgColor]);

  const onCellClick = useCallback((event) => {
    const cell = { idx: column.idx, groupRowIndex, rowIdx: rowIndex };

    // select cell
    if (isFunction(cellMetaData.onCellClick)) {
      cellMetaData.onCellClick(cell, event);
    }
  }, [column, groupRowIndex, rowIndex, cellMetaData]);

  const onCellDoubleClick = useCallback((event) => {
    if (!isFunction(cellMetaData.onCellDoubleClick)) return;
    const cell = { idx: column.idx, groupRowIndex, rowIdx: rowIndex };
    cellMetaData.onCellDoubleClick(cell, event);
  }, [column, groupRowIndex, rowIndex, cellMetaData]);

  const onCellMouseDown = useCallback((event) => {
    if (event.button === 2) return;
    if (!isFunction(cellMetaData.onCellMouseDown)) return;
    const cell = { idx: column.idx, groupRowIndex, rowIdx: rowIndex };
    cellMetaData.onCellMouseDown(cell, event);
  }, [column, groupRowIndex, rowIndex, cellMetaData]);

  const onCellMouseEnter = useCallback((event) => {
    if (!isFunction(cellMetaData.onCellMouseEnter)) return;
    // long text cell className is special, so we need to check it separately
    if (getEventClassName(event).includes('sea-metadata-table-cell') || getEventClassName(event).includes('sea-metadata-table-long-text-cell')) {
      const cell = { idx: column.idx, groupRowIndex, rowIdx: rowIndex };
      const mousePosition = { x: event.clientX, y: event.clientY };
      cellMetaData.onCellMouseEnter({ ...cell, mousePosition }, event);
    }
  }, [column, groupRowIndex, rowIndex, cellMetaData]);

  const onCellMouseMove = useCallback((event) => {
    if (!isFunction(cellMetaData.onCellMouseMove)) return;
    // long text cell className is special, so we need to check it separately
    if (getEventClassName(event).includes('sea-metadata-table-cell') || getEventClassName(event).includes('sea-metadata-long-text-formatter')) {
      const cell = { idx: column.idx, groupRowIndex, rowIdx: rowIndex };
      const mousePosition = { x: event.clientX, y: event.clientY };
      cellMetaData.onCellMouseMove({ ...cell, mousePosition }, event);
    }
  }, [column, groupRowIndex, rowIndex, cellMetaData]);

  const onCellMouseLeave = useCallback(() => {
    return;
  }, []);

  const onDragOver = useCallback((event) => {
    event.stopPropagation();
    event.preventDefault();
  }, []);

  const onCellContextMenu = useCallback((event) => {
    event.preventDefault();
    const cell = { idx: column.idx, groupRowIndex, rowIdx: rowIndex };
    if (!isFunction(cellMetaData.onCellContextMenu)) return;
    cellMetaData.onCellContextMenu(cell);
  }, [cellMetaData, column, groupRowIndex, rowIndex]);

  const getEvents = useCallback(() => {
    return {
      onClick: onCellClick,
      onDoubleClick: onCellDoubleClick,
      onMouseDown: onCellMouseDown,
      onMouseEnter: onCellMouseEnter,
      onMouseMove: onCellMouseMove,
      onMouseLeave: onCellMouseLeave,
      onDragOver: onDragOver,
      onContextMenu: onCellContextMenu,
    };
  }, [onCellClick, onCellDoubleClick, onCellMouseDown, onCellMouseEnter, onCellMouseMove, onCellMouseLeave, onDragOver, onCellContextMenu]);

  const getOldRowData = useCallback((oldValue) => {
    const { key: columnKey } = column;
    const oldRowData = { [columnKey]: oldValue };
    return oldRowData;
  }, [column]);

  const modifyRow = useCallback((rowUpdate) => {
    if (!isFunction(cellMetaData.modifyRow)) return;
    const { key: columnKey, type: columnType } = column;
    const originalOldCellValue = getCellValueByColumn(row, column);
    if (!isCellValueChanged(originalOldCellValue, rowUpdate[columnKey], columnType)) return;
    const rowId = row._id;
    const oldRowData = getOldRowData(originalOldCellValue);
    // rowUpdate used for update remote row data
    // oldRowData ues for undo/undo modify row
    cellMetaData.modifyRow({ rowId, cellKey: columnKey, rowUpdate, oldRowData });
  }, [cellMetaData, row, column, getOldRowData]);

  const cellValue = getCellValueByColumn(row, column);
  const cellEvents = needBindEvents && getEvents();
  const containerProps = {
    className,
    style,
    ...cellEvents,
  };
  return (
    <div key={`${row._id}-${column.key}`} {...containerProps}>
      <Formatter
        isCellSelected={isCellSelected}
        value={cellValue}
        column={column}
        row={row}
        height={height}
        onChange={modifyRow}
        onClick={isCellSelected && column.click ? column.click : null}
      />
      {isCellSelected && (<CellOperationBtn row={row} column={column}/>)}
    </div>
  );
}, (props, nextProps) => {
  const {
    row: oldRow, column, isCellSelected, isLastCell, highlightClassName,
    height, bgColor } = props;
  const { row: newRow, highlightClassName: newHighlightClassName, height: newHeight, column: newColumn, bgColor: newBgColor } = nextProps;
  // the modification of column is not currently supported, only the modification of cell data is considered
  const oldValue = getCellValueByColumn(oldRow, column);
  const newValue = getCellValueByColumn(newRow, column);
  const isChanged = (
    isCellValueChanged(oldValue, newValue, column.type) ||
    oldRow._last_modifier !== newRow._last_modifier ||
    isCellSelected !== nextProps.isCellSelected ||
    isLastCell !== nextProps.isLastCell ||
    highlightClassName !== newHighlightClassName ||
    height !== newHeight ||
    column.left !== newColumn.left ||
    column.width !== newColumn.width ||
    bgColor !== newBgColor ||
    !ObjectUtils.isSameObject(column.data, newColumn.data) ||
    props.groupRowIndex !== nextProps.groupRowIndex ||
    props.rowIndex !== nextProps.rowIndex
  );
  return !isChanged;
});

Cell.propTypes = {
  frozen: PropTypes.bool,
  isCellSelected: PropTypes.bool,
  isLastCell: PropTypes.bool,
  isLastFrozenCell: PropTypes.bool,
  cellMetaData: PropTypes.object,
  row: PropTypes.object.isRequired,
  groupRowIndex: PropTypes.number,
  rowIndex: PropTypes.number.isRequired,
  column: PropTypes.object.isRequired,
  height: PropTypes.number,
  needBindEvents: PropTypes.bool,
  modifyRow: PropTypes.func,
  lockRowViaButton: PropTypes.func,
  modifyRowViaButton: PropTypes.func,
  reloadCurrentRow: PropTypes.func,
  highlightClassName: PropTypes.string,
  rowHeightClassName: PropTypes.string,
  bgColor: PropTypes.string,
};

export default Cell;
