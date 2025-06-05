import React from 'react';
import PropTypes from 'prop-types';

import '../../../css/mobile/common-header.css';

function MobileCommonHeader(props) {
  const { title, titleClass, onLeftClick, leftName, onRightClick, rightName, rightStyle } = props;
  const style = rightStyle ? rightStyle : { color: '#f09f3f' };

  return (
    <div className={`dtable-am-list-header ${titleClass || ''}`}>
      <div className="mobile-common-view-header">
        <span className="mobile-common-view-header-btn" onClick={onLeftClick}>{leftName || ''}</span>
        <h4 className="mobile-common-view-header-title">{title}</h4>
        <span className="mobile-common-view-header-btn" onClick={onRightClick} style={style}>
          {rightName || ''}
        </span>
      </div>
    </div>
  );
}

MobileCommonHeader.propTypes = {
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.node]).isRequired,
  titleClass: PropTypes.string,
  leftName: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  rightName: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  onLeftClick: PropTypes.func,
  onRightClick: PropTypes.func,
  rightStyle: PropTypes.object,
};

export default MobileCommonHeader;
