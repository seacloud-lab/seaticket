import React from 'react';
import PropTypes from 'prop-types';
import { DTABLE_ICON_LIST, DTABLE_ICON_COLORS } from '../../constants/dtable-icon';

const propTypes = {
  dtableColor: PropTypes.string,
  dtableIcon: PropTypes.string,
  className: PropTypes.string
};

function DTableItem(props) {
  return (
    <div className={props.className}>
      <span className="table-icon-content" style={{ backgroundColor: props.dtableColor || DTABLE_ICON_COLORS[0] }}>
        <i className={`base-font dtable-icon-color-white ${props.dtableIcon || DTABLE_ICON_LIST[0]} dtable-icon-style`}></i>
      </span>
    </div>
  );
}

DTableItem.defaultProps = {
  className: 'table-icon',
};

DTableItem.propTypes = propTypes;

export default DTableItem;

