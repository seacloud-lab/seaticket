import React, { useCallback, useEffect, useState } from 'react';
import { LanguageSelect } from '@/components';
import { gettext } from '@/constants';
import SettingsItem from './settings-item';

const LanguageSettings = ({
  value: oldValue = 'en',
  onChange,
}) => {
  const [value, setValue] = useState(oldValue);

  useEffect(() => {
    setValue(oldValue || 'en');
  }, [oldValue]);

  const onValueChange = useCallback((newValue) => {
    setValue(newValue);
    onChange && onChange(newValue);
  }, [onChange]);

  return (
    <SettingsItem title={gettext('Language for AI output')} className="language-settings-option">
      <LanguageSelect
        value={value}
        placeholder={gettext('Language for AI output')}
        onChange={onValueChange}
      />
    </SettingsItem>
  );
};

export default LanguageSettings;
