import React, { useCallback, useState } from 'react';
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClick = useCallback((event) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    if (isReadonly || isSubmitting) return;
    setIsSubmitting(true);
    onChange && onChange(!value, () => {
      setIsSubmitting(false);
    });
  }, [isReadonly, isSubmitting, value, onChange]);

  return (
    <div className={classnames('sea-ticket-settings-item', className)}>
      <CustomizeLabel icon="check-box">{title}</CustomizeLabel>
      <div className="sea-ticket-checkbox-settings-formatter valid">
        <div className={classnames('sea-ticket-checkbox-settings-btn', { 'cursor-pointer': !isReadonly && !isSubmitting })} onClick={handleClick} >
          {value && (<Icon symbol="check-mark" />)}
        </div>
      </div>
    </div>
  );
};

export default CheckboxSettings;
