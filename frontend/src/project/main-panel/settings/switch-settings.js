import React, { useCallback } from 'react';
import classnames from 'classnames';
import { Switch } from '@/components';

const SwitchSettings = ({
  tip,
  placeholder,
  className,
  value = true,
  onChange,
}) => {
  const onValueChange = useCallback(() => {
    const newValue = !value;
    onChange && onChange(newValue);
  }, [value, onChange]);

  return (
    <>
      <Switch
        checked={value}
        size="large"
        textPosition="right"
        className={classnames('w-100 h-6 d-flex align-items-center', className)}
        onChange={onValueChange}
        placeholder={placeholder}
      />
      <p className="seaqa-tip-default m-0 font-size-12 line-height-20">
        {tip}
      </p>
    </>
  );
};

export default SwitchSettings;
