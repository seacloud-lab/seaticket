import React, { useCallback, useMemo } from 'react';
import classNames from 'classnames';
import CustomizeSelect from '@/components/customize-select';
import { langList } from '@/constants';

import './index.css';

const LanguageSelect = ({ value, className, placeholder, onChange }) => {

  const options = useMemo(() => {
    return Array.isArray(langList) && langList.length > 0 ? langList.map((item) => {
      return {
        value: item.langCode,
        label: item.langName
      };
    }) : [];
  }, []);

  const handleChange = useCallback((newValue) => {
    if (newValue === value) return;
    onChange && onChange(newValue);
  }, [value, onChange]);

  return (
    <CustomizeSelect
      className={classNames('seaqa-language-select', className)}
      value={value || options[0]?.value}
      options={options}
      placeholder={placeholder}
      onChange={handleChange}
    />
  );
};

export default LanguageSelect;
