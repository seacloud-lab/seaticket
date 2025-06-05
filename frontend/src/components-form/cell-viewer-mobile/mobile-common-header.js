import React from 'react';
import PropTypes from 'prop-types';

function MobileCommonHeader(props) {
  const { title, titleClass, onLeftClick, leftName, onRightClick, rightName } = props;
  return (
    <div className={`am-list-header mobile-am-list-header ${titleClass ? titleClass : ''}`}>
      <div className="row-expand-view-header">
        <span className="row-expand-view-header-btn" onClick={onLeftClick}>{leftName || ''}</span>
        <h4 className="row-expand-view-header-title">{title}</h4>
        <span className="row-expand-view-header-btn" onClick={onRightClick}
          style={{ color: '#f09f3f' }}>{rightName || ''}
        </span>
      </div>
    </div>
  );
}

MobileCommonHeader.propTypes = {
  title: PropTypes.string.isRequired,
  titleClass: PropTypes.string,
  onLeftClick: PropTypes.func,
  onRightClick: PropTypes.func,
  leftName: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  rightName: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
};

export default MobileCommonHeader;
