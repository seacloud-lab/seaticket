import React, { Fragment } from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  selectedValue: PropTypes.bool,
  disabled: PropTypes.bool,
  handleToggleChange: PropTypes.func,
  innerRef: PropTypes.object,
  settingKey: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  switchPosition: PropTypes.string, // left or right
};

function CustomSwitch(props) {
  const { handleToggleChange, selectedValue, switchPosition, settingKey, disabled, innerRef } = props;
  let switchNode = <span className="custom-switch-indicator"></span>;
  let textNode = <span className="custom-switch-description text-truncate">{settingKey}</span>;
  return (
    <label className="custom-switch">
      <input type="checkbox" ref={innerRef} disabled={disabled} className="custom-switch-input" checked={selectedValue} onChange={handleToggleChange} name="custom-switch-checkbox" />
      {switchPosition === 'left' && <Fragment>{switchNode}{textNode}</Fragment>}
      {switchPosition === 'right' && <Fragment>{textNode}{switchNode}</Fragment>}
    </label>
  );
}

CustomSwitch.propTypes = propTypes;

CustomSwitch.defaultProps = {
  switchPosition: 'left',
  disabled: false
};

export default CustomSwitch;
