import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

import '../css/mobile-checkbox.css';

const propTypes = {
  checked: PropTypes.bool,
  disabled: PropTypes.bool,
  onCheckedChange: PropTypes.func.isRequired,
  name: PropTypes.string,
  value: PropTypes.any,
  labelClassName: PropTypes.string,
  inputClassName: PropTypes.string,
  children: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

function CheckboxView(props) {
  return (
    <label className={classnames('seatable-checkbox-view', { [props.labelClassName]: props.labelClassName })}>
      <input
        type="checkbox"
        className={classnames('seatable-checkbox-input', { [props.inputClassName]: props.inputClassName })}
        checked={props.checked}
        onChange={props.onCheckedChange}
        name={props.name}
        value={props.value}
        disabled={props.disabled}
      />
      <div className={classnames('seatable-checkbox-indicator', {
        'seatable-checkbox-selected-indicator': props.checked,
        'seatable-checkbox-disable': props.disabled
      })}>
      </div>
      {props.children}
    </label>
  );
}

CheckboxView.propTypes = propTypes;

export default CheckboxView;
