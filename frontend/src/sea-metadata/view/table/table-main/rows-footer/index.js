import React from 'react';
import PropTypes from 'prop-types';
import Loading from '@/components/loading';
import RowMetrics from '../../utils/row-metrics';
import { gettext } from '@/constants';
import { SEQUENCE_COLUMN_WIDTH, CANVAS_RIGHT_INTERVAL, seaTableZIndexes } from '../../../../constants';
import { addClassName, removeClassName } from '@/utils/dom';
import { getRowsFromSelectedRange } from '../../utils/selected-cell-utils';

import './index.css';

class RowsFooter extends React.Component {

  ref = null;

  componentDidMount() {
    window.addEventListener('resize', this.calculateAtBorder);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.calculateAtBorder);
  }

  componentDidUpdate() {
    this.calculateAtBorder();
  }

  calculateAtBorder = () => {
    const { bottom } = this.ref.getBoundingClientRect();

    // update classnames after rows count change
    const originClassName = this.ref ? this.ref.className : '';
    let newClassName;
    if (bottom >= window.innerHeight) {
      newClassName = addClassName(originClassName, 'at-border');
    } else {
      newClassName = removeClassName(originClassName, 'at-border');
    }
    if (newClassName !== originClassName && this.ref) {
      this.ref.className = newClassName;
    }
  };

  onClick = () => {
    if (this.props.isLoadingMore) {
      return;
    }
    this.props.loadMore();
  };

  setSummaryScrollLeft = (scrollLeft) => {
    this.summaryItemsRef.scrollLeft = scrollLeft;
  };

  getSelectedCellsCount = (selectedRange) => {
    const { topLeft, bottomRight } = selectedRange;

    // if no cell selected topLeft.rowIdx is -1 , then return 0
    if (topLeft.rowIdx === -1) {
      return 0;
    }

    return (bottomRight.idx - topLeft.idx + 1) * (bottomRight.rowIdx - topLeft.rowIdx + 1);
  };

  getSummaries = () => {
    const {
      isGroupView, hasSelectedRow, rowMetrics, selectedRange, summaries,
      rowGetterByIndex,
    } = this.props;
    if (hasSelectedRow) {
      const selectedRowIds = RowMetrics.getSelectedIds(rowMetrics);
      const selectedRows = selectedRowIds && selectedRowIds.map(id => this.props.rowGetterById(id)).filter(Boolean);
      return this.props.getRowsSummaries(selectedRows);
    }

    const selectedCellsCount = this.getSelectedCellsCount(selectedRange);
    if (selectedCellsCount > 1) {
      const rows = getRowsFromSelectedRange({ selectedRange, isGroupView, rowGetterByIndex });
      return this.props.getRowsSummaries(rows);
    }

    return summaries;
  };

  getSummaryItems = () => {
    const { columns, hasMore, isLoadingMore } = this.props;
    const displayColumns = isLoadingMore || hasMore ? columns.slice(1, columns.length) : columns;
    let totalWidth = SEQUENCE_COLUMN_WIDTH;
    let summaryItems = Array.isArray(displayColumns) && displayColumns.map((column, columnIndex) => {
      let summaryItem;
      let { width, key } = column;
      totalWidth += width;
      summaryItem = <div className="summary-item" style={{ width }} key={key}></div>;
      return summaryItem;
    });
    return { summaryItems, totalWidth };
  };

  getRow = () => {
    const { hasMore, hasSelectedRow, rowMetrics, selectedRange, rowsCount } = this.props;
    if (hasSelectedRow) {
      const selectedRowsCount = RowMetrics.getSelectedIds(rowMetrics).length;
      return selectedRowsCount > 1 ? gettext('{count} rows selected').replace('{count}', selectedRowsCount) : gettext('1 row selected');
    }
    const selectedCellsCount = this.getSelectedCellsCount(selectedRange);
    if (selectedCellsCount > 1) {
      return gettext('{count} cells selected').replace('{count}', selectedCellsCount);
    }

    let rowsCountText;
    if (rowsCount > 1) {
      rowsCountText = gettext('{count} rows').replace('{count}', rowsCount);
    } else {
      rowsCountText = gettext('{count} row').replace('{count}', rowsCount);
    }
    if (hasMore) {
      rowsCountText += ' +';
    }
    return rowsCountText;
  };

  render() {
    const { hasMore, isLoadingMore, columns, groupOffsetLeft } = this.props;
    let { summaryItems, totalWidth } = this.getSummaryItems();
    const rowWidth = (isLoadingMore || hasMore ? SEQUENCE_COLUMN_WIDTH + columns[0].width : SEQUENCE_COLUMN_WIDTH) + groupOffsetLeft;

    return (
      <div className="sea-metadata-table-footer" style={{ zIndex: seaTableZIndexes.GRID_FOOTER }} ref={ref => this.ref = ref}>
        <div className="rows-row d-flex text-nowrap" style={{ width: rowWidth }}>
          <span>{this.getRow()}</span>
          {!isLoadingMore && hasMore &&
            <span className="load-all ml-4" onClick={this.onClick}>{gettext('Load more')}</span>
          }
          {isLoadingMore &&
            <span className="loading-message ml-4">
              <span className="mr-2">{gettext('Loading')}</span>
              <Loading className="sea-metadata-loading-tip center" />
            </span>
          }
        </div>
        <div className="summaries-pane">
          <div className="summaries-scroll" ref={ref => this.summaryItemsRef = ref}>
            <div style={{ width: totalWidth + CANVAS_RIGHT_INTERVAL }}>
              {summaryItems || ''}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

RowsFooter.propTypes = {
  hasMore: PropTypes.bool,
  isLoadingMore: PropTypes.bool,
  isGroupView: PropTypes.bool,
  hasSelectedRow: PropTypes.bool,
  rowsCount: PropTypes.number,
  summaries: PropTypes.object,
  summaryConfigs: PropTypes.object,
  columns: PropTypes.array,
  groupOffsetLeft: PropTypes.number,
  rowMetrics: PropTypes.object,
  selectedRange: PropTypes.object,
  rowGetterById: PropTypes.func,
  rowGetterByIndex: PropTypes.func,
  getRowsSummaries: PropTypes.func,
  loadAll: PropTypes.func,
};

export default RowsFooter;
