import React, { useCallback } from 'react';
import classnames from 'classnames';

import './index.css';

const CustomizeTabs = ({
  tabs,
  value,
  className,
  onChange,
}) => {
  const handleChange = useCallback((event, newValue) => {
    event.nativeEvent.stopImmediatePropagation();
    event.stopPropagation();
    if (value === newValue) return;
    onChange && onChange(newValue);
  }, [value]);

  if (!Array.isArray(tabs) || tabs.length === 0) return null;
  return (
    <div className={classnames('sea-tickets-customize-tabs', className)}>
      {tabs.map(tab => {
        return (
          <div
            className={classnames('sea-tickets-customize-tab', { 'active': tab.value === value } )}
            key={tab.value}
            onClick={(event) => handleChange(event, tab.value)}
          >
            {tab.label}
          </div>
        );
      })}
    </div>
  );
};

export default CustomizeTabs;
