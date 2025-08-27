import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import SelectAll from './select-all';
import { SEQUENCE_COLUMN_WIDTH } from '../../../../constants';

class ActionsCell extends Component {

  render() {
    const {
      isMobile, hasSelectedRow, isSelectedAll, isLastFrozenCell, groupOffsetLeft, height,
      isShowRowExpandBtn
    } = this.props;
    const columnCellClass = 'sea-metadata-table-cell column';
    const columnCellStyle = {
      height,
      width: SEQUENCE_COLUMN_WIDTH + groupOffsetLeft,
      minWidth: SEQUENCE_COLUMN_WIDTH + groupOffsetLeft,
    };
    return (
      <div
        className={classnames(columnCellClass, {
          'table-last--frozen': isLastFrozenCell,
          'justify-content-center': !isShowRowExpandBtn
        })}
        style={{ ...columnCellStyle }}
      >
        <SelectAll
          isMobile={isMobile}
          hasSelectedRow={hasSelectedRow}
          isSelectedAll={isSelectedAll}
          selectNoneRows={this.props.selectNoneRows}
          selectAllRows={this.props.selectAllRows}
        />
      </div>
    );
  }
}

ActionsCell.propTypes = {
  isMobile: PropTypes.bool,
  hasSelectedRow: PropTypes.bool,
  isSelectedAll: PropTypes.bool,
  isLastFrozenCell: PropTypes.bool,
  height: PropTypes.number,
  groupOffsetLeft: PropTypes.number,
  selectNoneRows: PropTypes.func,
  selectAllRows: PropTypes.func,
};

export default ActionsCell;
