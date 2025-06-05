import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Formatter from '../../../../../pages/dtable/dialog/dataset-widgets/formatter';

import './index.css';

class RowCardItem extends PureComponent {

  componentDidMount() {
    const { rowIdx, onRef } = this.props;
    onRef && onRef(this, rowIdx);
  }

  UNSAFE_componentWillUpdate(nextProps) {
    const { onRef } = this.props;
    onRef && onRef(this, nextProps.rowIdx);
  }

  onSelectRow = (e) => {
    const { row } = this.props;
    e.stopPropagation();
    this.props.onSelectRow && this.props.onSelectRow(row, e);
  };

  linkRowRecord = () => {
    const { row, columns, collaborators, queryUsers, departments, isShowColumnName } = this.props;
    return columns.map((column, index) => {
      const { key, width, name } = column;
      if (isShowColumnName) {
        return (
          <div
            key={`row-card-cell-value-${key}-${index}`}
            className="row-card-cell-value text-truncate d-flex show-name"
            style={{ width: width }}
          >
            {isShowColumnName && <span className="column-name text-truncate">{name}</span>}
            <div className="row-cell-value-content" style={{ width: width }}>
              <Formatter
                isRowExpand={false}
                cellValue={row[key]}
                column={column}
                row={row}
                collaborators={collaborators}
                departments={departments}
                queryUsers={queryUsers}
                editorConfig={this.props.editorConfig}
              />
            </div>
          </div>
        );
      }
      return (
        <div
          key={`row-card-cell-value-${key}-${index}`}
          className="row-card-cell-value text-truncate d-flex align-items-center"
          style={{ minWidth: width, width: width, maxWidth: width }}
        >
          <Formatter
            isRowExpand={false}
            cellValue={row[key]}
            column={column}
            row={row}
            collaborators={collaborators}
            departments={departments}
            queryUsers={queryUsers}
            editorConfig={this.props.editorConfig}
          />
        </div>
      );
    });
  };

  removeCardItem = (e) => {
    e.stopPropagation();
    const { row } = this.props;
    this.props.closeSelect && this.props.closeSelect();
    this.props.removeCardItem && this.props.removeCardItem(row._id);
  };

  onScroll = (event) => {
    event.stopPropagation();
    if (this.scrollActive) {
      this.scrollActive = false;
      return;
    }
    if (this.props.setItemScrollLeft) {
      this.props.setItemScrollLeft(this.getScrollLeft(), this.props.rowIdx);
    }
  };

  setScrollLeft = (scrollLeft) => {
    this.scrollActive = true;
    if (this.cardRecordsItemRef) {
      this.cardRecordsItemRef.scrollLeft = scrollLeft;
    }
  };

  getScrollLeft = () => {
    return this.cardRecordsItemRef ? this.cardRecordsItemRef.scrollLeft : 0;
  };

  setCardRecordsItemRef = (ref) => {
    this.cardRecordsItemRef = ref;
  };

  render() {
    const { row, nameColumn, isShowRemoveCardItemBtn, collaborators, queryUsers, isHighLight, departments } = this.props;
    return (
      <div className={`row-card-item position-relative d-flex ${isHighLight && 'hovered'}`} onClick={this.onSelectRow}>
        <div className="row-card-item-container w-100">
          <div className="row-card-item-header w-100 align-items-center">
            <div className="row-card-item-name seatable-row-card-name text-truncate h-100">
              <Formatter
                isRowExpand={false}
                cellValue={row[nameColumn.key]}
                column={nameColumn}
                row={row}
                collaborators={collaborators}
                departments={departments}
                queryUsers={queryUsers}
                editorConfig={this.props.editorConfig}
              />
              {row.isShowTick && <span className="row-card-item-check dtable-font dtable-icon-check-circle"></span>}
            </div>
            {isShowRemoveCardItemBtn && (
              <span className="row-card-item-remove d-print-none" onClick={this.removeCardItem}>
                <i className="row-card-remove-icon dtable-font dtable-icon-x-"></i>
              </span>
            )}
          </div>
          <div className="row-card-item-content" onScroll={this.onScroll} ref={this.setCardRecordsItemRef}>
            <div className="d-inline-flex">
              {this.linkRowRecord()}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

RowCardItem.defaultProps = {
  isShowColumnName: false,
};

RowCardItem.propTypes = {
  isShowRemoveCardItemBtn: PropTypes.bool,
  isHighLight: PropTypes.bool,
  isShowColumnName: PropTypes.bool,
  rowIdx: PropTypes.number,
  row: PropTypes.object,
  nameColumn: PropTypes.object,
  collaborators: PropTypes.array,
  columns: PropTypes.array,
  onSelectRow: PropTypes.func,
  removeCardItem: PropTypes.func,
  onRef: PropTypes.func,
  setItemScrollLeft: PropTypes.func,
  closeSelect: PropTypes.func,
  getOptionColors: PropTypes.func,
  queryUsers: PropTypes.func,
  editorConfig: PropTypes.object,
  departments: PropTypes.array,
};

export default RowCardItem;
