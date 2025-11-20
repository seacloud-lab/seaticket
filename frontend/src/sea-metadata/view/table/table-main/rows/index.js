import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { HorizontalScrollbar } from '../../../../components/scrollbar';
import EmptyTip from '@/components/empty-tip';
import { isMobile } from '@/utils/utils';
import { isFunction } from '@/utils/type-detection';
import { isShiftKeyDown } from '@/utils/keyboard-utils';
import { addClassName, removeClassName, getEventClassName } from '@/utils/dom';
import { getColOverScanEndIdx, getColOverScanStartIdx } from '../../utils/grid';
import { getVisibleBoundaries } from '../../utils/viewport';
import Body from './body';
import GroupBody from './group-body';
import RowsHeader from '../rows-header';
import RowsFooter from '../rows-footer';
import ContextMenu from '../../../../components/context-menu';
import { recalculate } from '../../../../utils/column';
import RowMetrics from '../../utils/row-metrics';
import { isWindowsBrowser, isWebkitBrowser } from '../../../../utils';
import { SEQUENCE_COLUMN_WIDTH, CANVAS_RIGHT_INTERVAL, GROUP_ROW_TYPE, EVENT_BUS_TYPE } from '../../../../constants';
import context from '@/sea-metadata/context';

class Rows extends Component {

  constructor(props) {
    super(props);
    this.scrollTop = 0;
    this.isScrollByScrollbar = false;
    const scrollLeft = context.localStorage.getItem('scroll_left');
    this.scrollLeft = scrollLeft ? Number(scrollLeft) : 0;
    this.lastScrollLeft = this.scrollLeft;
    this.initPosition = { idx: -1, rowIdx: -1, groupRowIndex: -1 };
    const columnMetrics = this.createColumnMetrics(props);
    const { width: tableContentWidth } = props.getTableContentRect();
    const initHorizontalScrollState = this.getHorizontalScrollState({ gridWidth: tableContentWidth, columnMetrics, scrollLeft: 0 });
    this.state = {
      columnMetrics,
      rowMetrics: this.createRowMetrics(),
      lastRowIdxUiSelected: { groupRowIndex: -1, rowIndex: -1 },
      touchStartPosition: {},
      selectedRange: {
        topLeft: this.initPosition,
        bottomRight: this.initPosition,
      },
      selectedPosition: this.initPosition,
      ...initHorizontalScrollState,
    };
    this.isWindows = isWindowsBrowser();
    this.isWebkit = isWebkitBrowser();
    this.deletedRow = null;
  }

  componentDidMount() {
    document.addEventListener('copy', this.onCopyCells);
    document.addEventListener('paste', this.onPasteCells);
    document.addEventListener('cut', this.onCutCells);
    if (window.isMobile) {
      window.addEventListener('touchstart', this.onTouchStart);
      window.addEventListener('touchend', this.onTouchEnd);
    } else {
      document.addEventListener('mousedown', this.onMouseDown);
    }
    this.unsubscribeSelectNone = context.eventBus.subscribe(EVENT_BUS_TYPE.SELECT_NONE, this.selectNone);
    this.unsubscribeSelectCell = context.eventBus.subscribe(EVENT_BUS_TYPE.SELECT_CELL, this.selectCell);
    this.getScrollPosition();
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const { columns, getTableContentRect } = nextProps;
    const { width: tableContentWidth } = getTableContentRect();
    if (this.props.columns !== columns) {
      const columnMetrics = this.createColumnMetrics(nextProps);
      this.updateHorizontalScrollState({
        columnMetrics,
        scrollLeft: this.lastScrollLeft,
        gridWidth: tableContentWidth,
      });
      this.setState({ columnMetrics });
    } else if (this.props.getTableContentRect()?.width !== tableContentWidth) {
      this.updateHorizontalScrollState({
        columnMetrics: this.state.columnMetrics,
        scrollLeft: this.lastScrollLeft,
        gridWidth: tableContentWidth,
      });
    }

  }

  componentWillUnmount() {
    document.removeEventListener('copy', this.onCopyCells);
    document.removeEventListener('paste', this.onPasteCells);
    document.removeEventListener('cut', this.onCutCells);
    if (window.isMobile) {
      window.removeEventListener('touchstart', this.onTouchStart);
      window.removeEventListener('touchend', this.onTouchEnd);
    } else {
      document.removeEventListener('mousedown', this.onMouseDown);
    }

    this.clearSetAbsoluteTimer();
    this.unsubscribeSelectNone();
    this.unsubscribeSelectCell();
    this.setState = (state, callback) => {
      return;
    };
  }

  createColumnMetrics = (props) => {
    const { columns, table } = props;
    return recalculate(columns, table.columns);
  };

  createRowMetrics = (props = this.props) => {
    return {
      idSelectedRowMap: {},
    };
  };

  setScrollLeft = (scrollLeft) => {
    this.resultContainerRef.scrollLeft = scrollLeft;
  };

  modifyColumnWidth = (column, width) => {
    this.props.modifyColumnWidth(column.key, width);
  };

  getScrollPosition = () => {
    let scrollLeft = context.localStorage.getItem('scroll_left') + '';
    let scrollTop = context.localStorage.getItem('scroll_top') + '';
    if (scrollLeft && scrollTop) {
      if (this.bodyRef) {
        scrollLeft = Number(scrollLeft);
        scrollTop = Number(scrollTop);
        this.bodyRef.setScrollTop(scrollTop);
        this.setScrollLeft(scrollLeft);
        this.handleHorizontalScroll(scrollLeft, scrollTop);
      }
    }
  };

  storeScrollPosition = () => {
    const scrollTop = this.bodyRef.getScrollTop();
    const scrollLeft = this.getScrollLeft();
    context.localStorage.setItem('scroll_left', scrollLeft);
    this.storeScrollTop(scrollTop);
  };

  storeScrollTop = (scrollTop) => {
    context.localStorage.setItem('scroll_top', scrollTop);
  };

  onContentScroll = (e) => {
    const { scrollLeft } = e.target;
    const scrollTop = this.bodyRef.getScrollTop();
    const deltaX = this.scrollLeft - scrollLeft;
    const deltaY = this.scrollTop - scrollTop;
    this.scrollLeft = scrollLeft;
    if (deltaY !== 0) {
      this.scrollTop = scrollTop;
    }

    // table horizontal scroll, set first column freeze
    if (deltaY === 0 && (deltaX !== 0 || scrollLeft === 0)) {
      this.handleHorizontalScroll(scrollLeft, scrollTop);
    }
    this.storeScrollPosition();
    context.eventBus.dispatch(EVENT_BUS_TYPE.CLOSE_EDITOR);
  };

  handleHorizontalScroll = (scrollLeft, scrollTop) => {
    const { width: tableContentWidth } = this.props.getTableContentRect();
    if (isMobile) {
      this.updateHorizontalScrollState({
        scrollLeft,
        columnMetrics: this.state.columnMetrics,
        gridWidth: tableContentWidth,
      });
      return;
    }

    // update classnames after scroll
    const originClassName = this.resultContainerRef ? this.resultContainerRef.className : '';
    let newClassName;
    if (scrollLeft > 0) {
      newClassName = addClassName(originClassName, 'horizontal-scroll');
    } else {
      newClassName = removeClassName(originClassName, 'horizontal-scroll');
    }
    if (newClassName !== originClassName && this.resultContainerRef) {
      this.resultContainerRef.className = newClassName;
    }

    this.lastScrollLeft = scrollLeft;

    this.handleFrozenDOMsPosition(scrollLeft, scrollTop);

    this.rowsFooterRef.setSummaryScrollLeft(scrollLeft);
    if (!this.isScrollByScrollbar) {
      this.handleScrollbarScroll(scrollLeft);
    }
    if (this.bodyRef && this.bodyRef.interactionMask) {
      this.bodyRef.setScrollLeft(scrollLeft, scrollTop);
    }

    this.updateHorizontalScrollState({
      scrollLeft,
      columnMetrics: this.state.columnMetrics,
      gridWidth: tableContentWidth,
    });
  };

  handleFrozenDOMsPosition = (scrollLeft, scrollTop) => {
    const { lastFrozenColumnKey } = this.state.columnMetrics;
    if (this.props.isGroupView && !lastFrozenColumnKey) {
      return; // none-frozen columns under group view
    }

    this.clearSetAbsoluteTimer();
    this.setFixed(scrollLeft, scrollTop);
    this.timer = setTimeout(() => {
      this.setAbsolute(scrollLeft, scrollTop);
    }, 100);
  };

  handleScrollbarScroll = (scrollLeft) => {
    if (!this.horizontalScrollbar) return;
    if (!this.isScrollByScrollbar) {
      this.setHorizontalScrollbarScrollLeft(scrollLeft);
      return;
    }
    this.isScrollByScrollbar = false;
  };

  onHorizontalScrollbarScroll = (scrollLeft) => {
    this.isScrollByScrollbar = true;
    this.setScrollLeft(scrollLeft);
  };

  onHorizontalScrollbarMouseUp = () => {
    this.isScrollByScrollbar = false;
  };

  setHorizontalScrollbarScrollLeft = (scrollLeft) => {
    this.horizontalScrollbar && this.horizontalScrollbar.setScrollLeft(scrollLeft);
  };

  setFixed = (left, top) => {
    this.bodyRef.rowFrozenRefs.forEach(dom => {
      if (!dom) return;
      dom.frozenColumns.style.position = 'fixed';
      dom.frozenColumns.style.marginLeft = '0px';
      dom.frozenColumns.style.marginTop = '-' + top + 'px';
    });

    if (this.bodyRef.fixFrozenDoms) {
      this.bodyRef.fixFrozenDoms(left, top);
    }
  };

  setAbsolute = (left) => {
    const { isGroupView } = this.props;
    const { lastFrozenColumnKey } = this.state.columnMetrics;
    if (isGroupView && !lastFrozenColumnKey) {
      return;
    }

    this.bodyRef.rowFrozenRefs.forEach(dom => {
      if (!dom) return;
      dom.frozenColumns.style.position = 'absolute';
      dom.frozenColumns.style.marginLeft = left + 'px';
      dom.frozenColumns.style.marginTop = '0px';
    });

    if (this.bodyRef.cancelFixFrozenDOMs) {
      this.bodyRef.cancelFixFrozenDOMs(left);
    }

    if (this.bodyRef && this.bodyRef.interactionMask) {
      this.bodyRef.cancelSetScrollLeft();
    }
  };

  clearSetAbsoluteTimer = () => {
    if (!this.timer) {
      return;
    }
    clearTimeout(this.timer);
    this.timer = null;
  };

  getScrollLeft = () => {
    if (isMobile) {
      return 0;
    }
    return this.scrollLeft || 0;
  };

  getScrollTop = () => {
    if (isMobile) {
      return 0;
    }
    return this.scrollTop || 0;
  };

  setHorizontalScrollbarRef = (ref) => {
    this.horizontalScrollbar = ref;
  };

  setResultContainerRef = (ref) => {
    this.resultContainerRef = ref;
  };

  updateSelectedRange = (selectedRange) => {
    this.setState({ selectedRange });
  };

  onClickContainer = (e) => {
    let classNames = getEventClassName(e);
    if (classNames.includes('sea-metadata-table-content') || classNames.includes('sea-metadata-table-canvas')) {
      context.eventBus.dispatch(EVENT_BUS_TYPE.CLOSE_EDITOR);
    }
  };

  onCellClick = (cell) => {
    if (cell) {
      this.updateSelectedRange({
        topLeft: this.initPosition,
        bottomRight: this.initPosition,
      });
    }
    this.onDeselectAllRows();
  };

  onCellRangeSelectionUpdated = (selectedRange) => {
    this.onCellClick();
    this.updateSelectedRange(selectedRange);
  };

  onCopyCells = (e) => {
    context.eventBus.dispatch(EVENT_BUS_TYPE.COPY_CELLS, e);
  };

  onPasteCells = (e) => {
    context.eventBus.dispatch(EVENT_BUS_TYPE.PASTE_CELLS, e);
  };

  onCutCells = (e) => {
    context.eventBus.dispatch(EVENT_BUS_TYPE.CUT_CELLS, e);
  };

  onTouchStart = (e) => {
    const outsideDom = ['canvas', 'group-canvas'];
    if (e.target && outsideDom.includes(e.target.id)) {
      let touchStartPosition = {
        startX: e.changedTouches[0].clientX,
        startY: e.changedTouches[0].clientY,
      };
      this.setState({ touchStartPosition });
    }
  };

  onTouchEnd = (e) => {
    const outsideDom = ['canvas', 'group-canvas'];
    if (e.target && outsideDom.includes(e.target.id)) {
      let { clientX, clientY } = e.changedTouches[0];
      let { touchStartPosition } = this.state;
      if (Math.abs(touchStartPosition.startX - clientX) < 5 && Math.abs(touchStartPosition.startY - clientY) < 5) {
        context.eventBus.dispatch(EVENT_BUS_TYPE.SELECT_NONE);
      }
    }
  };

  onMouseDown = (e) => {
    const validClassName = getEventClassName(e);
    if (validClassName.indexOf('sea-metadata-table-cell') > -1) {
      return;
    }
    const outsideDom = ['canvas', 'group-canvas'];
    if (outsideDom.includes(e.target.id) || validClassName.includes('sea-metadata-table-content')) {
      context.eventBus.dispatch(EVENT_BUS_TYPE.SELECT_NONE);
    }
  };

  updateSelectedRowIds = (rowIds) => {
    if (!isFunction(this.props.updateSelectedRowIds)) return;
    this.props.updateSelectedRowIds(rowIds);
  };

  selectNone = () => {
    this.setState({
      selectedRange: {
        topLeft: this.initPosition,
        bottomRight: this.initPosition
      },
    });

    // clear selected rows
    this.onDeselectAllRows();
    this.updateSelectedRowIds([]);
  };

  selectCell = (cellPosition) => {
    this.setState({ selectedPosition: cellPosition });
  };

  onSelectRow = ({ groupRowIndex, rowIndex }, e) => {
    e.stopPropagation();
    if (isShiftKeyDown(e)) {
      this.selectRowWithShift({ groupRowIndex, rowIndex });
      return;
    }
    const { isGroupView } = this.props;
    const { rowMetrics } = this.state;
    const operateRow = this.props.rowGetterByIndex({ isGroupView, groupRowIndex, rowIndex });
    if (!operateRow) {
      return;
    }

    const operateRowId = operateRow._id;
    if (RowMetrics.isRowSelected(operateRowId, rowMetrics)) {
      this.deselectRow(operateRowId);
      this.setState({ lastRowIdxUiSelected: { groupRowIndex: -1, rowIndex: -1 } });
      return;
    }
    this.selectRow(operateRowId);
    this.setState({ lastRowIdxUiSelected: { groupRowIndex, rowIndex } });
  };

  selectRowWithShift = ({ groupRowIndex, rowIndex }) => {
    const { rowIds, isGroupView } = this.props;
    const { lastRowIdxUiSelected, rowMetrics } = this.state;
    let selectedRowIds = [];
    if (isGroupView) {
      if (!window.seaTableBody || !window.seaTableBody.getGroupMetrics) {
        return;
      }
      const groupMetrics = window.seaTableBody.getGroupMetrics();
      const { groupRows } = groupMetrics;
      const groupRowIndexes = [groupRowIndex, lastRowIdxUiSelected.groupRowIndex].sort((a, b) => a - b);
      for (let i = groupRowIndexes[0]; i <= groupRowIndexes[1]; i++) {
        const groupRow = groupRows[i];
        const { type } = groupRow;
        if (type !== GROUP_ROW_TYPE.ROW) {
          continue;
        }
        selectedRowIds.push(groupRow.rowId);
      }
    } else {
      const operateRowId = rowIds[rowIndex];
      if (!operateRowId) {
        return;
      }
      const lastSelectedRowIndex = lastRowIdxUiSelected.rowIndex;
      if (lastSelectedRowIndex < 0) {
        this.selectRow(operateRowId);
        this.setState({ lastRowIdxUiSelected: { groupRowIndex: -1, rowIndex } });
        return;
      }
      if (rowIndex === lastSelectedRowIndex || RowMetrics.isRowSelected(operateRowId, rowMetrics)) {
        this.deselectRow(operateRowId);
        this.setState({ lastRowIdxUiSelected: { groupRowIndex: -1, rowIndex: -1 } });
        return;
      }
      selectedRowIds = this.getRowIdsBetweenRange({ start: lastSelectedRowIndex, end: rowIndex });
    }

    if (selectedRowIds.length === 0) {
      return;
    }
    this.selectRowsById(selectedRowIds);
    this.setState({ lastRowIdxUiSelected: { groupRowIndex, rowIndex } });
  };

  getRowIdsBetweenRange = ({ start, end }) => {
    const { rowIds: propsRowIds } = this.props;
    const startIndex = Math.min(start, end);
    const endIndex = Math.max(start, end);
    let rowIds = [];
    for (let i = startIndex; i <= endIndex; i++) {
      const rowId = propsRowIds[i];
      if (rowId) {
        rowIds.push(rowId);
      }
    }
    return rowIds;
  };

  selectRow = (rowId) => {
    const { rowMetrics } = this.state;
    if (RowMetrics.isRowSelected(rowId, rowMetrics)) {
      return;
    }
    let updatedRowMetrics = { ...rowMetrics };
    RowMetrics.selectRow(rowId, updatedRowMetrics);
    this.setState({
      rowMetrics: updatedRowMetrics,
    }, () => {
      const ids = Object.keys(updatedRowMetrics.idSelectedRowMap);
      this.updateSelectedRowIds(ids);
    });
  };

  selectRowsById = (rowIds) => {
    const { rowMetrics } = this.state;
    const unSelectedRowIds = rowIds.filter(rowId => !RowMetrics.isRowSelected(rowId, rowMetrics));
    if (unSelectedRowIds.length === 0) {
      return;
    }
    let updatedRowMetrics = { ...rowMetrics };
    RowMetrics.selectRowsById(rowIds, updatedRowMetrics);
    this.setState({
      rowMetrics: updatedRowMetrics,
    }, () => {
      const ids = Object.keys(updatedRowMetrics.idSelectedRowMap);
      this.updateSelectedRowIds(ids);
    });
  };

  deselectRow = (rowId) => {
    const { rowMetrics } = this.state;
    if (!RowMetrics.isRowSelected(rowId, rowMetrics)) {
      return;
    }
    let updatedRowMetrics = { ...rowMetrics };
    RowMetrics.deselectRow(rowId, updatedRowMetrics);
    this.setState({
      rowMetrics: updatedRowMetrics,
    }, () => {
      const ids = Object.keys(updatedRowMetrics.idSelectedRowMap);
      this.updateSelectedRowIds(ids);
    });
  };

  selectAllRows = () => {
    const { rowIds, isGroupView } = this.props;
    const { rowMetrics } = this.state;
    let updatedRowMetrics = { ...rowMetrics };
    let selectedRowIds = [];
    if (isGroupView) {
      if (!window.seaTableBody || !window.seaTableBody.getGroupMetrics) {
        return;
      }
      const groupMetrics = window.seaTableBody.getGroupMetrics();
      const { groupRows } = groupMetrics;
      groupRows.forEach(groupRow => {
        const { type } = groupRow;
        if (type !== GROUP_ROW_TYPE.ROW) {
          return;
        }
        selectedRowIds.push(groupRow.rowId);
      });
    } else {
      selectedRowIds = rowIds;
    }
    RowMetrics.selectRowsById(selectedRowIds, updatedRowMetrics);
    this.setState({
      rowMetrics: updatedRowMetrics,
    }, () => {
      this.updateSelectedRowIds(selectedRowIds);
    });
  };

  onDeselectAllRows = () => {
    const { rowMetrics } = this.state;
    if (!RowMetrics.hasSelectedRows(rowMetrics)) {
      return;
    }
    let updatedRowMetrics = { ...rowMetrics };
    RowMetrics.deselectAllRows(updatedRowMetrics);
    this.setState({
      rowMetrics: updatedRowMetrics,
      lastRowIdxUiSelected: { groupRowIndex: -1, rowIndex: -1 },
    }, () => {
      this.updateSelectedRowIds([]);
    });
  };

  hasSelectedCell = ({ groupRowIndex, rowIndex }, selectedPosition) => {
    if (!selectedPosition) return false;
    const { isGroupView } = this.props;
    const { groupRowIndex: selectedGroupRowIndex, rowIdx: selectedRowIndex } = selectedPosition;
    if (isGroupView) {
      return groupRowIndex === selectedGroupRowIndex;
    }
    return rowIndex === selectedRowIndex;
  };

  hasSelectedRow = () => {
    const { rowMetrics } = this.state;
    if (!RowMetrics.hasSelectedRows(rowMetrics)) {
      return false;
    }
    const selectedRowIds = RowMetrics.getSelectedIds(rowMetrics);
    const selectedRows = selectedRowIds && selectedRowIds.map(id => this.props.rowGetterById(id)).filter(Boolean);
    return selectedRows && selectedRows.length > 0;
  };

  getHorizontalScrollState = ({ gridWidth, columnMetrics, scrollLeft }) => {
    const { columns } = columnMetrics;
    const columnsLength = columns.length;
    const { colVisibleStartIdx, colVisibleEndIdx } = getVisibleBoundaries(columns, scrollLeft, gridWidth);
    const colOverScanStartIdx = getColOverScanStartIdx(colVisibleStartIdx);
    const colOverScanEndIdx = getColOverScanEndIdx(colVisibleEndIdx, columnsLength);
    return {
      colOverScanStartIdx,
      colOverScanEndIdx,
    };
  };

  updateHorizontalScrollState = ({ columnMetrics, gridWidth, scrollLeft }) => {
    const scrollState = this.getHorizontalScrollState({ columnMetrics, gridWidth, scrollLeft });
    this.setState(scrollState);
  };

  isOutSelectedRange = ({ rowIndex, idx }) => {
    const { selectedRange } = this.state;
    const { topLeft, bottomRight } = selectedRange;
    const { idx: minIdx, rowIdx: minRowIdx } = topLeft;
    const { idx: maxIdx, rowIdx: maxRowIdx } = bottomRight;
    return idx < minIdx || idx > maxIdx || rowIndex < minRowIdx || rowIndex > maxRowIdx;
  };

  onCellContextMenu = (cell) => {
    const { rowIdx: rowIndex, idx, groupRowIndex } = cell;
    const { isGroupView, rowGetterByIndex } = this.props;
    const row = rowGetterByIndex({ isGroupView, groupRowIndex, rowIndex });

    if (!row) return;
    const { rowMetrics } = this.state;
    const rowId = row._id;
    if (!RowMetrics.isRowSelected(rowId, rowMetrics)) {
      this.setState({ rowMetrics: this.createRowMetrics() }, () => {
        this.updateSelectedRowIds([]);
      });
    }

    // select cell when click out of selectRange
    if (this.isOutSelectedRange({ rowIndex, idx })) {
      context.eventBus.dispatch(EVENT_BUS_TYPE.SELECT_CELL, cell, false);
    }
  };

  getTableCanvasContainerRect = () => {
    return this.resultContainerRef?.getBoundingClientRect() || { top: 0, left: 0 };
  };

  renderRowsBody = ({ containerWidth }) => {
    const { isGroupView } = this.props;
    const { rowMetrics, columnMetrics, colOverScanStartIdx, colOverScanEndIdx } = this.state;
    const { columns, allColumns, totalWidth, lastFrozenColumnKey, frozenColumnsWidth } = columnMetrics;
    const commonProps = {
      ...this.props,
      columns, allColumns, totalWidth, lastFrozenColumnKey, frozenColumnsWidth,
      rowMetrics, colOverScanStartIdx, colOverScanEndIdx,
      contextMenu: (
        <ContextMenu
          isGroupView={isGroupView}
          rowGetterByIndex={this.props.rowGetterByIndex}
          deleteRows={this.props.deleteRows}
          selectNone={this.selectNone}
          target={this.resultContainerRef}
          createContextMenuOptions={this.props.createContextMenuOptions}
          updateLocalRow={this.props.updateLocalRow}
        />
      ),
      hasSelectedRow: this.hasSelectedRow(),
      getScrollLeft: this.getScrollLeft,
      getScrollTop: this.getScrollTop,
      selectNone: this.selectNone,
      onCellClick: this.onCellClick,
      onCellRangeSelectionUpdated: this.onCellRangeSelectionUpdated,
      onSelectRow: this.onSelectRow,
      setRowsScrollLeft: this.setScrollLeft,
      hasSelectedCell: this.hasSelectedCell,
      cacheScrollTop: this.storeScrollTop,
      onCellContextMenu: this.onCellContextMenu,
      getTableCanvasContainerRect: this.getTableCanvasContainerRect,
    };
    if (this.props.isGroupView) {
      return (
        <GroupBody
          onRef={ref => this.bodyRef = ref}
          {...commonProps}
          containerWidth={containerWidth}
          groups={this.props.groups}
          groupbys={this.props.groupbys}
          groupOffsetLeft={this.props.groupOffsetLeft}
        />
      );
    }
    return (
      <Body
        onRef={ref => this.bodyRef = ref}
        {...commonProps}
        rowIds={this.props.rowIds}
      />
    );
  };

  render() {
    const {
      rowIds, rowsCount, table, isGroupView, groupOffsetLeft, renameColumn, modifyColumnData,
      deleteColumn, modifyColumnOrder, insertColumn
    } = this.props;
    const { rowMetrics, columnMetrics, selectedRange, colOverScanStartIdx, colOverScanEndIdx } = this.state;
    const { columns, totalWidth, lastFrozenColumnKey } = columnMetrics;
    const containerWidth = totalWidth + SEQUENCE_COLUMN_WIDTH + CANVAS_RIGHT_INTERVAL + groupOffsetLeft;
    const hasSelectedRow = this.hasSelectedRow();
    const isSelectedAll = RowMetrics.isSelectedAll(rowIds, rowMetrics);

    if (rowsCount === 0 && !this.props.hasMore) {
      return (<EmptyTip text={context.translate('No {rows}')} />);
    }

    return (
      <>
        <div
          className={`sea-metadata-table-container ${this.isWindows ? 'windows-browser' : ''}`}
          ref={this.setResultContainerRef}
          onScroll={this.onContentScroll}
          onClick={this.onClickContainer}
        >
          <div className="sea-metadata-table-content" style={{ width: containerWidth }}>
            <RowsHeader
              onRef={(ref) => this.headerFrozenRef = ref}
              containerWidth={containerWidth}
              table={table}
              isShowRowExpandBtn={this.props.isShowRowExpandBtn}
              columnMetrics={columnMetrics}
              colOverScanStartIdx={colOverScanStartIdx}
              colOverScanEndIdx={colOverScanEndIdx}
              hasSelectedRow={hasSelectedRow}
              isSelectedAll={isSelectedAll}
              isGroupView={isGroupView}
              groupOffsetLeft={groupOffsetLeft}
              lastFrozenColumnKey={lastFrozenColumnKey}
              modifyColumnWidth={this.modifyColumnWidth}
              selectNoneRows={this.selectNone}
              selectAllRows={this.selectAllRows}
              renameColumn={renameColumn}
              deleteColumn={deleteColumn}
              insertColumn={insertColumn}
              modifyColumnData={modifyColumnData}
              modifyColumnOrder={modifyColumnOrder}
            />
            {this.renderRowsBody({ containerWidth })}
          </div>
        </div>
        {this.isWindows && this.isWebkit && (
          <HorizontalScrollbar
            ref={this.setHorizontalScrollbarRef}
            innerWidth={totalWidth + CANVAS_RIGHT_INTERVAL + SEQUENCE_COLUMN_WIDTH}
            onScrollbarScroll={this.onHorizontalScrollbarScroll}
            onScrollbarMouseUp={this.onHorizontalScrollbarMouseUp}
          />
        )}
        <RowsFooter
          ref={ref => this.rowsFooterRef = ref}
          rowsCount={rowsCount}
          hasMore={this.props.hasMore}
          columns={columns}
          groupOffsetLeft={groupOffsetLeft}
          rowMetrics={rowMetrics}
          selectedRange={selectedRange}
          isGroupView={isGroupView}
          hasSelectedRow={hasSelectedRow}
          isLoadingMore={this.props.isLoadingMore}
          rowGetterById={this.props.rowGetterById}
          rowGetterByIndex={this.props.rowGetterByIndex}
          getRowsSummaries={() => { }}
          loadMore={this.props.loadMore}
        />
      </>
    );
  }
}

Rows.propTypes = {
  isGroupView: PropTypes.bool,
  columns: PropTypes.array,
  table: PropTypes.object,
  hasMore: PropTypes.bool,
  isLoadingMore: PropTypes.bool,
  groupOffsetLeft: PropTypes.number,
  rowHeight: PropTypes.string,
  gridUtils: PropTypes.object,
  rowIds: PropTypes.array,
  rowsCount: PropTypes.number,
  groups: PropTypes.array,
  groupbys: PropTypes.array,
  searchResult: PropTypes.object,
  getTableContentRect: PropTypes.func,
  loadMore: PropTypes.func,
  updateRow: PropTypes.func,
  rowGetterById: PropTypes.func,
  rowGetterByIndex: PropTypes.func,
  renameColumn: PropTypes.func,
  deleteColumn: PropTypes.func,
  insertColumn: PropTypes.func,
  modifyColumnData: PropTypes.func,
  modifyColumnWidth: PropTypes.func,
  modifyColumnOrder: PropTypes.func,
  getCopiedRowsAndColumnsFromRange: PropTypes.func,
};

export default Rows;
