import React, { useRef } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import Tooltip from '../tooltip';

import './index.css';

function Switch({ onChange, checked, placeholder, disabled, className, size, textPosition = 'left', setRef, checkedTooltip, uncheckedTooltip, tooltipPosition }) {
  const switchRef = useRef(null);
  const tooltip = checked ? checkedTooltip : uncheckedTooltip;
  const setSwitchRef = (node) => {
    switchRef.current = node;
    if (setRef) setRef(node);
  };

  return (
    <>
      <div className={classnames('seaqa-switch position-relative', className, size, { 'disabled': disabled })} ref={setSwitchRef}>
        <label className="custom-switch">
          <input
            className="custom-switch-input"
            type="checkbox"
            checked={checked}
            onChange={onChange}
            name="custom-switch-checkbox"
            disabled={disabled}
          />
          {textPosition === 'left' &&
            <span className="custom-switch-description text-truncate">{placeholder}</span>
          }
          <span className={classnames('custom-switch-indicator', { 'disabled': disabled })}></span>
          {textPosition === 'right' &&
            <span className="custom-switch-description text-truncate">{placeholder}</span>
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
  size: PropTypes.oneOf(['large', 'small', undefined]),
  textPosition: PropTypes.oneOf(['left', 'right', undefined]),
  onChange: PropTypes.func,
  setRef: PropTypes.func,
  checkedTooltip: PropTypes.string,
  uncheckedTooltip: PropTypes.string,
  tooltipPosition: PropTypes.string,
};

export default Switch;
