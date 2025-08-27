import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { isMobile } from '@utils/utils';
import { SEQUENCE_COLUMN_WIDTH } from '../../../../../../constants';
import IconBtn from '@components/icon-button';

import './index.css';

class ActionsCell extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isLockedRowTooltipShow: false,
    };
  }

  onCellMouseEnter = () => {
    const { isLocked } = this.props;
    if (!isLocked || isMobile) return;
    this.timer = setTimeout(() => {
      this.setState({ isLockedRowTooltipShow: true });
    }, 500);
  };

  onCellMouseLeave = () => {
    const { isLocked } = this.props;
    if (!isLocked || isMobile) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.setState({ isLockedRowTooltipShow: false });
  };

  handleShowExpandedProps = () => {
    this.props.onRowExpand(this.props.row);
  };

  render() {
    const { isSelected, isLastFrozenCell, index, height, row, isShowRowExpandBtn } = this.props;
    const rowId = row._id;
    let cellStyle = {
      height,
      width: SEQUENCE_COLUMN_WIDTH,
      minWidth: SEQUENCE_COLUMN_WIDTH,
    };
    return (
      <div
        className={classnames('sea-metadata-table-cell column actions-cell', {
          'table-last--frozen': isLastFrozenCell,
          'justify-content-center': !isShowRowExpandBtn
        })}
        id={`action-cell-${rowId}`}
        style={{ ...cellStyle }}
        onMouseEnter={this.onCellMouseEnter}
        onMouseLeave={this.onCellMouseLeave}
      >
        {!isSelected && <div className="sea-metadata-table-column-content row-index text-truncate">{index + 1}</div>}
        <div className='sea-metadata-table-column-content actions-checkbox'>
          <div className='select-cell-checkbox-container' onClick={this.props.onSelectRow}>
            <input
              id={`select-cell-checkbox-${rowId}`}
              className='select-cell-checkbox'
              type='checkbox'
              name='row-selection'
              checked={isSelected || false}
              readOnly
            />
            <label
              htmlFor={`select-cell-checkbox-${rowId}`}
              name={gettext('Select')}
              title={gettext('Select')}
              aria-label={gettext('Select')}
            >
            </label>
          </div>
        </div>
        {isShowRowExpandBtn && (
          <IconBtn icon="expand" className="row-expand" iconClassName="row-expand-icon" onClick={this.handleShowExpandedProps} />
        )}
      </div>
    );
  }
}

ActionsCell.propTypes = {
  isLocked: PropTypes.bool,
  isSelected: PropTypes.bool,
  isLastFrozenCell: PropTypes.bool,
  index: PropTypes.number,
  height: PropTypes.number,
  onSelectRow: PropTypes.func,
  onRowExpand: PropTypes.func,
};

export default ActionsCell;
