import React from 'react';
import PropTypes from 'prop-types';

import './index.css';

function MobileCommonHeader(props) {
  const { title, titleClass, onLeftClick, leftName, onRightClick, rightName, rightStyle } = props;
  const style = rightStyle ? rightStyle : { color: '#f09f3f' };
  const preCls = 'seatable-am-list-header-content';
  return (
    <div className={`am-list-header seatable-am-list-header ${titleClass || ''}`}>
      <div className={`${preCls}`}>
        <span className={`${preCls}-btn`} onClick={onLeftClick}>{leftName || ''}</span>
        <h4 className={`${preCls}-title`}>{title}</h4>
        <span className={`${preCls}-btn`} onClick={onRightClick} style={style}>
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

export default React.memo(MobileCommonHeader);
