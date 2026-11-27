import React, { useCallback, useRef } from 'react';
import classnames from 'classnames';
import { areArraysEqual } from '../../utils/array-utils';
import CustomizePopover from '../customize-popover';
import Container from './container';

const CollaboratorEditor = ({
  id,
  target,
  className,
  placement,
  isSearchEnabled = true,
  isMultiple = true,
  isCloseSubmit = false,
  sameWidthWithTarget = false,
  placeholder,
  emptyTip,
  value = [],
  collaborators = [],
  modifiers = [
    { name: 'preventOverflow', options: { boundary: document.body } },
    { name: 'offset', options: { offset: [0, 4] } }
  ],
  onChange,
  onClose: onToggle,
  PopoverComponent = CustomizePopover,
  shouldHandleEvent,
  ...props
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
    <PopoverComponent
      target={target}
      className={classnames('options-editor-popover', className)}
      placement={placement}
      modifiers={modifiers}
      sameWidthWithTarget={sameWidthWithTarget}
      hidePopover={handleClose}
      hidePopoverWithEsc={handleClose}
      shouldHandleEvent={shouldHandleEvent}
    >
      <Container
        id={id}
        innerRef={containerRef}
        shouldHandleEvent={shouldHandleEvent}
        isMultiple={isMultiple}
        placeholder={placeholder}
        isSearchEnabled={isSearchEnabled}
        emptyTip={emptyTip}
        collaborators={collaborators}
        value={value}
        onChange={isCloseSubmit && isMultiple ? () => {} : onChange}
        onToggle={onToggle}
        { ...props }
      />
    </PopoverComponent>
  );
};

export default CollaboratorEditor;
