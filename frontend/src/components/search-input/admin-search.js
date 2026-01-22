import React, { useCallback, useState } from 'react';
import SearchInput from '../search-input';
import { isEnter } from '@/utils/hotkey';

import './admin-search.css';

const AdminSearch = ({ value: propsValue, placeholder, onSubmit }) => {
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
      className='admin-search-input'
      placeholder={placeholder}
      style={{ width: '15rem' }}
      size={32}
      onChange={onChange}
      onKeyDown={onKeyDown}
    />
  );
};

export default AdminSearch;
