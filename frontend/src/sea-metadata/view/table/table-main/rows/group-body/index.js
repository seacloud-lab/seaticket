import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { RightScrollbar } from '../../../../../components/scrollbar';
import InteractionMasks from '../../../masks/interaction-masks';
import GroupContainer from './group-container';
import Row from '../row';
import { checkIsColumnFrozen, checkIsNameColumn, isColumnSupportDirectEdit, checkIsColumnEditable } from '../../../../../utils/column';
import { isShiftKeyDown } from '@/utils/keyboard-utils';
import { CellType, GROUP_HEADER_HEIGHT, GROUP_ROW_TYPE, GROUP_VIEW_OFFSET, SEQUENCE_COLUMN_WIDTH, EVENT_BUS_TYPE, ROW_HEIGHT_MAP } from '../../../../../constants';
import RowMetrics from '../../../utils/row-metrics';
import { isSelectedCellSupportOpenEditor } from '../../../utils/selected-cell-utils';
import { getColumnScrollPosition, getColVisibleEndIdx, getColVisibleStartIdx } from '../../../utils/rows-body-utils';
import { addClassName, removeClassName } from '../../../../../../utils/dom';
import { createGroupMetrics, getGroupRowByIndex, isNestedGroupRow } from '../../../utils/group-metrics';
import context from '@/sea-metadata/context';

const GROUP_OVER_SCAN_ROWS = 10;
const MAX_ANIMATION_ROWS = 50;
const LOCAL_FOLDED_GROUP_KEY = 'path_folded_group';
const { max, min } = Math;

class GroupBody extends Component {

  constructor(props) {
    super(props);
    const { groups, groupbys, allColumns } = props;
    const rowHeight = this.getRowHeight();
    const pathFoldedGroupMap = this.getFoldedGroups();
    const groupMetrics = createGroupMetrics(groups, groupbys, pathFoldedGroupMap, allColumns, rowHeight, false);
    const { startRenderIndex, endRenderIndex } = this.getGroupVisibleBoundaries(window.innerHeight, 0, groupMetrics, rowHeight);
    this.state = {
      activeRows: [],
      groupMetrics,
      startRenderIndex,
      endRenderIndex,
      pathFoldedGroupMap,
      isScrollingRightScrollbar: false,
      selectedPosition: null,
    };
    this.groupsNode = {};
    this.rowFrozenRefs = [];
    this.rowVisibleStart = startRenderIndex;
    this.rowVisibleEnd = endRenderIndex;
    this.columnVisibleStart = 0;
    this.columnVisibleEnd = this.setColumnVisibleEnd();
    this.disabledAnimation = false;
    this.nextPathFoldedGroupMap = null;
  }

  componentDidMount() {
    window.seaMetadataBody = this;
    window.addEventListener('resize', this.onResize);
    this.props.onRef(this);
    this.unSubscribeCollapseAllGroups = context.eventBus.subscribe(EVENT_BUS_TYPE.COLLAPSE_ALL_GROUPS, this.collapseAllGroups);
    this.unSubscribeExpandAllGroups = context.eventBus.subscribe(EVENT_BUS_TYPE.EXPAND_ALL_GROUPS, this.expandAllGroups);
    this.unsubscribeFocus = context.eventBus.subscribe(EVENT_BUS_TYPE.FOCUS_CANVAS, this.onFocus);
  }

  componentDidUpdate(prevProps) {
    const { groupbys, groups, allColumns, searchResult } = this.props;
    const { scrollTop } = this.resultContentRef;
    const rowHeight = this.getRowHeight();
    if (
      groupbys !== prevProps.groupbys ||
      groups !== prevProps.groups ||
      searchResult !== prevProps.searchResult
    ) {
      const gridHeight = window.innerHeight;
      const { matchedCells } = searchResult || {};
      const pathFoldedGroupMap = Array.isArray(matchedCells) && matchedCells.length > 0 ? {} : this.getFoldedGroups();
      const groupMetrics = createGroupMetrics(groups, groupbys, pathFoldedGroupMap, allColumns, rowHeight, false);
      this.updateScroll({ gridHeight, scrollTop, groupMetrics, rowHeight });
    }
    if (this.disabledAnimation) {
      this.ableRowsAnimation();
    }
    if (this.expandingGroupPathString) {
      const groupMetrics = createGroupMetrics(groups, groupbys, this.nextPathFoldedGroupMap, allColumns, rowHeight, false);
      this.updateScroll({ scrollTop, groupMetrics, pathFoldedGroupMap: this.nextPathFoldedGroupMap });
      this.expandingGroupPathString = null;
      this.nextPathFoldedGroupMap = null;
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.onResize);
    this.unSubscribeCollapseAllGroups();
    this.unSubscribeExpandAllGroups();
    this.unsubscribeFocus();

    this.clearHorizontalScroll();
    this.clearScrollbarTimer();
    this.setState = (state, callback) => {
      return;
    };
  }

  onFocus = () => {
    if (this.interactionMask.container) {
      this.interactionMask.focus();
      return;
    }
    this.resultContentRef.focus();
  };

  getShownRows = () => {
    const { startRenderIndex, endRenderIndex, groupMetrics } = this.state;
    const visibleGroupRows = this.getVisibleGroupRows(startRenderIndex, endRenderIndex, groupMetrics.groupRows);
    return visibleGroupRows.map(groupRow => this.props.rowGetterById(groupRow.rowId)).filter(row => !!row);
  };

  getGroupVisibleBoundaries = (gridHeight, scrollTop, groupMetrics, rowHeight) => {
    const { groupRows, groupRowsHeight, maxLevel } = groupMetrics;
    if (!Array.isArray(groupRows) || groupRows.length === 0) {
      return { startRenderIndex: 0, endRenderIndex: 0 };
    }
    let startRenderIndex = 0;
    let endRenderIndex = 0;
    const GROUP_TOP_OFFSET = GROUP_HEADER_HEIGHT * maxLevel + GROUP_OVER_SCAN_ROWS * rowHeight;
    const GROUP_BOTTOM_OFFSET = GROUP_HEADER_HEIGHT * maxLevel + GROUP_OVER_SCAN_ROWS * rowHeight;
    const overScanStartTop = max(0, scrollTop - GROUP_TOP_OFFSET);
    const overScanEndTop = min(groupRowsHeight, scrollTop + gridHeight + GROUP_BOTTOM_OFFSET);
    const groupRowsLen = groupRows.length;
    for (let i = 0; i < groupRowsLen; i++) {
      const groupRow = groupRows[i];
      const { top } = groupRow;
      if (top <= overScanStartTop) {
        startRenderIndex++;
      }
      if (top <= overScanEndTop) {
        endRenderIndex++;
      }
    }
    return { startRenderIndex, endRenderIndex };
  };

  setGroupNode = (groupPathString) => node => {
    this.groupsNode[groupPathString] = node;
  };

  setResultContentRef = (ref) => {
    this.resultContentRef = ref;
  };

  setInteractionMaskRef = (ref) => {
    this.interactionMask = ref;
  };

  setResultRef = (ref) => {
    this.resultRef = ref;
  };

  setScrollTop = (scrollTop) => {
    this.resultContentRef.scrollTop = scrollTop;
  };

  setScrollLeft = (scrollLeft, scrollTop) => {
    this.interactionMask && this.interactionMask.setScrollLeft(scrollLeft, scrollTop);
  };

  cancelSetScrollLeft = () => {
    this.interactionMask && this.interactionMask.cancelSetScrollLeft();
  };

  setRightScrollbar = (ref) => {
    this.rightScrollbar = ref;
  };

  getCanvasClientHeight = () => {
    return (this.resultContentRef && this.resultContentRef.clientHeight) || 0;
  };

  getRecordsWrapperScrollHeight = () => {
    return (this.resultRef && this.resultRef.scrollHeight) || 0;
  };

  setColumnVisibleEnd = () => {
    const { columns, getScrollLeft, getTableContentRect } = this.props;
    const { width: tableContentWidth } = getTableContentRect();
    let columnVisibleEnd = 0;
    const contentScrollLeft = getScrollLeft();
    let endColumnWidth = tableContentWidth + contentScrollLeft;
    for (let i = 0; i < columns.length; i++) {
      const { width } = columns[i];
      endColumnWidth = endColumnWidth - width;
      if (endColumnWidth < 0) {
        return columnVisibleEnd = i;
      }
    }
    return columnVisibleEnd;
  };

  getScrollTop = () => {
    return this.resultContentRef ? this.resultContentRef.scrollTop : 0;
  };

  getRowHeight = () => {
    return ROW_HEIGHT_MAP[this.props.rowHeight] + 1;
  };

  getRowTop = (groupRowIndex) => {
    const { groupMetrics } = this.state;
    const groupRow = getGroupRowByIndex(groupRowIndex, groupMetrics);
    if (!groupRow) return 0;
    return groupRow.top || 0;
  };

  jumpToRow = (scrollToGroupRowIndex) => {
    const { groupMetrics } = this.state;
    const height = this.resultContentRef.offsetHeight;
    const groupRowTop = this.getRowTop(scrollToGroupRowIndex);
    const scrollTop = Math.min(groupRowTop, groupMetrics.groupRowsHeight - height);
    this.setScrollTop(scrollTop);
  };

  scrollToColumn = (idx) => {
    const { columns, getTableContentRect } = this.props;
    const { width: tableContentWidth } = getTableContentRect();
    const newScrollLeft = getColumnScrollPosition(columns, idx, tableContentWidth);
    if (newScrollLeft !== null) {
      this.props.setRowsScrollLeft(newScrollLeft);
    }
    this.updateColVisibleIndex(newScrollLeft);
  };

  updateColVisibleIndex = (scrollLeft) => {
    const { columns } = this.props;
    const columnVisibleStart = getColVisibleStartIdx(columns, scrollLeft);
    const columnVisibleEnd = getColVisibleEndIdx(columns, window.innerWidth, scrollLeft);
    this.columnVisibleStart = columnVisibleStart;
    this.columnVisibleEnd = columnVisibleEnd;
  };

  getRowBodyHeight = () => {
    return this.resultContentRef ? this.resultContentRef.offsetHeight : 0;
  };

  /**
   * When updating the selection by moving the mouse, you need to automatically scroll to expand the visible area
   * @param {object} selectedRange
   */
  updateViewableArea = (selectedRange) => {
    const { mousePosition } = selectedRange.cursorCell;
    const { x: mouseX, y: mouseY } = mousePosition;
    const tableHeaderHeight = 50 + 48 + 32;
    const interval = 100;
    const step = 8;

    // cursor is at right boundary
    if (mouseX + interval > window.innerWidth) {
      this.scrollToRight();
    } else if (mouseX - interval < SEQUENCE_COLUMN_WIDTH + this.props.frozenColumnsWidth) {
      // cursor is at left boundary
      this.scrollToLeft();
    } else if (mouseY + interval > window.innerHeight - tableHeaderHeight) {
      // cursor is at bottom boundary
      const scrollTop = this.getScrollTop();
      this.resultContentRef.scrollTop = scrollTop + step;
      this.clearHorizontalScroll();
    } else if (mouseY - interval < tableHeaderHeight) {
      // cursor is at top boundary
      const scrollTop = this.getScrollTop();
      if (scrollTop - 16 >= 0) {
        this.resultContentRef.scrollTop = scrollTop - step;
      }
      this.clearHorizontalScroll();
    } else {
      // cursor is at middle area
      this.clearHorizontalScroll();
    }
  };

  scrollToRight = () => {
    if (this.scrollTimer) return;
    this.scrollTimer = setInterval(() => {
      const scrollLeft = this.props.getScrollLeft();
      this.props.setRowsScrollLeft(scrollLeft + 20);
    }, 10);
  };

  scrollToLeft = () => {
    if (this.scrollTimer) return;
    this.scrollTimer = setInterval(() => {
      const scrollLeft = this.props.getScrollLeft();
      if (scrollLeft <= 0) {
        this.clearHorizontalScroll();
        return;
      }
      this.props.setRowsScrollLeft(scrollLeft - 20);
    }, 10);
  };

  clearHorizontalScroll = () => {
    if (!this.scrollTimer) return;
    clearInterval(this.scrollTimer);
    this.scrollTimer = null;
  };

  clearScrollbarTimer = () => {
    if (!this.scrollbarTimer) return;
    clearTimeout(this.scrollbarTimer);
    this.scrollbarTimer = null;
  };

  getCellMetaData = () => {
    if (this.cellMetaData) {
      return this.cellMetaData;
    }
    this.cellMetaData = {
      onCellClick: this.onCellClick,
      onCellDoubleClick: this.onCellDoubleClick,
      onCellMouseDown: this.onCellMouseDown,
      onCellMouseEnter: this.onCellMouseEnter,
      onCellMouseMove: this.onCellMouseMove,
      onDragEnter: this.handleDragEnter,
      modifyRow: this.props.modifyRow,
      onCellContextMenu: this.onCellContextMenu,
    };
    return this.cellMetaData;
  };

  handleDragEnter = ({ overRowIdx, overGroupRowIndex }) => {
    context.eventBus.dispatch(EVENT_BUS_TYPE.DRAG_ENTER, { overRowIdx, overGroupRowIndex });
  };

  getGroupMetrics = () => {
    return this.state.groupMetrics;
  };

  getGroupRowByIndex = (groupRowIndex) => {
    const groupMetrics = this.getGroupMetrics();
    return getGroupRowByIndex(groupRowIndex, groupMetrics);
  };

  fixFrozenDoms = (scrollLeft, scrollTop) => {
    if (!checkIsColumnFrozen(this.props.columns[0]) && scrollLeft === 0) {
      return;
    }
    Object.keys(this.groupsNode).forEach((groupIdx) => {
      const groupNode = this.groupsNode[groupIdx];
      if (!groupNode) {
        return;
      }
      groupNode.fixedFrozenDOMs(scrollLeft, scrollTop);
    });
  };

  cancelFixFrozenDOMs = (scrollLeft) => {
    if (!checkIsColumnFrozen(this.props.columns[0]) && scrollLeft === 0) {
      return;
    }
    if (this.groupsNode) {
      Object.keys(this.groupsNode).forEach((groupPathString) => {
        const groupNode = this.groupsNode[groupPathString];
        if (!groupNode) {
          return;
        }
        groupNode.cancelFixFrozenDOMs(scrollLeft);
      });
    }
  };

  onResize = () => {
    const gridHeight = window.innerHeight;
    if (!gridHeight) {
      return;
    }
    const { scrollTop } = this.resultContentRef;
    const rowHeight = this.getRowHeight();
    this.updateScroll({ gridHeight, scrollTop, rowHeight });
  };

  onScroll = () => {
    const { offsetHeight, scrollTop: contentScrollTop } = this.resultContentRef;
    this.oldScrollTop = contentScrollTop;

    this.props.cacheScrollTop(contentScrollTop);

    this.updateScroll({ scrollTop: contentScrollTop });

    // Scroll to the bottom of the page, load more rows
    if (offsetHeight + contentScrollTop >= this.resultContentRef.scrollHeight) {
      this.props.loadMore();
    }

    if (!this.isScrollingRightScrollbar) {
      this.setRightScrollbarScrollTop(this.oldScrollTop);
    }

    // solve the bug that the scroll bar disappears when scrolling too fast
    this.clearScrollbarTimer();
    this.scrollbarTimer = setTimeout(() => {
      this.setState({ isScrollingRightScrollbar: false });
    }, 300);
  };

  setRightScrollbarScrollTop = (scrollTop) => {
    this.rightScrollbar && this.rightScrollbar.setScrollTop(scrollTop);
  };

  onScrollbarScroll = (scrollTop) => {
    // solve canvas&rightScrollbar circle scroll problem
    if (this.oldScrollTop === scrollTop) {
      return;
    }
    this.setState({ isScrollingRightScrollbar: true }, () => {
      this.setScrollTop(scrollTop);
    });
  };

  onScrollbarMouseUp = () => {
    this.setState({ isScrollingRightScrollbar: false });
  };

  onCellClick = (cell, e) => {
    const { selectedPosition } = this.state;
    if (isShiftKeyDown(e)) {
      if (!selectedPosition || selectedPosition.idx === -1) {
        this.selectCell(cell, false);
        return;
      }
      const isFromKeyboard = true;
      this.selectUpdate(cell, isFromKeyboard);
    } else {
      const { columns } = this.props;
      const column = columns[cell.idx];
      const supportOpenEditor = isColumnSupportDirectEdit(column);
      const hasOpenPermission = isSelectedCellSupportOpenEditor(cell, columns, true, this.props.rowGetterByIndex);
      this.selectCell(cell, supportOpenEditor && hasOpenPermission);
    }
    this.props.onCellClick(cell);
    this.setState({ selectedPosition: cell });
  };

  onCellDoubleClick = (cell, e) => {
    const { columns } = this.props;
    const column = columns[cell.idx];
    const supportOpenEditor = checkIsColumnEditable(column);
    const hasOpenPermission = isSelectedCellSupportOpenEditor(cell, columns, true, this.props.rowGetterByIndex);
    this.selectCell(cell, supportOpenEditor && hasOpenPermission);
  };

  onCellMouseDown = (cellPosition, event) => {
    if (!isShiftKeyDown(event)) {
      this.selectCell(cellPosition);
      this.selectStart(cellPosition);
      window.addEventListener('mouseup', this.onWindowMouseUp);
    }
  };

  // onRangeSelectUpdate
  onCellMouseEnter = (cellPosition) => {
    this.selectUpdate(cellPosition, false, this.updateViewableArea);
  };

  onCellMouseMove = (cellPosition) => {
    this.selectUpdate(cellPosition, false, this.updateViewableArea);
  };

  onCellContextMenu = (cellPosition) => {
    this.setState({ selectedPosition: cellPosition });
    this.props.onCellContextMenu(cellPosition);
  };

  onWindowMouseUp = (event) => {
    window.removeEventListener('mouseup', this.onWindowMouseUp);
    if (isShiftKeyDown(event)) return;
    this.selectEnd();
    this.clearHorizontalScroll();
  };

  onCellRangeSelectionUpdated = (selectedRange) => {
    this.props.onCellRangeSelectionUpdated(selectedRange);
  };

  selectNoneCells = () => {
    this.interactionMask && this.interactionMask.selectNone();
    const { selectedPosition } = this.state;
    if (!selectedPosition || selectedPosition.idx < 0 || selectedPosition.rowIdx < 0) {
      return;
    }
    this.selectNone();
  };

  selectNone = () => {
    this.setState({ selectedPosition: { idx: -1, rowIdx: -1, groupRowIndex: -1 } });
  };

  selectCell = (cell, openEditor) => {
    context.eventBus.dispatch(EVENT_BUS_TYPE.SELECT_CELL, cell, openEditor);
  };

  selectStart = (cellPosition) => {
    context.eventBus.dispatch(EVENT_BUS_TYPE.SELECT_START, cellPosition);
  };

  selectUpdate = (cellPosition, isFromKeyboard, callback) => {
    context.eventBus.dispatch(EVENT_BUS_TYPE.SELECT_UPDATE, cellPosition, isFromKeyboard, callback);
  };

  selectEnd = () => {
    context.eventBus.dispatch(EVENT_BUS_TYPE.SELECT_END);
  };

  onCloseContextMenu = () => {
    this.setState({
      activeRows: [],
    });
  };

  getNextScrollState = ({ gridHeight, scrollTop, rowHeight, groupMetrics, pathFoldedGroupMap }) => {
    const _gridHeight = gridHeight || window.innerHeight;
    const _rowHeight = rowHeight || this.getRowHeight();
    const updatedGroupMetrics = groupMetrics || this.state.groupMetrics;
    const updatedPathFoldedGroupMap = pathFoldedGroupMap || this.state.pathFoldedGroupMap;
    const { startRenderIndex, endRenderIndex } = this.getGroupVisibleBoundaries(_gridHeight, scrollTop, updatedGroupMetrics, _rowHeight);
    return {
      startRenderIndex,
      endRenderIndex,
      groupMetrics: updatedGroupMetrics,
      pathFoldedGroupMap: updatedPathFoldedGroupMap,
    };
  };

  updateScroll = (scrollParams) => {
    const { startRenderIndex, endRenderIndex, ...scrollArgs } = scrollParams;
    let nextScrollState = this.getNextScrollState(scrollArgs);
    if (startRenderIndex && endRenderIndex) {
      nextScrollState.startRenderIndex = startRenderIndex;
      nextScrollState.endRenderIndex = endRenderIndex;
    }
    this.setState(nextScrollState);
    return nextScrollState;
  };

  isParentGroupContainer = (currentGroupRow, targetGroupRow) => {
    const { groupPath: currentGroupPath, level: currentGroupLevel, type: currentGroupRowType } = currentGroupRow;
    const { groupPath: targetGroupPath, level: targetGroupLevel } = targetGroupRow;
    return currentGroupRowType === GROUP_ROW_TYPE.GROUP_CONTAINER &&
      currentGroupLevel > targetGroupLevel && currentGroupPath[0] === targetGroupPath[0];
  };

  getPrevGroupContainers = (currentGroupRow, groupRows, maxLevel) => {
    if (!currentGroupRow) {
      return [];
    }
    const { level, groupRowIndex, type } = currentGroupRow;
    if (groupRowIndex === 0 || (level === maxLevel && type === GROUP_ROW_TYPE.GROUP_CONTAINER)) {
      return [];
    }
    let prevGroupContainers = [];
    let prevGroupRowIndex = groupRowIndex - 1;
    while (prevGroupRowIndex > -1) {
      const prevGroupRow = groupRows[prevGroupRowIndex];
      const { type: preGroupRowType, level: prevGroupRowLevel } = prevGroupRow;
      if (preGroupRowType === GROUP_ROW_TYPE.GROUP_CONTAINER) {
        // first level group.
        if (level === maxLevel) {
          prevGroupContainers.push(prevGroupRow);
          break;
        }

        // multiple level group.
        if (this.isParentGroupContainer(prevGroupRow, currentGroupRow)) {
          prevGroupContainers.unshift(prevGroupRow);
        }

        if (prevGroupRowLevel === maxLevel) {
          break;
        }
      }
      prevGroupRowIndex--;
    }
    return prevGroupContainers;
  };

  getVisibleGroupRows = (startRenderIndex, endRenderIndex, groupRows) => {
    const visibleGroupRows = [];
    const overScanStartGroupRow = groupRows[startRenderIndex];
    const maxLevel = this.props.groupbys.length;

    // If first visible group is nested in the previous group, then the previous group container also needs to be rendered.
    const prevGroupContainers = this.getPrevGroupContainers(overScanStartGroupRow, groupRows, maxLevel);
    visibleGroupRows.push(...prevGroupContainers);
    let i = startRenderIndex;
    let rows = [];
    while (i <= endRenderIndex) {
      let groupRow = groupRows[i];
      if (groupRow && groupRow.visible) {
        visibleGroupRows.push(groupRow);
        if (groupRow.type === GROUP_ROW_TYPE.ROW) {
          rows.push(groupRow);
        }
      }
      i++;
    }
    return visibleGroupRows;
  };

  getFoldedGroups = () => {
    const localConfigs = context.localStorage.getItem(LOCAL_FOLDED_GROUP_KEY);
    if (!localConfigs) return {};
    return localConfigs;
  };

  getVisibleIndex = () => {
    return { rowVisibleStartIdx: this.rowVisibleStart, rowVisibleEndIdx: this.rowVisibleEnd };
  };

  updateFoldedGroups = (pathFoldedGroupMap) => {
    context.localStorage.setItem(LOCAL_FOLDED_GROUP_KEY, pathFoldedGroupMap);
    this.selectNoneCells();
  };

  collapseAllGroups = () => {
    const { groupMetrics } = this.state;
    const { groupRows } = groupMetrics;
    let pathFoldedGroupMap = {};
    groupRows.forEach(groupRow => {
      const { type, groupPathString } = groupRow;
      if (type !== GROUP_ROW_TYPE.GROUP_CONTAINER) {
        return;
      }
      pathFoldedGroupMap[groupPathString] = true;
    });
    this.updateFoldedGroups(pathFoldedGroupMap);
    const { groups, groupbys, allColumns } = this.props;
    const rowHeight = this.getRowHeight();
    const { scrollTop } = this.resultContentRef;
    const nextGroupMetrics = createGroupMetrics(groups, groupbys, pathFoldedGroupMap, allColumns, rowHeight, false);
    this.updateScroll({ scrollTop, rowHeight, groupMetrics: nextGroupMetrics });
  };

  expandAllGroups = () => {
    const pathFoldedGroupMap = {};
    this.updateFoldedGroups(pathFoldedGroupMap);
    const { groups, groupbys, allColumns } = this.props;
    const { scrollTop } = this.resultContentRef;
    const rowHeight = this.getRowHeight();
    const groupMetrics = createGroupMetrics(groups, groupbys, pathFoldedGroupMap, allColumns, rowHeight, false);
    this.updateScroll({ scrollTop, rowHeight, groupMetrics });
  };

  onExpandGroupToggle = (groupPathString) => {
    const { groupMetrics, pathFoldedGroupMap } = this.state;
    const { groupRows, maxLevel } = groupMetrics;
    const groupContainerRow = groupRows.find(groupRow => groupRow.groupPathString === groupPathString && groupRow.type === GROUP_ROW_TYPE.GROUP_CONTAINER);
    if (!groupContainerRow) return;
    const { groupRowIndex: operatedGroupRowIndex, groupPath: operatedGroupPath, height: operatedGroupRowHeight, isExpanded } = groupContainerRow;
    let updatedPathFoldedGroupMap = { ...pathFoldedGroupMap };
    if (isExpanded) {
      updatedPathFoldedGroupMap[groupPathString] = true;
    } else {
      delete updatedPathFoldedGroupMap[groupPathString];
    }

    const { groups, groupbys, allColumns } = this.props;
    const { scrollTop } = this.resultContentRef;
    const rowHeight = this.getRowHeight();
    const recalculatedGroupMetrics = createGroupMetrics(groups, groupbys, updatedPathFoldedGroupMap, allColumns, rowHeight, false);

    // expand/fold group directly if the rows exceed the maximum number of rows supported.
    if (groupContainerRow.count >= MAX_ANIMATION_ROWS) {
      this.forbidRowsAnimation();
      this.updateFoldedGroups(updatedPathFoldedGroupMap);
      this.updateScroll({ scrollTop, rowHeight, groupMetrics: recalculatedGroupMetrics, pathFoldedGroupMap: updatedPathFoldedGroupMap });
      return;
    }

    const { startRenderIndex, endRenderIndex } = this.getGroupVisibleBoundaries(window.innerHeight, scrollTop, recalculatedGroupMetrics, rowHeight);
    let newGroupMetrics;
    if (isExpanded) {
      newGroupMetrics = groupMetrics;
      let newGroupRows = newGroupMetrics.groupRows;
      if (maxLevel > 1) {
        // update the parent group container.
        const increment = -(operatedGroupRowHeight - GROUP_HEADER_HEIGHT);
        for (let i = operatedGroupRowIndex - 1; i > -1; i--) {
          let updatedGroupRow = newGroupRows[i];
          const updatedGroupPath = updatedGroupRow.groupPath;
          if (this.isParentGroupContainer(updatedGroupRow, groupContainerRow)) {
            updatedGroupRow.height = updatedGroupRow.height + increment;
          }
          if (updatedGroupPath[0] !== operatedGroupPath[0]) {
            break;
          }
        }
      }

      // update the group container/row which nested in the folding group.
      for (let i = operatedGroupRowIndex + 1; i < newGroupRows.length; i++) {
        let updatedGroupRow = newGroupRows[i];
        const updatedGroupPath = updatedGroupRow.groupPath;
        if (isNestedGroupRow(updatedGroupRow, groupContainerRow)) {
          updatedGroupRow.visible = false;
        }
        if (updatedGroupPath[0] !== operatedGroupPath[0]) {
          break;
        }
      }
      newGroupRows[operatedGroupRowIndex] = { ...newGroupRows[operatedGroupRowIndex], isExpanded: false, height: GROUP_HEADER_HEIGHT };
    } else {
      newGroupMetrics = recalculatedGroupMetrics;
      let newGroupRows = newGroupMetrics.groupRows;

      // update the group container/row which nested in the expanding group.
      const newTop = groupContainerRow.top + GROUP_HEADER_HEIGHT;
      for (let i = operatedGroupRowIndex + 1; i < newGroupRows.length; i++) {
        let updatedGroupRow = newGroupRows[i];
        const updatedGroupPath = updatedGroupRow.groupPath;
        if (isNestedGroupRow(updatedGroupRow, groupContainerRow)) {
          updatedGroupRow.height = 0;
          updatedGroupRow.top = newTop;
        }
        if (updatedGroupPath[0] !== operatedGroupPath[0]) {
          break;
        }
      }
    }
    this.expandingGroupPathString = groupPathString;
    this.nextPathFoldedGroupMap = updatedPathFoldedGroupMap;
    this.setState({
      groupMetrics: newGroupMetrics,
      startRenderIndex,
      endRenderIndex,
    });
    this.updateFoldedGroups(updatedPathFoldedGroupMap);
  };

  forbidRowsAnimation = () => {
    this.disabledAnimation = true;
    const originClassName = this.groupRows.className;
    const newClassName = removeClassName(originClassName, 'animation');
    if (newClassName !== originClassName) {
      this.groupRows.className = newClassName;
    }
  };

  ableRowsAnimation = () => {
    this.disabledAnimation = false;
    const originClassName = this.groupRows.className;
    const newClassName = addClassName(originClassName, 'animation');
    if (newClassName !== originClassName) {
      this.groupRows.className = newClassName;
    }
  };

  openDownloadFilesDialog = () => {
    const { column, activeRows } = this.state;
    this.props.cacheDownloadFilesProps(column, activeRows);
    this.props.openDownloadFilesDialog();
  };

  checkSupportDownloadFiles = () => {
    const { column } = this.state;
    const { left, right } = this.interactionMask.getSelectedPosition();
    const isSelectingMultiColumns = right > left;
    return !isSelectingMultiColumns && (column.type === CellType.FILE || column.type === CellType.IMAGE);
  };

  renderGroups = () => {
    const {
      totalWidth: columnsWidth, containerWidth, isShowRowExpandBtn,
      columns, colOverScanStartIdx, colOverScanEndIdx, groupOffsetLeft, fixedColumnCount,
      rowMetrics, summaryConfigs, lastFrozenColumnKey, showCellColoring, columnColors,
    } = this.props;
    this.rowFrozenRefs = [];
    const totalColumnsWidth = columnsWidth + SEQUENCE_COLUMN_WIDTH;
    const { startRenderIndex, endRenderIndex, groupMetrics, selectedPosition } = this.state;
    const { groupRows, maxLevel } = groupMetrics;
    const scrollLeft = this.props.getScrollLeft();
    const cellMetaData = this.getCellMetaData();
    let visibleGroupRows = this.getVisibleGroupRows(startRenderIndex, endRenderIndex, groupRows);
    const rendererGroups = [];
    const columnsLen = columns.length;
    const lastColumn = columns[columnsLen - 1];
    let groupRowsHeight = groupMetrics.groupRowsHeight;
    visibleGroupRows.forEach(groupRow => {
      let {
        type, level, key, left, top, isExpanded, height, groupPathString, groupRowIndex,
      } = groupRow;
      if (type === GROUP_ROW_TYPE.GROUP_CONTAINER) {
        const groupWidth = totalColumnsWidth + (level - 1) * 2 * GROUP_VIEW_OFFSET; // columns + group offset
        const folding = this.expandingGroupPathString === groupPathString && !isExpanded;
        const backdropHeight = height + GROUP_VIEW_OFFSET;
        rendererGroups.push(
          <GroupContainer
            key={key}
            ref={this.setGroupNode(groupPathString)}
            groupPathString={groupPathString}
            group={groupRow}
            height={height}
            backdropHeight={backdropHeight}
            width={groupWidth}
            top={top}
            maxLevel={maxLevel}
            groupOffsetLeft={groupOffsetLeft}
            scrollLeft={scrollLeft}
            columns={columns}
            summaryConfigs={summaryConfigs}
            isExpanded={isExpanded}
            fixedColumnCount={fixedColumnCount}
            folding={folding}
            lastFrozenColumnKey={lastFrozenColumnKey}
            onExpandGroupToggle={this.onExpandGroupToggle}
          />
        );
      } else if (type === GROUP_ROW_TYPE.ROW) {
        const { rowId, rowIdx, isLastRow } = groupRow;
        const row = rowId && this.props.rowGetterById(rowId);
        const isSelected = RowMetrics.isRowSelected(rowId, rowMetrics);
        const hasSelectedCell = this.props.hasSelectedCell({ groupRowIndex }, selectedPosition);
        const columnColor = showCellColoring ? columnColors[rowId] : {};
        if (!row) return;
        rendererGroups.push(
          <Row
            isGroupView
            key={rowId || rowIdx}
            ref={ref => {
              this.rowFrozenRefs.push(ref);
            }}
            isSelected={isSelected}
            groupRowIndex={groupRowIndex}
            index={rowIdx}
            isLastRow={isLastRow}
            lastFrozenColumnKey={lastFrozenColumnKey}
            row={row}
            columns={columns}
            colOverScanStartIdx={colOverScanStartIdx}
            colOverScanEndIdx={colOverScanEndIdx}
            left={left}
            top={top}
            height={height}
            scrollLeft={scrollLeft}
            cellMetaData={cellMetaData}
            searchResult={this.props.searchResult}
            hasSelectedCell={hasSelectedCell}
            selectedPosition={this.state.selectedPosition}
            selectNoneCells={this.selectNoneCells}
            onSelectRow={this.props.onSelectRow}
            modifyRow={this.props.modifyRow}
            lockRowViaButton={this.props.lockRowViaButton}
            modifyRowViaButton={this.props.modifyRowViaButton}
            reloadRows={this.props.reloadRows}
            columnColor={columnColor}
            onRowExpand={this.props.onRowExpand}
            isShowRowExpandBtn={isShowRowExpandBtn}
          />
        );
      }
    });

    const allColumnsFrozen = lastFrozenColumnKey === lastColumn.key;
    const groupRowsClassName = classnames(
      'canvas-groups-rows', 'animation',
      {
        'single-column': checkIsNameColumn(lastColumn),
        'disabled-add-row': true,
        'all-columns-frozen': allColumnsFrozen,
        'frozen': allColumnsFrozen || !!lastFrozenColumnKey,
      }
    );
    const groupRowsStyle = {
      height: groupRowsHeight,
      width: containerWidth + ((maxLevel - 1) * 2 + 1) * GROUP_VIEW_OFFSET, // columns width + groups offset
    };
    return (
      <div className={groupRowsClassName} style={groupRowsStyle} ref={ref => this.groupRows = ref}>
        {rendererGroups}
      </div>
    );
  };

  render() {
    const { editorPortalTarget = document.body } = this.props;
    return (
      <Fragment>
        <div
          id='group-canvas'
          className='sea-metadata-table-canvas'
          ref={this.setResultContentRef}
          onScroll={this.onScroll}
          onKeyDown={this.props.onGridKeyDown}
          onKeyUp={this.props.onGridKeyUp}
        >
          <InteractionMasks
            isGroupView
            ref={this.setInteractionMaskRef}
            contextMenu={this.props.contextMenu}
            table={this.props.table}
            columns={this.props.columns}
            rowsCount={this.props.rowsCount}
            rowMetrics={this.props.rowMetrics}
            groups={this.props.groups}
            groupMetrics={this.state.groupMetrics}
            rowHeight={this.getRowHeight()}
            groupOffsetLeft={this.props.groupOffsetLeft}
            scrollTop={this.oldScrollTop}
            getRowTop={this.getRowTop}
            collaborators={this.props.collaborators}
            tagsData={this.props.tagsData}
            getScrollLeft={this.props.getScrollLeft}
            getTableContentRect={this.props.getTableContentRect}
            getMobileFloatIconStyle={this.props.getMobileFloatIconStyle}
            onToggleMobileMoreOperations={this.props.onToggleMobileMoreOperations}
            onToggleInsertRowDialog={this.props.onToggleInsertRowDialog}
            editorPortalTarget={editorPortalTarget}
            onCellRangeSelectionUpdated={this.onCellRangeSelectionUpdated}
            modifyRow={this.props.modifyRow}
            rowGetterByIndex={this.props.rowGetterByIndex}
            rowGetterById={this.props.rowGetterById}
            modifyRows={this.props.modifyRows}
            paste={this.props.paste}
            editMobileCell={this.props.editMobileCell}
            frozenColumnsWidth={this.props.frozenColumnsWidth}
            selectNone={this.selectNone}
            onCellClick={this.onCellClick}
            getVisibleIndex={this.getVisibleIndex}
            getGroupCanvasScrollTop={this.getScrollTop}
            setGroupCanvasScrollTop={this.setScrollTop}
            scrollToColumn={this.scrollToColumn}
            setRowsScrollLeft={this.props.setRowsScrollLeft}
            gridUtils={this.props.gridUtils}
            getCopiedRowsAndColumnsFromRange={this.props.getCopiedRowsAndColumnsFromRange}
            modifyColumnData={this.props.modifyColumnData}
            getTableCanvasContainerRect={this.props.getTableCanvasContainerRect}
          />
          <div className="sea-metadata-table-data" ref={this.setResultRef}>
            {this.renderGroups()}
          </div>
        </div>
        <RightScrollbar
          ref={this.setRightScrollbar}
          getClientHeight={this.getCanvasClientHeight}
          getScrollHeight={this.getRecordsWrapperScrollHeight}
          onScrollbarScroll={this.onScrollbarScroll}
          onScrollbarMouseUp={this.onScrollbarMouseUp}
        />
      </Fragment>
    );
  }

}

GroupBody.propTypes = {
  gridUtils: PropTypes.object,
  table: PropTypes.object,
  allColumns: PropTypes.array,
  columns: PropTypes.array,
  colOverScanStartIdx: PropTypes.number,
  colOverScanEndIdx: PropTypes.number,
  totalWidth: PropTypes.number,
  containerWidth: PropTypes.number,
  groups: PropTypes.array,
  groupbys: PropTypes.array,
  rowsCount: PropTypes.number,
  rowMetrics: PropTypes.object,
  groupOffsetLeft: PropTypes.number,
  frozenColumnsWidth: PropTypes.number,
  summaryConfigs: PropTypes.object,
  hasSelectedRow: PropTypes.bool,
  lastFrozenColumnKey: PropTypes.string,
  searchResult: PropTypes.object,
  editorPortalTarget: PropTypes.instanceOf(Element),
  onRef: PropTypes.func,
  getScrollLeft: PropTypes.func,
  setRowsScrollLeft: PropTypes.func,
  hasSelectedCell: PropTypes.func,
  cacheScrollTop: PropTypes.func,
  loadMore: PropTypes.func,
  getTableContentRect: PropTypes.func,
  getMobileFloatIconStyle: PropTypes.func,
  onToggleMobileMoreOperations: PropTypes.func,
  onToggleInsertRowDialog: PropTypes.func,
  onCellClick: PropTypes.func,
  onCellRangeSelectionUpdated: PropTypes.func,
  modifyRow: PropTypes.func,
  rowGetterByIndex: PropTypes.func,
  rowGetterById: PropTypes.func,
  modifyRows: PropTypes.func.isRequired,
  paste: PropTypes.func,
  selectNone: PropTypes.func,
  onSelectRow: PropTypes.func,
  expandRow: PropTypes.func,
  lockRowViaButton: PropTypes.func,
  modifyRowViaButton: PropTypes.func,
  onDeleteRows: PropTypes.func,
  editMobileCell: PropTypes.func,
  reloadRows: PropTypes.func,
  showCellColoring: PropTypes.bool,
  columnColors: PropTypes.object,
  getCopiedRowsAndColumnsFromRange: PropTypes.func,
  openDownloadFilesDialog: PropTypes.func,
  cacheDownloadFilesProps: PropTypes.func,
  onCellContextMenu: PropTypes.func,
  getTableCanvasContainerRect: PropTypes.func,
};

export default GroupBody;
