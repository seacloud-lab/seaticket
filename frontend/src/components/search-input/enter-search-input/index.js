import React, { useCallback, useState } from 'react';
import classnames from 'classnames';
import SearchInput from '../search-input';
import { isEnter } from '@/utils/hotkey';

const EnterSearchInput = ({ value: propsValue, placeholder, className, onSubmit }) => {
  const [value, setValue] = useState(propsValue);

  const onChange = useCallback((value) => {
    setValue(value);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!value) {
      return false;
    }
    onSubmit && onSubmit(value);
  }, [value, onSubmit]);

  const onKeyDown = useCallback((event) => {
    if (isEnter(event)) {
      event.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <SearchInput
      className={classnames('h-6 mr-1', className)}
      placeholder={placeholder}
      style={{ width: '15rem' }}
      size={32}
      onChange={onChange}
      onKeyDown={onKeyDown}
    />
  );
};

export default EnterSearchInput;
