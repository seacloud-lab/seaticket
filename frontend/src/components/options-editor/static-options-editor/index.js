import React, { useCallback, useRef } from 'react';
import classnames from 'classnames';
import CustomizePopover from '../../customize-popover';
import Container from './container';
import { areArraysEqual } from '@/utils/array-utils';

const StaticOptionsEditor = ({
  id,
  target,
  isCloseSubmit = false,
  isMultiple = false,
  isAsyncSearch = false,
  isSearchEnabled = true,
  sameWidthWithTarget = false,
  checkPlacement = 'right',
  optionClassName = '',
  contentClassName = '',
  placeholder,
  placement,
  emptyTip,
  value,
  className,
  options = [],
  optionHeight,
  modifiers = [
    { name: 'preventOverflow', options: { boundary: document.body } },
    { name: 'offset', options: { offset: [0, 4] } }
  ],
  onChange,
  onToggle,
  onCreate,
  children,
  defaultHighlightIndex,
  isShowSearchIcon = false,
  searchHeight,
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
        ref={containerRef}
        isMultiple={isMultiple}
        placeholder={placeholder}
        isAsyncSearch={isAsyncSearch}
        isSearchEnabled={isSearchEnabled}
        checkPlacement={checkPlacement}
        optionClassName={optionClassName}
        className={contentClassName}
        emptyTip={emptyTip}
        value={value}
        options={options}
        optionHeight={optionHeight}
        onChange={isCloseSubmit && !isMultiple ? () => {} : onChange}
        onToggle={onToggle}
        onCreate={onCreate}
        defaultHighlightIndex={defaultHighlightIndex}
        isShowSearchIcon={isShowSearchIcon}
        searchHeight={searchHeight}
      >
        {children}
      </Container>
    </CustomizePopover>
  );
};

export default StaticOptionsEditor;
