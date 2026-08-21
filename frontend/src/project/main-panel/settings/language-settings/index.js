import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CustomizeSelect } from '@/components';
import { gettext } from '@/constants';
import SettingsItem from '../settings-item';

import './index.css';

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'zh-cn', label: '中文' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
];

const LanguageSettings = ({
  className,
  value: oldValue = 'en',
  onChange,
}) => {
  const [value, setValue] = useState(oldValue);

  useEffect(() => {
    setValue(oldValue || 'en');
  }, [oldValue]);

  const selectedOption = useMemo(() => {
    return LANGUAGE_OPTIONS.find(option => option.value === value) || LANGUAGE_OPTIONS[0];
  }, [value]);

  const onValueChange = useCallback((newValue) => {
    setValue(newValue);
    onChange && onChange(newValue);
  }, [onChange]);

  return (
    <SettingsItem title={gettext('Language for AI output')} className="language-settings-option">
      <CustomizeSelect
        className="language-selector"
        value={selectedOption}
        options={LANGUAGE_OPTIONS}
        placeholder={gettext('Language for AI output')}
        onChange={onValueChange}
      />
    </SettingsItem>
  );
};

export default LanguageSettings;
