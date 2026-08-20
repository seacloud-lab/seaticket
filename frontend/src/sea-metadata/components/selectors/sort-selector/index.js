import React, { useCallback } from 'react';
import { CustomizeSelect } from '@/components';
import { SORT_TYPES } from '@/sea-metadata/constants';

const SortSelector = ({ disabled, value, onChange }) => {

  const handleChange = useCallback((newValue) => {
    if (value === newValue) return;
    onChange && onChange(newValue);
  }, [value, onChange]);

  return (
    <CustomizeSelect
      disabled={disabled}
      value={value}
      options={SORT_TYPES}
      containerClassName="sea-metadata-sort-select-container"
      onChange={handleChange}
    />
  );
};

export default SortSelector;
