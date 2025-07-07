import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

import './index.css';

function Radio({
  disabled = false,
  name = 'sea-qa-radio-input',
  onCheckedChange = () => {},
  className,
  isChecked,
  value,
  label
}) {

  return (
    <label
      className={classnames('sea-qa-radio w-100 align-items-center position-relative', {
        'sea-qa-radio-disable': disabled,
        [className]: className
      })}
    >
      <input
        type="radio"
        className="sea-qa-radio-input position-absolute"
        checked={isChecked}
        onChange={disabled ? () => {} : onCheckedChange}
        name={name}
        value={value}
      />
      <span
        className={classnames('sea-qa-radio-indicator position-relative', {
          'sea-qa-radio-selected-indicator': isChecked,
          'sea-qa-radio-indicator-disable': disabled
        })}
      >
      </span>
      <span className="sea-qa-radio-description text-truncate ml-2">{label}</span>
    </label>
  );
}

Radio.propTypes = {
  isChecked: PropTypes.bool,
  label: PropTypes.oneOfType([PropTypes.node, PropTypes.string]),
  disabled: PropTypes.bool,
  name: PropTypes.string,
  value: PropTypes.any,
  className: PropTypes.string,
  onCheckedChange: PropTypes.func,
};

export default Radio;
