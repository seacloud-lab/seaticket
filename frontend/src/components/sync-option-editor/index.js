import React, { useCallback, useRef } from 'react';
import classnames from 'classnames';
import CustomizePopover from '../customize-popover';
import Main from './main';

import './index.css';

const SyncOptionsEditor = ({
  target,
  isMultiple = false,
  checkPlacement = 'right',
  optionClassName = '',
  contentClassName = '',
  placeholder,
  emptyTip,
  value,
  className,
  onChange,
  onToggle,
  onSearch,
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
      className={classnames('option-editor-popover sync-option-editor-popover', className)}
      hidePopover={handleClose}
      hidePopoverWithEsc={handleClose}
    >
      <Main
        ref={mainRef}
        isMultiple={isMultiple}
        placeholder={placeholder}
        emptyTip={emptyTip}
        value={value}
        checkPlacement={checkPlacement}
        optionClassName={optionClassName}
        className={contentClassName}
        onChange={onChange}
        onToggle={onToggle}
        onSearch={onSearch}
      />
    </CustomizePopover>
  );
};

export default SyncOptionsEditor;
