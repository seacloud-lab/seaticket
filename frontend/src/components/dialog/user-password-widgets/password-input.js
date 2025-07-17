import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FormGroup, Label, InputGroup, Input } from 'reactstrap';
import classnames from 'classnames';
import PasswordStrengthChecker from './password-strength-checker';
import { isMobile } from '../../../utils/utils';
import IconButton from '../../icon-button';

import '../../../css/password-input.css';

const propTypes = {
  value: PropTypes.string,
  labelValue: PropTypes.string,
  shouldAutoFocus: PropTypes.bool,
  enableCheckStrength: PropTypes.bool,
  onChangeValue: PropTypes.func,
};

const PasswordInput = ({ value, labelValue, shouldAutoFocus, enableCheckStrength, onChangeValue }) => {
  const [passwordValue, setPasswordValue] = useState(value || '');
  const [isShowPassword, setIsShowPassword] = useState(false);
  const [isShowChecker, setIsShowChecker] = useState(false);

  const inputRef = useRef(null);

  useEffect(() => {
    if (shouldAutoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [shouldAutoFocus]);

  const changePasswordValue = (e) => {
    const updatedValue = e.target.value;
    if (updatedValue.length > 0) {
      setIsShowChecker(true);
    } else {
      setIsShowChecker(false);
    }
    onChangeValue(updatedValue);
    setPasswordValue(updatedValue);
  };

  const handleFocus = () => {
    if (enableCheckStrength && passwordValue.length > 0) {
      setIsShowChecker(true);
    }
  };

  const handleBlur = () => {
    if (enableCheckStrength) {
      setIsShowChecker(false);
    }
  };

  return (
    <FormGroup className={classnames('password-input-container position-relative', { 'mobile': isMobile })}>
      <Label>{labelValue}</Label>
      <InputGroup className='password'>
        <Input
          innerRef={inputRef}
          type={isShowPassword ? 'text' : 'password'}
          value={value}
          onChange={changePasswordValue}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        {isShowChecker && enableCheckStrength && (
          <PasswordStrengthChecker
            passwordValue={passwordValue}
          />
        )}
        <IconButton
          onClick={() => setIsShowPassword(!isShowPassword)}
          icon={isShowPassword ? 'eye' : 'eye-slash'}
          className="password-icon btn btn-secondary"
          style={{ height: 38, width: 38 }}
        />
      </InputGroup>
    </FormGroup>
  );
};

PasswordInput.propTypes = propTypes;

PasswordInput.defaultProps = {
  enableCheckStrength: true,
  shouldAutoFocus: false
};

export default PasswordInput;
