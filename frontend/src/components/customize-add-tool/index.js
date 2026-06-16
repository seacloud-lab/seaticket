import React from 'react';
import PropTypes from 'prop-types';
import Icon from '../icon';

import './index.css';

function CustomizeAddTool({ callBack, name, className, children }) {
  return (
    <div className={`customize-add-tool ${className || ''}`} onClick={(e) => {e.stopPropagation(); callBack(e);}}>
      <Icon symbol="plus" className="customize-add-tool-icon" />
      {name && <span className="text-truncate" title={name} aria-label={name}>{name}</span>}
      {children}
    </div>
  );
}

CustomizeAddTool.propTypes = {
  className: PropTypes.string,
  name: PropTypes.string,
  callBack: PropTypes.func.isRequired,
};

export default CustomizeAddTool;
