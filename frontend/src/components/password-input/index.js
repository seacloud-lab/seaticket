import React, { useState, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { InputGroup, Input } from 'reactstrap';
import classnames from 'classnames';
import StrengthChecker from './strength-checker';
import IconButton from '../icon-button';
import { Utils } from '@/utils/utils';
import { isFunction } from '@/utils/type-detection';

import './index.css';

const PasswordInput = ({
  value,
  size: initSize,
  className,
  disabled = false,
  enableRandomGeneration = false,
  autoFocus = false,
  enableCheckStrength = true,
  placeholder = '',
  onChange: onChangeValue,
  onShowChange,
}) => {
  const [password, setPassword] = useState(value || '');
  const [isShowPassword, setIsShowPassword] = useState(false);
  const [isShowChecker, setIsShowChecker] = useState(false);
  const [size, setSize] = useState(initSize || 38);

  const ref = useRef(null);

  const onChange = useCallback((newValue, isRandomGeneration) => {
    setPassword(newValue);
    onChangeValue(newValue, isRandomGeneration);
    if (!enableCheckStrength) return;
    setIsShowChecker(newValue.length > 0);
  }, [enableCheckStrength, onChangeValue]);

  const onChangePassword = useCallback((event) => {
    const newValue = event.target.value;
    onChange(newValue);
  }, [onChange]);

  const generatePassword = useCallback(() => {
    const password = Utils.generatePassword(8);
    onChange(password, true);
  }, [onChange]);

  const onFocus = useCallback(() => {
    if (!enableCheckStrength) return;
    if (!password) return;
    setIsShowChecker(true);
  }, [enableCheckStrength, password]);

  const onBlur = useCallback(() => {
    if (!isShowChecker) return;
    setIsShowChecker(false);
  }, [isShowChecker]);

  useEffect(() => {
    if (initSize) return;
    const { height } = ref.current.getBoundingClientRect();
    setSize(height);
  }, [initSize]);

  useEffect(() => {
    if (!onShowChange || !isFunction(onShowChange)) return;
    onShowChange(isShowPassword);
  }, [isShowPassword, onShowChange]);

  return (
    <InputGroup className={classnames('password-input-group position-relative', className)}>
      <Input
        innerRef={ref}
        autoFocus={autoFocus}
        disabled={disabled}
        autoComplete="new-password"
        type={isShowPassword ? 'text' : 'password'}
        value={value}
        placeholder={placeholder}
        onChange={onChangePassword}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      <IconButton
        disabled={disabled}
        icon={isShowPassword ? 'eye' : 'eye-slash'}
        className="password-op-icon btn btn-secondary p-0"
        style={{ height: size, width: size }}
        onClick={() => setIsShowPassword(!isShowPassword)}
      />
      {enableRandomGeneration && (
        <IconButton
          disabled={disabled}
          icon="generate-password"
          className="password-op-icon btn btn-secondary p-0"
          style={{ height: size, width: size }}
          onClick={generatePassword}
        />
      )}
      {enableCheckStrength && isShowChecker && (
        <StrengthChecker value={password} />
      )}
    </InputGroup>
  );
};

PasswordInput.propTypes = {
  autoFocus: PropTypes.bool,
  enableCheckStrength: PropTypes.bool,
  enableRandomGeneration: PropTypes.bool,
  value: PropTypes.string,
  size: PropTypes.number,
  onChange: PropTypes.func,
};

export default PasswordInput;
