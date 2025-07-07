import React from 'react';
import PropTypes from 'prop-types';

import './index.css';

function CommonAddTool({ callBack, footerName, className }) {
  return (
    <div className={`common-add-tool ${className || ''}`} onClick={(e) => {e.stopPropagation(); callBack(e);}}>
      <i className="dtable-font dtable-icon-add-table" aria-hidden="true"></i>
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
