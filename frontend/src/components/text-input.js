import React, { useCallback } from 'react';
import { Input } from 'reactstrap';

const TextInput = ({
  disabled,
  value,
  placeholder,
  onChange: onValueCHange
}) => {
  const onChange = useCallback((event) => {
    const newValue = event.target.value;
    if (value === newValue) return;
    onValueCHange(newValue);
  }, [value, onValueCHange]);

  return (
    <Input value={value} placeholder={placeholder} onChange={onChange} disabled={disabled} />
  );
};

export default TextInput;
