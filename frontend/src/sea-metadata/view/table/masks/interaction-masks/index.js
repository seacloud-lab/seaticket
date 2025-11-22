import React, { isValidElement, cloneElement } from 'react';
import PropTypes from 'prop-types';
import deepCopy from 'deep-copy';
import toaster from '@/components/toaster';
import EditorPortal from '../../editors/editor-portal';
import EditorContainer from '../../editors/editor-container';
import DragHandler from '../drag-handler';
import DragMask from '../drag-mask';
import SelectionRangeMask from '../selection-range-mask';
import SelectionMask from '../selection-mask';
import { gettext, KeyCodes } from '@/constants';
import { isFunction } from '@/utils/type-detection';
import { isEmptyObject } from '@/utils/object-utils';
import {
  GRID_HEADER_DOUBLE_HEIGHT, GRID_HEADER_DEFAULT_HEIGHT, HEADER_HEIGHT_TYPE, PASTE_SOURCE, EDITOR_TYPE,
  TRANSFER_TYPES, GROUP_ROW_TYPE, EVENT_BUS_TYPE, NOT_SUPPORT_EDIT_COLUMN_TYPE_MAP
} from '../../../../constants';
import {
  getNewSelectedRange, getSelectedDimensions, selectedRangeIsSingleCell,
  getSelectedRangeDimensions, getSelectedRow, getSelectedColumn,
  getRowsFromSelectedRange, getSelectedCellValue, checkIsSelectedCellEditable,
} from '../../utils/selected-cell-utils';
import RowMetrics from '../../utils/row-metrics';
import setEventTransfer from '../../../../utils/set-event-transfer';
import getEventTransfer from '../../../../utils/get-event-transfer';
import { getGroupRowByIndex } from '../../utils/group-metrics';
import { isSpace } from '@/utils/hotkey';
import eventBus from '@/utils/event-bus';
import { isCtrlKeyHeldDown, isKeyPrintable } from '@/utils/keyboard-utils';
import { checkIsColumnSupportPreview, getColumnIndexByKey } from '../../../../utils/column';
import { getCellValueByColumn, isValidCellValue, getFormatRowData } from '../../../../utils/cell';
import { getEventClassName } from '@/utils/dom';
import context from '@/sea-metadata/context';

import './index.css';

class InteractionMasks extends React.Component {

  throttle = null;

  constructor(props) {
    super(props);
    const initPosition = { idx: -1, rowIdx: -1, groupRowIndex: -1 };
    this.state = {
      selectedPosition: initPosition,
      selectedRange: {
        topLeft: initPosition,
        bottomRight: initPosition,
        startCell: null,
        cursorCell: null,
        isDragging: false,
      },
      draggedRange: null,
      isEditorEnabled: false,
      openEditorMode: '',
    };
    this.eventBus = eventBus;
    this.pasteSource = PASTE_SOURCE.COPY;
    this.cutPosition = null;
    this.selectionMask = null;
    this.canModifyRows = context.canModifyRows();
  }

  componentDidMount() {
    this.unsubscribeSelectColumn = this.eventBus.subscribe(EVENT_BUS_TYPE.SELECT_COLUMN, this.onColumnSelect);
    this.unsubscribeDragEnter = this.eventBus.subscribe(EVENT_BUS_TYPE.DRAG_ENTER, this.handleDragEnter);
    this.unsubscribeSelectCell = this.eventBus.subscribe(EVENT_BUS_TYPE.SELECT_CELL, this.onSelectCell);
    this.unsubscribeSelectNone = this.eventBus.subscribe(EVENT_BUS_TYPE.SELECT_NONE, this.selectNone);
    this.unsubscribeSelectStart = this.eventBus.subscribe(EVENT_BUS_TYPE.SELECT_START, this.onSelectCellRangeStarted);
    this.unsubscribeSelectUpdate = this.eventBus.subscribe(EVENT_BUS_TYPE.SELECT_UPDATE, this.onSelectCellRangeUpdated);
    this.unsubscribeSelectEnd = this.eventBus.subscribe(EVENT_BUS_TYPE.SELECT_END, this.onSelectCellRangeEnded);
    this.unsubscribeOpenEditorEvent = this.eventBus.subscribe(EVENT_BUS_TYPE.OPEN_EDITOR, this.onOpenEditorEvent);
    this.unsubscribeCloseEditorEvent = this.eventBus.subscribe(EVENT_BUS_TYPE.CLOSE_EDITOR, this.onCloseEditorEvent);
    this.unsubscribeCopy = this.eventBus.subscribe(EVENT_BUS_TYPE.COPY_CELLS, this.onCopy);
    this.unsubscribePaste = this.eventBus.subscribe(EVENT_BUS_TYPE.PASTE_CELLS, this.onPaste);
    this.unsubscribeCut = this.eventBus.subscribe(EVENT_BUS_TYPE.CUT_CELLS, this.onCut);
  }

  componentDidUpdate(prevProps, prevState) {
    const { selectedRange, isEditorEnabled } = this.state;
    const { selectedRange: prevSelectedRange, isEditorEnabled: prevIsEditorEnabled } = prevState;
    const isEditorClosed = isEditorEnabled !== prevIsEditorEnabled && !isEditorEnabled;
    const isSelectedRangeChanged = selectedRange !== prevSelectedRange && (selectedRange.topLeft !== prevSelectedRange.topLeft || selectedRange.bottomRight !== prevSelectedRange.bottomRight);
    if (isSelectedRangeChanged || isEditorClosed) {
      this.focus();
    }
  }

  componentWillUnmount() {
    this.unsubscribeSelectColumn();
    this.unsubscribeSelectCell();
    this.unsubscribeSelectStart();
    this.unsubscribeSelectUpdate();
    this.unsubscribeSelectEnd();
    this.unsubscribeOpenEditorEvent();
    this.unsubscribeCloseEditorEvent();
    this.unsubscribeCopy();
    this.unsubscribePaste();
    this.unsubscribeCut();
    this.setState = (state, callback) => {
      return;
    };
  }

  onColumnSelect = (column) => {
    const { columns, isGroupView = false, rowsCount } = this.props;
    if (isGroupView) return;
    const selectColumnIndex = getColumnIndexByKey(column.key, columns);
    this.setState({
      selectedPosition: { ...this.state.selectedPosition, idx: selectColumnIndex, rowIdx: 0 },
      selectedRange: {
        startCell: { idx: selectColumnIndex, rowIdx: 0 },
        topLeft: { idx: selectColumnIndex, rowIdx: 0 },
        bottomRight: { idx: selectColumnIndex, rowIdx: rowsCount - 1 },
        isDragging: false,
      }
    });
  };

  onOpenEditorEvent = (mode, op) => {
    this.setState({ openEditorMode: mode, selectedOperation: op }, () => {
      this.openEditor(null);
    });
  };

  onCloseEditorEvent = () => {
    if (this.state.isEditorEnabled) {
      this.closeEditor();
    }
  };

  onSelectCell = (cell, openEditor) => {
    const { selectedPosition, isEditorEnabled } = this.state;
    const callback = openEditor ? this.openEditor : () => null;

    if (isEditorEnabled) {
      this.closeEditor();
    }

    this.setState((prevState) => {
      const next = { ...selectedPosition, ...cell };
      if (this.isCellWithinBounds(next)) {
        return {
          selectedPosition: next,
          selectedRange: {
            topLeft: next,
            bottomRight: next,
            startCell: next,
            cursorCell: next,
            isDragging: false,
          }
        };
      }
      return prevState;
    }, callback);
  };

  selectNone = () => {
    const initPosition = { idx: -1, rowIdx: -1, groupRowIndex: -1 };
    this.setState({
      selectedPosition: initPosition,
      selectedRange: {
        topLeft: initPosition,
        bottomRight: initPosition,
        startCell: null,
        cursorCell: null,
      },
    });
    this.props.selectNone();
  };

  getSelectedPosition = () => {
    const { topLeft, bottomRight } = this.state.selectedRange;
    return {
      top: topLeft.rowIdx,
      bottom: bottomRight.rowIdx,
      left: topLeft.idx,
      right: bottomRight.idx,
    };
  };

  getSelectedRange = () => {
    return this.state.selectedRange;
  };

  selectCell = (groupRowIndex, rowIdx, idx) => {
    const selectedPosition = { idx, groupRowIndex, rowIdx };
    this.setState({
      selectedPosition,
      selectedRange: {
        topLeft: selectedPosition,
        bottomRight: selectedPosition,
        startCell: selectedPosition,
        cursorCell: selectedPosition,
      },
    });
  };

  // onCellSelect || onKeyDown
  openEditor = (event = null) => {
    const { key } = event || {};
    const { isEditorEnabled, selectedPosition, openEditorMode } = this.state;
    const { columns } = this.props;
    const selectedColumn = getSelectedColumn({ selectedPosition, columns });
    // how to open editors?
    // 1. editor is closed
    // 2. row-cell is editable or open editor with preview mode
    if (!isEditorEnabled && (this.checkIsSelectedCellEditable() || (openEditorMode === EDITOR_TYPE.PREVIEWER && checkIsColumnSupportPreview(selectedColumn)))) {
      this.setState({
        isEditorEnabled: true,
        firstEditorKeyDown: key,
        editorPosition: this.getEditorPosition()
      });
    }
  };

  closeEditor = () => {
    this.setState({
      isEditorEnabled: false,
      firstEditorKeyDown: null,
      editorPosition: null,
      openEditorMode: ''
    });
  };

  onSelectCellRangeStarted = (selectedPosition) => {
    if (!this.isCellWithinBounds(selectedPosition)) return;

    const selectedRange = this.createSingleCellSelectedRange(selectedPosition, true);
    this.setState({ selectedRange }, () => {
      if (isFunction(this.props.onCellRangeSelectionStarted)) {
        this.props.onCellRangeSelectionStarted(this.state.selectedRange);
      }
    });
  };

  onSelectCellRangeUpdated = (cellPosition, isFromKeyboard, callback) => {
    if (!this.state.selectedRange.isDragging && !isFromKeyboard) {
      return;
    }

    if (!this.isCellWithinBounds(cellPosition)) {
      return;
    }

    const startCell = this.state.selectedRange.startCell || this.state.selectedPosition;
    const { topLeft, bottomRight } = getNewSelectedRange(startCell, cellPosition);
    const selectedRange = {
      // default the startCell to the selected cell, in case we've just started via keyboard
      startCell: this.state.selectedPosition,
      // assign the previous state (which will override the startCell if we already have one)
      ...this.state.selectedRange,
      // assign the new state - the bounds of the range, and the new cursor cell
      topLeft,
      bottomRight,
      cursorCell: cellPosition
    };

    this.setState({ selectedRange }, () => {
      if (isFunction(this.props.onCellRangeSelectionUpdated)) {
        this.props.onCellRangeSelectionUpdated(this.state.selectedRange);
      }
      if (isFunction(callback)) {
        callback(selectedRange);
      }
    });
  };

  onSelectCellRangeEnded = () => {
    const selectedRange = { ...this.state.selectedRange, isDragging: false };
    this.setState({ selectedRange }, () => {
      if (isFunction(this.props.onCellRangeSelectionCompleted)) {
        this.props.onCellRangeSelectionCompleted(this.state.selectedRange);
      }
    });
  };

  createSingleCellSelectedRange(cellPosition, isDragging) {
    return {
      topLeft: cellPosition,
      bottomRight: cellPosition,
      startCell: cellPosition,
      cursorCell: cellPosition,
      isDragging
    };
  }

  focus = () => {
    if (this.selectionMask && !this.isFocused()) {
      this.selectionMask.focus();
    }
  };

  isFocused = () => {
    return document.activeElement === this.selectionMask;
  };

  checkIsCellSelected = () => {
    const { selectedPosition } = this.state;
    return selectedPosition.idx !== -1 && selectedPosition.rowIdx !== -1;
  };

  isCellWithinBounds = ({ idx, rowIdx }) => {
    const { columns, rowsCount } = this.props;
    const maxRowIdx = rowsCount;
    return rowIdx >= 0 && rowIdx < maxRowIdx && idx >= 0 && idx < columns.length;
  };

  checkIsSelectedCellEditable = () => {
    const { enableCellSelect = true, columns, isGroupView = false, rowGetterByIndex } = this.props;
    const { selectedPosition } = this.state;
    return checkIsSelectedCellEditable({ enableCellSelect, columns, isGroupView, selectedPosition, rowGetterByIndex });
  };

  isGridSelected = () => {
    return this.isCellWithinBounds(this.state.selectedPosition);
  };

  getSelectedDimensions = (selectedPosition) => {
    const { columns, rowHeight, isGroupView = false, groupOffsetLeft = 0, getRowTop: getRowTopFromRowsBody } = this.props;
    const scrollLeft = this.props.getScrollLeft();
    return {
      ...getSelectedDimensions({
        selectedPosition, columns, scrollLeft, rowHeight, isGroupView, groupOffsetLeft, getRowTopFromRowsBody
      })
    };
  };

  getSelectedRangeDimensions = (selectedRange) => {
    const { columns, rowHeight, isGroupView = false, groups, groupMetrics, groupOffsetLeft = 0, getRowTop: getRowTopFromRowsBody } = this.props;
    return {
      ...getSelectedRangeDimensions({
        selectedRange, columns, rowHeight, isGroupView, groups, groupMetrics, groupOffsetLeft, getRowTopFromRowsBody,
      })
    };
  };

  setScrollLeft = (scrollLeft, scrollTop) => {
    const { selectionMask, state: { selectedPosition } } = this;
    this.setMaskScrollLeft(selectionMask, selectedPosition, scrollLeft, scrollTop);
  };

  geHeaderHeight = () => {
    // const { table } = this.props;
    const settings = {}; // table.header_settings || {};
    const heightMode = isEmptyObject(settings) ? HEADER_HEIGHT_TYPE.DEFAULT : settings.header_height;
    const containerHeight = heightMode === HEADER_HEIGHT_TYPE.DOUBLE ? GRID_HEADER_DOUBLE_HEIGHT : GRID_HEADER_DEFAULT_HEIGHT;
    // 1: header border-bottom
    return containerHeight + 1;
  };

  setMaskScrollLeft = (mask, position, scrollLeft, scrollTop) => {
    const headerHeight = this.geHeaderHeight();
    if (mask) {
      const { idx, rowIdx, groupRowIndex } = position;
      if (idx >= 0 && rowIdx >= 0) {
        const { columns, getRowTop, isGroupView = false, groupOffsetLeft = 0 } = this.props;
        const column = columns[idx];
        const frozen = !!column.frozen;
        if (frozen) {
          // use fixed
          let top = -scrollTop + getRowTop(isGroupView ? groupRowIndex : rowIdx) + headerHeight;
          let left = column.left;
          if (isGroupView) {
            top += 1;
            left += groupOffsetLeft;
          }
          mask.style.position = 'fixed';
          mask.style.top = top + 'px';
          mask.style.left = left + 'px';
          mask.style.transform = 'none';
        }
      }
    }
  };

  cancelSetScrollLeft = () => {
    if (this.selectionMask) {
      this.cancelSetMaskScrollLeft(this.selectionMask, this.state.selectedPosition);
    }
  };

  cancelSetMaskScrollLeft = (mask, position) => {
    const { left, top } = this.getSelectedDimensions(position);
    mask.style.position = 'absolute';
    mask.style.top = 0;
    mask.style.left = 0;
    mask.style.transform = `translate(${left}px, ${top}px)`;
  };

  getEditorPosition = () => {
    if (this.selectionMask) {
      const { editorPortalTarget } = this.props;
      const { left: selectionMaskLeft, top: selectionMaskTop } = this.selectionMask.getBoundingClientRect();
      if (editorPortalTarget === document.body) {
        const { scrollLeft, scrollTop } = document.scrollingElement || document.documentElement;
        return {
          left: selectionMaskLeft + scrollLeft,
          top: selectionMaskTop + scrollTop
        };
      }

      const { left: portalTargetLeft, top: portalTargetTop } = editorPortalTarget.getBoundingClientRect();
      const { scrollLeft, scrollTop } = editorPortalTarget;
      return {
        left: selectionMaskLeft - portalTargetLeft + scrollLeft,
        top: selectionMaskTop - portalTargetTop + scrollTop
      };
    }
  };

  onCommit = (updated, closeEditor = true) => {
    if (this.props.modifyRow) {
      this.props.modifyRow(updated);
    }
    if (closeEditor) {
      this.closeEditor();
    }
  };

  onCommitCancel = () => {
    this.closeEditor();
  };

  handleSpaceKeyDown = (e) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    const { selectedPosition } = this.state;
    const { isGroupView = false, rowGetterByIndex } = this.props;
    const row = getSelectedRow({ selectedPosition, isGroupView, rowGetterByIndex });
    if (this.props.handleSpaceKeyDown) {
      this.props.handleSpaceKeyDown(row);
    }
  };

  onKeyDown = (e) => {
    const keyCode = e.keyCode;
    if (isCtrlKeyHeldDown(e)) {
      this.onPressKeyWithCtrl(e);
    } else if (keyCode === KeyCodes.Escape) {
      this.onPressEscape(e);
    } else if (keyCode === KeyCodes.Tab) {
      this.onPressTab(e);
    } else if (this.isKeyboardNavigationEvent(e)) {
      this.changeCellFromEvent(e);
    } else if (isSpace(e)) {
      this.handleSpaceKeyDown(e);
    } else if (isKeyPrintable(keyCode) || keyCode === KeyCodes.Enter) {
      this.openEditor(e);
    } else if (keyCode === KeyCodes.Backspace || keyCode === KeyCodes.Delete) {
      const name = getEventClassName(e);
      if (name === 'rdg-selected') {
        e.preventDefault();
        this.handleSelectCellsDelete();
      }
    }
  };

  handleSelectCellsDelete = () => {
    const { isGroupView = false, rowGetterByIndex, columns } = this.props;
    const { selectedRange } = this.state;
    const { topLeft, bottomRight } = selectedRange;
    const rowsFromSelectedRange = getRowsFromSelectedRange({ selectedRange, isGroupView, rowGetterByIndex });
    const editableRows = rowsFromSelectedRange.filter(row => context.canModifyRow(row));
    if (editableRows.length === 0) return;

    const { idx: startColumnIdx } = topLeft;
    const { idx: endColumnIdx } = bottomRight;
    let editableColumns = [];

    // get editable columns from selected range
    for (let j = startColumnIdx; j <= endColumnIdx; j++) {
      const column = columns[j];
      if (!column || column.is_required || !column.editable || NOT_SUPPORT_EDIT_COLUMN_TYPE_MAP[column.type]) {
        continue;
      }
      editableColumns.push(column);
    }

    if (editableColumns.length === 0) return;

    let updateRowIds = [];
    let idRowUpdates = {}; // row's id to modified original rows data: { [row_id]: { [column.key: null] } }
    let idOldRowData = {}; // row's id to old original rows data: { [row_id]: { [column.key: xxx] } }
    editableRows.forEach(row => {
      const { _id } = row;
      let rowUpdates = {};
      let oldRowData = {};
      editableColumns.forEach(column => {
        const { key } = column;
        const cellVal = getCellValueByColumn(row, column);
        if (isValidCellValue(cellVal, column)) {
          oldRowData[key] = cellVal;
          rowUpdates[key] = null;
        }
      });

      if (Object.keys(rowUpdates).length > 0) {
        updateRowIds.push(_id);
        const update = getFormatRowData(editableColumns, rowUpdates);
        const oldRecordData = getFormatRowData(editableColumns, oldRowData);
        idRowUpdates[_id] = update;
        idOldRowData[_id] = oldRecordData;
      }
    });

    if (updateRowIds.length > 0) {
      this.props.modifyRows(updateRowIds, idRowUpdates, idOldRowData);
    }
  };

  onCopySelected = () => {
    this.onCopyCells();
  };

  onCopy = (e) => {
    e.preventDefault();
    const { rowMetrics } = this.props;

    // select the rows to copy
    const selectedRowIds = RowMetrics.getSelectedIds(rowMetrics);

    if (selectedRowIds.length > 0) {
      this.copyRows(e, selectedRowIds);
      return;
    }

    // window.getSelection() doesn't work on the content of <input> in FireFox, Edge and IE.
    // The selectionStart and selectionEnd properties could be used to work around this.
    let selectTxt = window.getSelection().toString();
    if (!selectTxt && e.target.value) {
      const { selectionStart, selectionEnd } = e.target;
      selectTxt = e.target.value.substring(selectionStart, selectionEnd);
    }
    if (selectTxt) {
      this.copyText(e, selectTxt);
      return;
    }

    // when activeElement is not cellMask, can't copy cell
    if (!this.isCellMaskActive()) {
      return;
    }
    this.onCopyCells(e);
  };

  onPaste = (e) => {
    // when activeElement is not cellMask or has no permission, can't paste cell
    if (!this.isCellMaskActive() || !this.canModifyRows) return;
    if (!isFunction(this.props.paste)) return;

    const { columns, isGroupView = false } = this.props;
    const { selectedPosition, selectedRange } = this.state;
    const { idx, rowIdx } = selectedPosition;
    if (idx === -1 || rowIdx === -1) return; // prevent paste when no cell selected
    const cliperData = getEventTransfer(e);
    if (!cliperData) return;

    const cliperDataType = cliperData.type;
    const copied = cliperData[TRANSFER_TYPES.METADATA_FRAGMENT];
    const copiedViewId = copied.copiedViewId;
    let copiedRowsCount = 0;
    let copiedColumnsCount = 0;
    if (cliperDataType === TRANSFER_TYPES.METADATA_FRAGMENT) {
      const { selectedRowIds, copiedRange } = copied;
      if (Array.isArray(selectedRowIds) && selectedRowIds.length > 0) {
        // copy from selected rows
        copiedRowsCount = selectedRowIds.length;
        copiedColumnsCount = columns.length;
      } else {
        // copy from selected range
        const { topLeft: copiedTopLeft, bottomRight: copiedBottomRight } = copiedRange;
        const { idx: startCopiedColumnIndex, rowIdx: startCopiedRowIndex } = copiedTopLeft;
        const { idx: endCopiedColumnIndex, rowIdx: endCopiedRowIndex } = copiedBottomRight;
        copiedRowsCount = endCopiedRowIndex - startCopiedRowIndex + 1;
        copiedColumnsCount = endCopiedColumnIndex - startCopiedColumnIndex + 1;
      }
    } else {
      const { copiedRows, copiedColumns } = copied;
      copiedRowsCount = copiedRows.length;
      copiedColumnsCount = copiedColumns.length;
    }
    const multiplePaste = this.isMultiplePaste(copiedRowsCount, copiedColumnsCount);
    this.props.paste({
      copied,
      multiplePaste,
      type: cliperDataType,
      pasteRange: selectedRange,
      columns,
      isGroupView,
      pasteSource: this.pasteSource,
      cutPosition: this.cutPosition,
      viewId: copiedViewId
    });
    if (!multiplePaste) {
      this.setPasteRange(copiedRowsCount, copiedColumnsCount);
    }
  };

  onCut = (event) => {
    // when activeElement is not cellMask or has no permission, can't paste cell
    if (!this.isCellMaskActive() || !this.canModifyRows) return;
    const { selectedPosition, selectedRange } = this.state;
    const { idx, rowIdx } = selectedPosition;
    if (idx === -1 || rowIdx === -1) return; // prevent paste when no cell selected
    event.preventDefault();
    const { tableId: copiedTableId, columns, isGroupView = false, rowGetterByIndex, getCopiedRowsAndColumnsFromRange,
      getClientCellValueDisplayString, collaborators, tagsData,
    } = this.props;
    if (rowIdx < 0 || idx < 0) return; // can not copy when no cell select
    const { search } = window.location;
    const urlParams = new URLSearchParams(search);
    const copiedViewId = urlParams.has('view') ? urlParams.get('view') : '';
    const { topLeft, bottomRight } = selectedRange;
    const copiedCellsCount = (bottomRight.rowIdx - topLeft.rowIdx + 1) * (bottomRight.idx - topLeft.idx + 1);
    const type = copiedCellsCount <= 0 ? 'text' : TRANSFER_TYPES.METADATA_FRAGMENT;
    const tip = copiedCellsCount > 1 ? gettext('%s cells cut').replace('%s', copiedCellsCount) : gettext('1 cell cut');
    toaster.success(tip);
    const copied = { copiedRange: selectedRange };
    const { copiedRows, copiedColumns } = getCopiedRowsAndColumnsFromRange({ type, copied, columns, isGroupView });
    setEventTransfer({
      type,
      event,
      copiedRange: { ...selectedRange },
      copiedRows,
      copiedColumns,
      copiedTableId,
      copiedViewId,
      tableData: {
        columns,
      },
      isGroupView,
      rowGetterByIndex,
      getClientCellValueDisplayString,
      collaborators,
      tagsData,
    });
    if (copiedCellsCount > 0) {
      this.pasteSource = PASTE_SOURCE.CUT;
      this.cutPosition = { ...selectedPosition };
    }
  };

  copyText = (event, copiedText) => {
    const type = 'text';
    setEventTransfer({
      type,
      event,
      copiedText,
    });
  };

  copyRows = (event, selectedRowIds) => {
    const { tableId: copiedTableId, columns, rowGetterById, isGroupView = false, getCopiedRowsAndColumnsFromRange,
      getClientCellValueDisplayString, collaborators, tagsData
    } = this.props;
    const copiedRowsCount = selectedRowIds.length;
    toaster.success(
      copiedRowsCount > 1 ? gettext('{count} rows are copied.').replace('{count}', copiedRowsCount) : gettext('1 row is copied.')
    );
    const type = TRANSFER_TYPES.METADATA_FRAGMENT;
    const copied = { selectedRowIds };
    const { copiedRows, copiedColumns } = getCopiedRowsAndColumnsFromRange({ type, copied, columns, isGroupView });
    setEventTransfer({
      type,
      event,
      selectedRowIds,
      copiedRows,
      copiedColumns,
      copiedTableId,
      tableData: {
        columns,
      },
      rowGetterById,
      getClientCellValueDisplayString,
      collaborators,
      tagsData,
    });
  };

  onCopyCells = (event) => {
    const { tableId: copiedTableId, columns, isGroupView = false, rowGetterByIndex, getCopiedRowsAndColumnsFromRange,
      getClientCellValueDisplayString, collaborators, tagsData } = this.props;
    const { selectedPosition, selectedRange } = this.state;
    const { rowIdx, idx } = selectedPosition;
    if (rowIdx < 0 || idx < 0) {
      return; // can not copy when no cell select
    }
    const { topLeft, bottomRight } = selectedRange;
    const type = TRANSFER_TYPES.METADATA_FRAGMENT;
    const copiedCellsCount = (bottomRight.rowIdx - topLeft.rowIdx + 1) * (bottomRight.idx - topLeft.idx + 1);
    toaster.success(
      copiedCellsCount > 1 ? gettext('%s cells copied').replace('%s', copiedCellsCount) : gettext('1 cell copied')
    );
    const copied = { copiedRange: selectedRange };
    const { copiedRows, copiedColumns } = getCopiedRowsAndColumnsFromRange({ type, copied, columns, isGroupView });
    setEventTransfer({
      type,
      event,
      copiedRange: { ...selectedRange },
      copiedRows,
      copiedColumns,
      copiedTableId,
      tableData: {
        columns,
      },
      isGroupView,
      rowGetterByIndex,
      getClientCellValueDisplayString,
      collaborators,
      tagsData,
    });
    this.cutPosition = null;
    this.pasteSource = PASTE_SOURCE.COPY;
  };

  isMultiplePaste = (copiedRowsCount, copiedColumnsCount) => {
    const { selectedRange } = this.state;
    const { topLeft, bottomRight } = selectedRange;
    const { idx: startColumnIndex, rowIdx: startRowIndex } = topLeft;
    const { idx: endColumnIndex, rowIdx: endRowIndex } = bottomRight;
    return Number.isInteger((endColumnIndex - startColumnIndex + 1) / copiedColumnsCount) && Number.isInteger((endRowIndex - startRowIndex + 1) / copiedRowsCount);
  };

  setPasteRange = (copiedRowsCount, copiedColumnsCount) => {
    const { rowsCount, columns } = this.props;
    const { selectedPosition, selectedRange } = this.state;
    const { topLeft } = selectedRange;
    const { idx, rowIdx } = topLeft;
    const columnsLen = columns.length;
    const groupRowIndex = selectedPosition.groupRowIndex;
    let nextColumnIndex = idx + copiedColumnsCount - 1;
    let nextRowIndex = rowIdx + copiedRowsCount - 1;
    if (nextColumnIndex >= columnsLen) {
      nextColumnIndex = columnsLen - 1;
    }
    if (nextRowIndex >= rowsCount) {
      nextRowIndex = rowsCount - 1;
    }
    const nextSelectedRange = {
      topLeft,
      startCell: selectedPosition,
      bottomRight: {
        idx: nextColumnIndex,
        rowIdx: nextRowIndex,
        groupRowIndex,
      },
      cursorCell: {
        idx: selectedPosition.idx,
        rowIdx: selectedPosition.rowIdx,
        groupRowIndex,
      }
    };
    this.setState({
      selectedRange: {
        ...selectedRange,
        ...nextSelectedRange
      }
    }, () => {
      this.focus();
    });
    return nextSelectedRange;
  };

  onPressKeyWithCtrl = () => {

  };

  onPressEscape = () => {

  };

  onPressTab = (e) => {
    this.changeCellFromEvent(e);
  };

  getLeftInterval = () => {
    const { isGroupView = false, columns, groupOffsetLeft = 0, frozenColumnsWidth } = this.props;
    const firstColumnFrozen = columns[0] ? columns[0].frozen : false;
    let leftInterval = 0;
    if (firstColumnFrozen) {
      leftInterval = groupOffsetLeft + frozenColumnsWidth;
      if (isGroupView) {
        leftInterval += groupOffsetLeft;
      }
    } else {
      leftInterval = 0;
    }
    return leftInterval;
  };

  handleVerticalArrowAction = (current, actionType) => {
    const { isGroupView = false, groupMetrics, rowHeight } = this.props;
    const step = actionType === 'ArrowDown' ? 1 : -1;
    if (isGroupView) {
      const groupRows = groupMetrics.groupRows || [];
      const groupRowsLen = groupRows.length;
      const { groupRowIndex: currentGroupRowIndex } = current;
      let nextGroupRowIndex = currentGroupRowIndex + step;
      let nextGroupRow;
      while (nextGroupRowIndex > 0 && nextGroupRowIndex < groupRowsLen) {
        nextGroupRow = getGroupRowByIndex(nextGroupRowIndex, groupMetrics);
        if (nextGroupRow.type === GROUP_ROW_TYPE.ROW) {
          break;
        }
        nextGroupRowIndex += step;
      }
      if (!nextGroupRow || nextGroupRow.type !== GROUP_ROW_TYPE.ROW) {
        return;
      }

      const currentScrollTop = this.props.getGroupCanvasScrollTop() || 0;
      const { rowIdx: nextRowIdx, top: nextRowTop } = nextGroupRow;
      let newScrollTop;

      // 32: footerHeight; 16: preview of next row.
      const HEADER_HEIGHT = 150;
      if (nextRowTop <= currentScrollTop + 16) {
        newScrollTop = nextRowTop - 16;
      } else if (nextRowTop + HEADER_HEIGHT - currentScrollTop >= window.innerHeight - 32 - 16) {
        newScrollTop = nextRowTop + HEADER_HEIGHT - window.innerHeight + 32 + rowHeight + 16;
      }
      if (newScrollTop !== undefined) {
        this.props.setGroupCanvasScrollTop(newScrollTop);
      }
      return { ...current, rowIdx: nextRowIdx, groupRowIndex: nextGroupRowIndex };
    } else {
      return { ...current, rowIdx: current.rowIdx + step };
    }
  };

  handleLeftArrowAction = (current) => {
    let cellContainer = this.selectionMask;
    if (!cellContainer) return;
    const { columns } = this.props;
    const rect = cellContainer.getBoundingClientRect();
    const leftInterval = this.getLeftInterval();
    const nextColumnWidth = columns[current.idx - 1] ? columns[current.idx - 1].width : 0;
    const { left: tableContentLeft, right } = this.props.getTableContentRect();
    const viewLeft = tableContentLeft + 130;

    // selectMask is outside the viewport, scroll to next column
    if (rect.x < 0 || rect.x > right) {
      this.props.scrollToColumn(current.idx - 1);
    } else if (nextColumnWidth > rect.x - leftInterval - viewLeft) {
      // selectMask is part of the viewport, newScrollLeft = columnWidth - visibleWidth
      const newScrollLeft = nextColumnWidth - (rect.x - leftInterval - viewLeft);
      this.props.setRowsScrollLeft(this.props.getScrollLeft() - newScrollLeft);
    }
    return ({ ...current, idx: current.idx === 0 ? 0 : current.idx - 1 });
  };

  handleRightArrowAction = (current) => {
    let cellContainer = this.selectionMask;
    if (!cellContainer) return;
    const { columns } = this.props;
    const rect = cellContainer.getBoundingClientRect();
    const columnIdx = current.idx;
    const column = columns[columnIdx];
    if (columnIdx === 1 && column.frozen === true) {
      this.props.scrollToColumn(1);
    } else {
      const { right: tableContentRight } = this.props.getTableContentRect();
      const nextColumnWidth = columns[columnIdx + 1] ? columns[columnIdx + 1].width : 0;
      // selectMask is outside the viewport, scroll to next column
      if (rect.x < 0 || rect.x > tableContentRight) {
        this.props.scrollToColumn(columnIdx + 1);
      } else if (rect.x + rect.width + nextColumnWidth > tableContentRight) {
        // selectMask is part of the viewport, newScrollLeft = columnWidth - visibleWidth
        const newScrollLeft = nextColumnWidth - (tableContentRight - rect.x - rect.width);
        this.props.setRowsScrollLeft(this.props.getScrollLeft() + newScrollLeft);
      }
    }
    return ({ ...current, idx: current.idx + 1 });
  };

  isKeyboardNavigationEvent(e) {
    return this.getKeyNavActionFromEvent(e) != null;
  }

  getKeyNavActionFromEvent = (e) => {
    const { getVisibleIndex, onHitBottomBoundary, onHitTopBoundary } = this.props;

    const { rowVisibleStartIdx, rowVisibleEndIdx } = getVisibleIndex();
    const isCellAtBottomBoundary = cell => cell.rowIdx >= rowVisibleEndIdx - 1;
    const isCellAtTopBoundary = cell => cell.rowIdx !== 0 && cell.rowIdx <= rowVisibleStartIdx;
    const keyNavActions = {
      ArrowDown: {
        getNext: (current) => {
          return this.handleVerticalArrowAction(current, 'ArrowDown');
        },
        isCellAtBoundary: isCellAtBottomBoundary,
        onHitBoundary: onHitBottomBoundary
      },
      ArrowUp: {
        getNext: (current) => {
          return this.handleVerticalArrowAction(current, 'ArrowUp');
        },
        isCellAtBoundary: isCellAtTopBoundary,
        onHitBoundary: onHitTopBoundary
      },
      ArrowRight: {
        getNext: (current) => {
          return this.handleRightArrowAction(current);
        },
        isCellAtBoundary: () => {
          return false;
        }
      },
      ArrowLeft: {
        getNext: (current) => {
          return this.handleLeftArrowAction(current);
        },
        isCellAtBoundary: () => {
          return false;
        }
      }
    };
    if (e.keyCode === KeyCodes.Tab) {
      return e.shiftKey === true ? keyNavActions.ArrowLeft : keyNavActions.ArrowRight;
    }
    return keyNavActions[e.key];
  };

  changeCellFromEvent = (e) => {
    e.preventDefault();
    if (e.keyCode === KeyCodes.ChineseInputMethod && this.state.isEditorEnabled) {
      return;
    }
    if (this.throttle) return;
    const currentPosition = this.state.selectedPosition;
    const keyNavAction = this.getKeyNavActionFromEvent(e);
    const next = keyNavAction.getNext(currentPosition);
    if (!next) return;
    this.checkIsAtGridBoundary(keyNavAction, next);
    this.props.onCellClick(next);
    this.onSelectCell({ ...next });
    this.throttle = true;
    setTimeout(() => {
      this.throttle = false;
    }, 30);
  };

  checkIsAtGridBoundary(keyNavAction, next) {
    const { isCellAtBoundary, onHitBoundary } = keyNavAction;
    if (isCellAtBoundary(next)) {
      onHitBoundary(next);
    }
  }

  onFocus = () => {

  };

  onScroll = (e) => {
    e.stopPropagation();
  };

  setSelectionMaskRef = (ref) => {
    this.selectionMask = ref;
  };

  setSelectionRangeMaskRef = (ref) => {
    this.selectedRangeMask = ref;
  };

  setContainerRef = (ref) => {
    this.container = ref;
  };

  isCellMaskActive = () => {
    const activeElement = document.activeElement;
    return (activeElement &&
      (activeElement.getAttribute('data-test') === 'cell-mask' ||
        activeElement.getAttribute('data-test') === 'active-editor')
    );
  };

  handleDragCopy = (draggedRange) => {
    const { columns, groupMetrics } = this.props;
    // compute the new rows
    const newRows = this.props.getUpdateDraggedRows(draggedRange, columns, groupMetrics);
    if (this.props.modifyRows) {
      this.props.modifyRows({ ...newRows, isCopyPaste: true });
    }
  };

  handleDragStart = (e) => {
    const { selectedRange: { topLeft, bottomRight, startCell, cursorCell } } = this.state;
    // To prevent dragging down/up when reordering rows. (TODO: is this required)
    const isViewportDragging = e && e.target && e.target.className;
    if (topLeft.idx > -1 && isViewportDragging) {
      try {
        e.dataTransfer.setData('text/plain', '');
      } catch (ex) {
        // IE only supports 'text' and 'URL' for the 'type' argument
        e.dataTransfer.setData('text', '');
      }
      this.setState({
        draggedRange: { topLeft, bottomRight, startCell, cursorCell }
      });
    }
  };

  handleDragEnter = ({ overRowIdx, overGroupRowIndex }) => {
    if (this.state.draggedRange != null) {
      this.setState(({ draggedRange }) => ({
        draggedRange: { ...draggedRange, overRowIdx, overGroupRowIndex }
      }));
    }
  };

  handleDragEnd = () => {
    const { draggedRange, selectedRange } = this.state;
    let newSelectedRange = deepCopy(selectedRange);
    if (draggedRange !== null) {
      const { overRowIdx, overGroupRowIndex, bottomRight } = draggedRange;
      if (overRowIdx !== null && bottomRight.rowIdx < overRowIdx) {
        this.handleDragCopy(draggedRange);
        newSelectedRange.bottomRight.rowIdx = overRowIdx;
        newSelectedRange.cursorCell.rowIdx = overRowIdx;
        newSelectedRange.bottomRight.groupRowIndex = overGroupRowIndex;
        newSelectedRange.cursorCell.groupRowIndex = overGroupRowIndex;
      }
      this.setState({ draggedRange: null, selectedRange: newSelectedRange });
    }
  };

  renderSingleCellSelectView = () => {
    const { isEditorEnabled, selectedPosition } = this.state;
    const isDragEnabled = this.checkIsSelectedCellEditable();
    const showDragHandle = (isDragEnabled && this.props.canModifyRows);
    if (isEditorEnabled) {
      return null;
    }
    if (!this.isGridSelected()) return null;

    const props = {
      innerRef: this.setSelectionMaskRef,
      selectedPosition,
      getSelectedDimensions: this.getSelectedDimensions,
    };
    return (
      <SelectionMask {...props}>
        {showDragHandle ? <DragHandler onDragStart={this.handleDragStart} onDragEnd={this.handleDragEnd} /> : null}
      </SelectionMask>
    );
  };

  renderCellRangeSelectView = () => {
    const { selectedRange } = this.state;
    const { columns, rowHeight } = this.props;
    const isDragEnabled = this.checkIsSelectedCellEditable();
    const showDragHandle = (isDragEnabled && this.props.canModifyRows);
    return [
      <SelectionRangeMask
        key="range-mask"
        innerRef={this.setSelectionRangeMaskRef}
        selectedRange={selectedRange}
        columns={columns}
        rowHeight={rowHeight}
        getSelectedRangeDimensions={this.getSelectedRangeDimensions}
      >
        {showDragHandle ? <DragHandler onDragStart={this.handleDragStart} onDragEnd={this.handleDragEnd} /> : null}
      </SelectionRangeMask>,
      <SelectionMask
        key="selection-mask"
        innerRef={this.setSelectionMaskRef}
        selectedPosition={selectedRange.startCell}
        getSelectedDimensions={this.getSelectedDimensions}
      />
    ];
  };

  render() {
    const { selectedRange, isEditorEnabled, draggedRange, selectedPosition, firstEditorKeyDown, openEditorMode, editorPosition, selectedOperation } = this.state;
    const { columns, isGroupView = false, rowGetterByIndex, scrollTop, getScrollLeft, editorPortalTarget, contextMenu, rowMetrics, table, tagsData } = this.props;
    const isSelectedSingleCell = selectedRangeIsSingleCell(selectedRange);
    return (
      <div
        className='interaction-mask'
        ref={this.setContainerRef}
        onKeyDown={this.onKeyDown}
        onFocus={this.onFocus}
        onScroll={this.onScroll}
      >
        {draggedRange && (
          <DragMask
            draggedRange={draggedRange}
            getSelectedDimensions={this.getSelectedDimensions}
            getSelectedRangeDimensions={this.getSelectedRangeDimensions}
          />
        )}
        {isSelectedSingleCell ? this.renderSingleCellSelectView() : this.renderCellRangeSelectView()}
        {isEditorEnabled && (
          <EditorPortal target={editorPortalTarget}>
            <EditorContainer
              columns={columns}
              tagsData={tagsData}
              scrollTop={scrollTop}
              firstEditorKeyDown={firstEditorKeyDown}
              openEditorMode={openEditorMode}
              portalTarget={editorPortalTarget}
              scrollLeft={getScrollLeft()}
              row={getSelectedRow({ selectedPosition, isGroupView, rowGetterByIndex })}
              column={getSelectedColumn({ selectedPosition, columns })}
              value={getSelectedCellValue({ selectedPosition, columns, isGroupView, rowGetterByIndex })}
              editorPosition={editorPosition}
              onCommit={this.onCommit}
              onCommitCancel={this.onCommitCancel}
              modifyColumnData={this.props.modifyColumnData}
              operation={selectedOperation}
              {...{
                ...this.getSelectedDimensions(selectedPosition),
                ...this.state.editorPosition
              }}
            />
          </EditorPortal>
        )}
        {isValidElement(contextMenu) && cloneElement(contextMenu, {
          selectedPosition: isSelectedSingleCell ? selectedPosition : null,
          selectedRange: !isSelectedSingleCell ? selectedRange : null,
          rowMetrics,
          table,
          onClearSelected: this.handleSelectCellsDelete,
          onCopySelected: this.onCopySelected,
        })}
      </div>
    );
  }
}

InteractionMasks.propTypes = {
  contextmenu: PropTypes.element,
  tableId: PropTypes.string,
  columns: PropTypes.array,
  canAddRow: PropTypes.bool,
  isGroupView: PropTypes.bool,
  rowsCount: PropTypes.number,
  rowMetrics: PropTypes.object,
  groups: PropTypes.array,
  groupMetrics: PropTypes.object,
  rowHeight: PropTypes.number,
  groupOffsetLeft: PropTypes.number,
  frozenColumnsWidth: PropTypes.number,
  showRowAsTree: PropTypes.bool,
  treeNodeKeyRowIdMap: PropTypes.object,
  enableCellSelect: PropTypes.bool,
  getRowTop: PropTypes.func,
  scrollTop: PropTypes.number,
  getScrollLeft: PropTypes.func,
  getTableContentRect: PropTypes.func,
  getMobileFloatIconStyle: PropTypes.func,
  onToggleMobileMoreOperations: PropTypes.func,
  onToggleInsertRowDialog: PropTypes.func,
  onCellRangeSelectionStarted: PropTypes.func,
  onCellRangeSelectionUpdated: PropTypes.func,
  onCellRangeSelectionCompleted: PropTypes.func,
  selectNone: PropTypes.func,
  checkCanModifyRow: PropTypes.func,
  editorPortalTarget: PropTypes.instanceOf(Element).isRequired,
  modifyRow: PropTypes.func,
  modifyColumnData: PropTypes.func,
  rowGetterByIndex: PropTypes.func,
  rowGetterById: PropTypes.func,
  modifyRows: PropTypes.func,
  deleteRowsLinks: PropTypes.func,
  paste: PropTypes.func,
  editMobileCell: PropTypes.func,
  getVisibleIndex: PropTypes.func,
  onHitBottomBoundary: PropTypes.func,
  onHitTopBoundary: PropTypes.func,
  onCellClick: PropTypes.func,
  scrollToColumn: PropTypes.func,
  setRowsScrollLeft: PropTypes.func,
  getGroupCanvasScrollTop: PropTypes.func,
  setGroupCanvasScrollTop: PropTypes.func,
  appPage: PropTypes.object,
  onFillingDragRows: PropTypes.func,
  onCellsDragged: PropTypes.func,
  getUpdateDraggedRows: PropTypes.func,
  getCopiedRowsAndColumnsFromRange: PropTypes.func,
  onCommit: PropTypes.func,
  getTableCanvasContainerRect: PropTypes.func,
  handleSpaceKeyDown: PropTypes.func,
};

export default InteractionMasks;
