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
    <CustomizePopover
      target={target}
      className={classnames('options-editor-popover', className)}
      placement={placement}
      modifiers={modifiers}
      sameWidthWithTarget={sameWidthWithTarget}
      hidePopover={handleClose}
      hidePopoverWithEsc={handleClose}
    >
      <Container
        id={id}
        innerRef={containerRef}
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
    </CustomizePopover>
  );
};

export default CollaboratorEditor;
