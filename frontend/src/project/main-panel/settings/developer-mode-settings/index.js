import React, { useCallback, useState } from 'react';
import { Switch } from '@/components';
import { gettext } from '@/constants';

import './index.css';

const DeveloperModeSettings = ({
  value: oldValue = false,
  onChange,
}) => {
  const [value, setValue] = useState(oldValue);

  const onValueChange = useCallback(() => {
    const newValue = !value;
    setValue(newValue);
    onChange && onChange(newValue);
  }, [value]);

  return (
    <>
      <div className="developer-mode-settings-header text-truncate">{gettext('Developer mode')}</div>
      <div className="developer-mode-settings">
        <Switch
          checked={value}
          size="large"
          textPosition="right"
          className="change-developer-mode-status w-100"
          onChange={onValueChange}
          placeholder={gettext('Developer mode')}
        />
        <p className="tip-default tip m-0">
          {gettext('Enable developer mode to show advanced features for development and debugging purposes.')}
        </p>
      </div>
    </>
  );
};

export default DeveloperModeSettings;
