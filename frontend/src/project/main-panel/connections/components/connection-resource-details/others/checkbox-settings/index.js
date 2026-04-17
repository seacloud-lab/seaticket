import React, { useCallback } from 'react';
import classnames from 'classnames';
import { CustomizeLabel, Icon } from '@/components';

import './index.css';

const CheckboxSettings = ({
  isReadonly,
  title,
  className,
  value,
  onChange,
}) => {

  const handleClick = useCallback((event) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    if (isReadonly) return;
    onChange && onChange(!value);
  }, [isReadonly, value, onChange]);

  return (
    <div className={classnames('sea-ticket-settings-item', className)}>
      <CustomizeLabel icon="link">{title}</CustomizeLabel>
      <div className="sea-ticket-checkbox-settings-formatter valid">
        <div className={classnames('sea-ticket-checkbox-settings-btn', { 'cursor-pointer': !isReadonly })} onClick={handleClick} >
          {value && (<Icon symbol="check-mark" />)}
        </div>
      </div>
    </div>
  );
};

export default CheckboxSettings;
