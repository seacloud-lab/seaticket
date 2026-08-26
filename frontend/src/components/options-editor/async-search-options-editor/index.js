import React, { useCallback, useRef } from 'react';
import classnames from 'classnames';
import CustomizePopover from '../../customize-popover';
import Container from './container';
import { areArraysEqual } from '@/utils/array-utils';

const AsyncSearchOptionsEditor = ({
  target,
  isMultiple = false,
  isCloseSubmit = false,
  placement,
  checkPlacement = 'right',
  optionClassName = '',
  contentClassName = '',
  placeholder,
  emptyTip,
  value,
  children,
  className,
  onChange,
  onToggle,
  onSearch,
}) => {
  const containerRef = useRef(null);

  const handleClose = useCallback(() => {
    if (!isCloseSubmit) {
      onToggle();
      return;
    }
    const newValue = containerRef.current.getValue();
    if (isMultiple) {
      if (!areArraysEqual(newValue, value)) {
        onChange(newValue);
      }
    } else {
      if (newValue !== value) {
        onChange(newValue);
      }
    }
    onToggle();
  }, [isMultiple, isCloseSubmit, value, onChange, onToggle]);

  return (
    <CustomizePopover
      target={target}
      className={classnames('options-editor-popover', className)}
      hidePopover={handleClose}
      hidePopoverWithEsc={handleClose}
      placement={placement}
    >
      <Container
        ref={containerRef}
        isMultiple={isMultiple}
        placeholder={placeholder}
        emptyTip={emptyTip}
        value={value}
        checkPlacement={checkPlacement}
        optionClassName={optionClassName}
        className={contentClassName}
        onChange={isCloseSubmit && !isMultiple ? () => {} : onChange}
        onToggle={onToggle}
        onSearch={onSearch}
      >
        {children}
      </Container>
    </CustomizePopover>
  );
};

export default AsyncSearchOptionsEditor;
