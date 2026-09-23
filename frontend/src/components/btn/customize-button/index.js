import React from 'react';
import PropTypes from 'prop-types';
import Icon from '../../icon';

import './index.css';

function CustomizeButton({ callBack, name, className, children, icon = 'plus', disabled = false }) {
  return (
    <div
      className={`customize-button px-3 font-size-14 d-flex align-items-center ${disabled ? 'disabled' : ''} ${className || ''}`}
      title={name}
      aria-label={name}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={disabled ? undefined : (e) => {e.stopPropagation(); callBack(e);}}
    >
      <Icon symbol={icon} className="customize-button-icon mr-2" aria-hidden="true" />
      {name && <span className="text-truncate" title={name} aria-label={name}>{name}</span>}
      {children}
    </div>
  );
}

CustomizeButton.propTypes = {
  icon: PropTypes.string,
  className: PropTypes.string,
  name: PropTypes.string,
  callBack: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

export default CustomizeButton;
