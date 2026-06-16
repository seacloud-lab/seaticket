import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import IconBtn from '@/components/icon-button';
import GroupTitle from './group-title';
import { gettext } from '@/constants';
import { GROUP_HEADER_HEIGHT } from '../../../../../../constants';
import { Z_INDEX } from '@/constants/zIndexes';

class GroupHeaderLeft extends Component {

  render() {
    const {
      isExpanded, firstColumnFrozen, lastColumnFrozen, firstColumnKey, maxLevel,
      group, width,
    } = this.props;
    const { column, count, level, cell_value, original_cell_value } = group;
    const groupHeaderLeftStyle = {
      zIndex: firstColumnFrozen && Z_INDEX.GROUP_FROZEN_HEADER,
      height: GROUP_HEADER_HEIGHT,
      width,
    };

    return (
      <div
        ref={ref => this.groupHeaderLeft = ref}
        className={classnames('group-header-left group-header-cell', { 'table-last--frozen': lastColumnFrozen })}
        style={groupHeaderLeftStyle}
        data-column_key={firstColumnKey}
      >
        <IconBtn
          className={classnames('group-toggle-btn no-hover-bg', { 'rotate-icon-270': !isExpanded })}
          icon="arrow-down"
          onClick={this.props.onExpandGroupToggle}
        />
        <GroupTitle
          column={column || {}}
          originalCellValue={original_cell_value}
          cellValue={cell_value}
        />
        <div className="group-rows-count position-absolute top-0 bottom-0">
          <div className="mx-4 h-100 d-inline-flex align-items-center font-size-13 font-weight-400">
            {level === maxLevel && <span className="color-gray mr-1">{gettext('Count')}</span>}
            <span>{count}</span>
          </div>
        </div>
      </div>
    );
  }
}

GroupHeaderLeft.propTypes = {
  isExpanded: PropTypes.bool,
  firstColumnFrozen: PropTypes.bool,
  lastColumnFrozen: PropTypes.bool,
  firstColumnKey: PropTypes.string,
  maxLevel: PropTypes.number,
  group: PropTypes.object,
  formulaRow: PropTypes.object,
  width: PropTypes.number,
  onExpandGroupToggle: PropTypes.func,
};

export default GroupHeaderLeft;
