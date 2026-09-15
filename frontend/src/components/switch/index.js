import React, { useRef } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import Tooltip from '../tooltip';

import './index.css';

function Switch({ onChange, checked, placeholder, disabled, className, textPosition = 'left', setRef, checkedTooltip, uncheckedTooltip, tooltipPosition, fontWeight = 500 }) {
  const switchRef = useRef(null);
  const tooltip = checked ? checkedTooltip : uncheckedTooltip;
  const setSwitchRef = (node) => {
    switchRef.current = node;
    if (setRef) setRef(node);
  };

  return (
    <>
      <div className={classnames('seaqa-switch position-relative', className, { 'disabled': disabled })}>
        <label className="custom-switch" ref={setSwitchRef}>
          <input
            className="custom-switch-input"
            type="checkbox"
            checked={checked}
            onChange={onChange}
            name="custom-switch-checkbox"
            disabled={disabled}
          />
          {placeholder && textPosition === 'left' &&
            <span className="custom-switch-description text-truncate" style={{ fontWeight }}>{placeholder}</span>
          }
          <span className={classnames('custom-switch-indicator', { 'disabled': disabled })}></span>
          {placeholder && textPosition === 'right' &&
            <span className="custom-switch-description text-truncate" style={{ fontWeight }}>{placeholder}</span>
          }
        </label>
      </div>
      {tooltip && <Tooltip target={switchRef} placement={tooltipPosition}>{tooltip}</Tooltip>}
    </>
  );
}

Switch.propTypes = {
  checked: PropTypes.bool,
  disabled: PropTypes.bool,
  placeholder: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  className: PropTypes.string,
  textPosition: PropTypes.oneOf(['left', 'right', undefined]),
  onChange: PropTypes.func,
  setRef: PropTypes.func,
  checkedTooltip: PropTypes.string,
  uncheckedTooltip: PropTypes.string,
  tooltipPosition: PropTypes.string,
  fontWeight: PropTypes.oneOf([400, 500]),
};

export default Switch;
