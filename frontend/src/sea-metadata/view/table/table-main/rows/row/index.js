import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import Cell from './cell';
import ActionsCell from './actions-cell';
import { getFrozenColumns } from '../../../../../utils/column';
import { ROW_HEIGHT_CLASS_MAP } from '../../../../../constants';
import { Z_INDEX } from '@/constants/zIndexes';

import './index.css';

class Row extends React.Component {

  componentDidMount() {
    this.checkScroll();
  }

  shouldComponentUpdate(nextProps) {
    return (
      nextProps.isGroupView !== this.props.isGroupView ||
      nextProps.hasSelectedCell !== this.props.hasSelectedCell ||
      (nextProps.hasSelectedCell && this.props.selectedPosition.idx !== nextProps.selectedPosition.idx) || // selected cell in same row but different column
      nextProps.isSelected !== this.props.isSelected ||
      nextProps.groupRowIndex !== this.props.groupRowIndex ||
      nextProps.index !== this.props.index ||
      nextProps.isLastRow !== this.props.isLastRow ||
      nextProps.lastFrozenColumnKey !== this.props.lastFrozenColumnKey ||
      nextProps.columns !== this.props.columns ||
      nextProps.colOverScanStartIdx !== this.props.colOverScanStartIdx ||
      nextProps.colOverScanEndIdx !== this.props.colOverScanEndIdx ||
      nextProps.row !== this.props.row ||
      nextProps.top !== this.props.top ||
      nextProps.left !== this.props.left ||
      nextProps.height !== this.props.height ||
      nextProps.searchResult !== this.props.searchResult ||
      nextProps.columnColor !== this.props.columnColor
    );
  }

  checkScroll = () => {
    this.cancelFixFrozenDOMs(this.props.scrollLeft);
  };

  cancelFixFrozenDOMs = (scrollLeft) => {
    const { isGroupView } = this.props;
    const frozenChildrenCount = this.frozenColumns.childElementCount;
    if (!this.frozenColumns || frozenChildrenCount < 1 || (isGroupView && frozenChildrenCount < 2)) {
      return;
    }
    this.frozenColumns.style.position = 'absolute';
    this.frozenColumns.style.marginLeft = scrollLeft + 'px';
    this.frozenColumns.style.marginTop = '0px';
  };

  onSelectRow = (e) => {
    const { groupRowIndex, index } = this.props;
    this.props.selectNoneCells();
    this.props.onSelectRow({ groupRowIndex, rowIndex: index }, e);
  };

  isCellSelected = (columnIdx) => {
    const { hasSelectedCell, selectedPosition } = this.props;
    if (!selectedPosition) return false;
    return hasSelectedCell && selectedPosition.idx === columnIdx;
  };

  isLastCell(columns, columnKey) {
    return columns[columns.length - 1].key === columnKey;
  }

  reloadCurrentRow = () => {
    this.props.reloadRows([this.props.row._id]);
  };

  getFrozenCells = () => {
    const {
      columns, lastFrozenColumnKey, groupRowIndex, index: rowIndex, row,
      cellMetaData, isGroupView, isLastRow, height, columnColor
    } = this.props;
    const frozenColumns = getFrozenColumns(columns);
    if (frozenColumns.length === 0) return null;
    const rowId = row._id;
    return frozenColumns.map((column, index) => {
      const { key } = column;
      const isCellHighlight = this.isCellHighlight(key, rowId);
      const isCurrentCellHighlight = this.isCurrentCellHighlight(key, rowId);
      const highlightClassName = isCurrentCellHighlight ? 'cell-current-highlight' : isCellHighlight ? 'cell-highlight' : null;
      const isCellSelected = this.isCellSelected(columns.findIndex(col => col.key === key));
      const isLastCell = this.isLastCell(columns, key);
      const isLastFrozenCell = key === lastFrozenColumnKey;
      const bgColor = columnColor && columnColor[key];
      return (
        <Cell
          frozen
          key={column.key}
          row={row}
          groupRowIndex={groupRowIndex}
          rowIndex={rowIndex}
          isCellSelected={isCellSelected}
          isLastCell={isLastCell}
          isLastFrozenCell={isLastFrozenCell}
          height={isGroupView ? height : height - 1}
          column={column}
          cellMetaData={cellMetaData}
          modifyRow={this.props.modifyRow}
          lockRowViaButton={this.props.lockRowViaButton}
          modifyRowViaButton={this.props.modifyRowViaButton}
          reloadCurrentRow={this.reloadCurrentRow}
          highlightClassName={highlightClassName}
          rowHeightClassName={ROW_HEIGHT_CLASS_MAP[(isGroupView && isLastRow) ? height - 2 : height - 1]}
          bgColor={bgColor}
        />
      );
    });
  };

  isCellHighlight = (columnKey, rowId) => {
    const { searchResult } = this.props;
    if (searchResult) {
      const matchedColumns = searchResult.matchedRows[rowId];
      if (matchedColumns && matchedColumns.includes(columnKey)) {
        return true;
      }
    }
    return false;
  };

  isCurrentCellHighlight = (columnKey, rowId) => {
    const { searchResult } = this.props;
    if (searchResult) {
      const { currentSelectIndex } = searchResult;
      if (typeof(currentSelectIndex) !== 'number') return false;
      const currentSelectCell = searchResult.matchedCells[currentSelectIndex];
      if (!currentSelectCell) return false;
      if (currentSelectCell.row === rowId && currentSelectCell.column === columnKey) return true;
    }
    return false;
  };

  getColumnCells = () => {
    const {
      columns, colOverScanStartIdx, colOverScanEndIdx, groupRowIndex, index: rowIndex,
      row, cellMetaData, isGroupView, isLastRow, height, columnColor
    } = this.props;
    const rowId = row._id;
    const rendererColumns = columns.slice(colOverScanStartIdx, colOverScanEndIdx);
    return rendererColumns.map((column) => {
      const { key, frozen } = column;
      const needBindEvents = !frozen;
      const isCellSelected = this.isCellSelected(columns.findIndex(col => col.key === column.key));
      const isCellHighlight = this.isCellHighlight(key, rowId);
      const isCurrentCellHighlight = this.isCurrentCellHighlight(key, rowId);
      const highlightClassName = isCurrentCellHighlight ? 'cell-current-highlight' : isCellHighlight ? 'cell-highlight' : null;
      const isLastCell = this.isLastCell(columns, key);
      const bgColor = columnColor && columnColor[key];
      return (
        <Cell
          key={column.key}
          row={row}
          groupRowIndex={groupRowIndex}
          rowIndex={rowIndex}
          isCellSelected={isCellSelected}
          isLastCell={isLastCell}
          height={isGroupView ? height : height - 1}
          column={column}
          needBindEvents={needBindEvents}
          cellMetaData={cellMetaData}
          modifyRow={this.props.modifyRow}
          lockRowViaButton={this.props.lockRowViaButton}
          modifyRowViaButton={this.props.modifyRowViaButton}
          reloadCurrentRow={this.reloadCurrentRow}
          highlightClassName={highlightClassName}
          rowHeightClassName={ROW_HEIGHT_CLASS_MAP[(isGroupView && isLastRow) ? height - 2 : height - 1]}
          bgColor={bgColor}
        />
      );
    });
  };

  getRowStyle = () => {
    const { isGroupView, height, isLastRow } = this.props;
    const style = { height };
    if (isGroupView) {
      const { top, left } = this.props;
      style.top = top;
      style.left = left;
      if (isLastRow) {
        style.height = height + 1;
      }
    }
    return style;
  };

  getFrozenColumnsStyle = () => {
    const { isGroupView, lastFrozenColumnKey, height } = this.props;
    let style = {
      zIndex: Z_INDEX.SEQUENCE_COLUMN,
      height: height - 1,
    };
    if (isGroupView) {
      style.height = height;
      style.zIndex = Z_INDEX.FROZEN_GROUP_CELL;
      if (!lastFrozenColumnKey) {
        style.marginLeft = '0px';
      }
      style.borderBottomLeftRadius = '5px';
    }
    return style;
  };

  // handle drag copy
  handleDragEnter = (e) => {
    // Prevent default to allow drop
    e.preventDefault();
    const { index, groupRowIndex, cellMetaData: { onDragEnter } } = this.props;
    onDragEnter({ overRowIdx: index, overGroupRowIndex: groupRowIndex });
  };

  handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  handleDrop = (e) => {
    // The default in Firefox is to treat data in dataTransfer as a URL and perform navigation on it, even if the data type used is 'text'
    // To bypass this, we need to capture and prevent the drop event.
    e.preventDefault();
  };

  render() {
    const {
      isSelected, isGroupView, index, isLastRow, lastFrozenColumnKey, height, row
    } = this.props;
    const isLocked = row._locked ? true : false;
    const cellHeight = isGroupView ? height : height - 1;

    const frozenCells = this.getFrozenCells();
    const columnCells = this.getColumnCells();

    return (
      <div
        className={classnames('sea-metadata-table-row', {
          'sea-metadata-last-table-row': isLastRow,
          'row-selected': isSelected,
          'row-locked': isLocked
        })}
        style={this.getRowStyle()}
        onDragEnter={this.handleDragEnter}
        onDragOver={this.handleDragOver}
        onDrop={this.handleDrop}
      >
        {/* frozen */}
        <div
          className="frozen-columns d-flex"
          style={this.getFrozenColumnsStyle()}
          ref={ref => this.frozenColumns = ref}
        >
          <ActionsCell
            isLocked={isLocked}
            isSelected={isSelected}
            rowId={row._id}
            row={row}
            index={index}
            onSelectRow={this.onSelectRow}
            isLastFrozenCell={!lastFrozenColumnKey}
            height={cellHeight}
            onRowExpand={this.props.onRowExpand}
            isShowRowExpandBtn={this.props.isShowRowExpandBtn}
          />
          {frozenCells}
        </div>
        {/* scroll */}
        {columnCells}
      </div>
    );
  }
}

Row.propTypes = {
  hasSelectedCell: PropTypes.bool,
  isGroupView: PropTypes.bool,
  isSelected: PropTypes.bool,
  groupRowIndex: PropTypes.number,
  index: PropTypes.number.isRequired,
  isLastRow: PropTypes.bool,
  lastFrozenColumnKey: PropTypes.string,
  cellMetaData: PropTypes.object,
  selectedPosition: PropTypes.object,
  row: PropTypes.object.isRequired,
  columns: PropTypes.array.isRequired,
  colOverScanStartIdx: PropTypes.number,
  colOverScanEndIdx: PropTypes.number,
  scrollLeft: PropTypes.number,
  top: PropTypes.number,
  left: PropTypes.number,
  height: PropTypes.number,
  selectNoneCells: PropTypes.func,
  onSelectRow: PropTypes.func,
  modifyRow: PropTypes.func,
  lockRowViaButton: PropTypes.func,
  modifyRowViaButton: PropTypes.func,
  reloadRows: PropTypes.func,
  searchResult: PropTypes.object,
  columnColor: PropTypes.object,
  onRowExpand: PropTypes.func
};

export default Row;
