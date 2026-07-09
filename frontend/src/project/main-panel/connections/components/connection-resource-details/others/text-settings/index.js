import React, { useCallback, useRef, useState } from 'react';
import classnames from 'classnames';
import { CustomizeLabel } from '@/components';
import { isEnter } from '@/utils/hotkey';
import { Input } from 'reactstrap';

const TextSettings = ({
  isReadonly,
  value: propsValue,
  column,
  className = 'mb-4',
  onChange,
}) => {
  const [value, setValue] = useState(propsValue || '');

  const inputRef = useRef(null);

  const onSubmit = useCallback(() => {
    const validValue = value.trim();
    if (propsValue === validValue) return;
    onChange && onChange(validValue);
  }, [value, propsValue, onChange]);

  const onValueChange = useCallback((event) => {
    const newValue = event.target.value;
    if (newValue === value) return;
    setValue(newValue);
  }, [value]);

  const onKeyDown = useCallback((event) => {
    if (isEnter(event)) {
      inputRef.current.blur();
    }
  }, []);

  return (
    <div className={classnames('seaqa-settings-item', className)}>
      <CustomizeLabel icon="text">
        {column?.name}
      </CustomizeLabel>
      <div className={classnames('seaqa-settings-text-formatter mb-2', { 'cursor-pointer': !isReadonly })}>
        {isReadonly ? (
          <>{value}</>
        ) : (
          <Input
            innerRef={inputRef}
            value={value}
            onChange={onValueChange}
            onBlur={onSubmit}
            onKeyDown={onKeyDown}
          />
        )}
      </div>
    </div>
  );
};

export default TextSettings;
