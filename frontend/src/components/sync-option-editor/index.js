import React, { useCallback, useRef } from 'react';
import classnames from 'classnames';
import CustomizePopover from '../customize-popover';
import OptionEditorContainer from './option-editor-container';

import './index.css';

const SyncOptionsEditor = ({
  target,
  isMultiple = false,
  placement,
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
  const optionEditorContainerRef = useRef(null);

  const handleClose = useCallback(() => {
    if (isMultiple) {
      const value = optionEditorContainerRef.current.getValue();
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
      placement={placement}
    >
      <OptionEditorContainer
        ref={optionEditorContainerRef}
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
