import React from 'react';
import PropTypes from 'prop-types';
import Icon from '../icon';

import './index.css';

function CommonAddTool({ callBack, footerName, className }) {
  return (
    <div className={`common-add-tool ${className || ''}`} onClick={(e) => {e.stopPropagation(); callBack(e);}}>
      <Icon symbol="add" className="common-add-tool-icon" />
      <span className="text-truncate" title={footerName} aria-label={footerName}>{footerName}</span>
    </div>
  );
}

CommonAddTool.propTypes = {
  className: PropTypes.string,
  footerName: PropTypes.string.isRequired,
  callBack: PropTypes.func.isRequired,
};

export default CommonAddTool;
