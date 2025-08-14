import React, { useCallback, useRef } from 'react';
import classnames from 'classnames';
import CustomizePopover from '../customize-popover';
import Main from './main';

import './index.css';


const OptionsEditor = ({
  target,
  isMultiple = false,
  placeholder,
  emptyTip,
  value,
  className,
  options = [],
  onChange,
  onToggle,
  onCreate,
}) => {
  const mainRef = useRef(null);

  const handleClose = useCallback(() => {
    if (isMultiple) {
      const value = mainRef.current.getValue();
      onChange(value);
    }
    onToggle();
  }, [isMultiple, onChange, onToggle]);

  return (
    <CustomizePopover
      target={target}
      className={classnames('option-editor-popover', className)}
      hidePopover={handleClose}
      hidePopoverWithEsc={handleClose}
    >
      <Main
        ref={mainRef}
        isMultiple={isMultiple}
        placeholder={placeholder}
        emptyTip={emptyTip}
        value={value}
        options={options}
        onChange={onChange}
        onToggle={onToggle}
        onCreate={onCreate}
      />
    </CustomizePopover>
  );
};

export default OptionsEditor;
