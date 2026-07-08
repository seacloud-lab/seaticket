import React, { useCallback, useState } from 'react';
import classnames from 'classnames';
import { Switch } from '@/components';

import './index.css';

const SwitchSettingsItem = ({
  title,
  tip,
  placeholder,
  className,
  value: oldValue = true,
  onChange,
}) => {
  const [value, setValue] = useState(oldValue);

  const onValueChange = useCallback(() => {
    const newValue = !value;
    setValue(newValue);
    onChange && onChange(newValue);
  }, [value, onChange]);

  return (
    <div className={classnames('switch-settings-option w-100 pl-4 pr-4', className)}>
      <div className="switch-settings-option-header text-truncate">{title}</div>
      <div className="switch-settings-option-body">
        <Switch
          checked={value}
          size="large"
          textPosition="right"
          className="change-settings-option-status w-100"
          onChange={onValueChange}
          placeholder={placeholder}
        />
        <p className="seaqa-tip-default tip m-0">
          {tip}
        </p>
      </div>
    </div>
  );
};

export default SwitchSettingsItem;
