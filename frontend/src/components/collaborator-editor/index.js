import React, { useCallback, useRef } from 'react';
import classnames from 'classnames';
import CustomizePopover from '../customize-popover';
import Main from './main';
import { areArraysEqual } from '../../utils/array-utils';

import './index.css';

const CollaboratorEditor = ({
  id,
  target,
  className,
  isShowDeleteArea = true,
  isSearchEnabled = true,
  isMultiple = true,
  sameWidthWithTarget = false,
  placeholder,
  emptyTip,
  value = [],
  collaborators = [],
  onChange,
  onClose,
}) => {
  const mainRef = useRef(null);

  const handleSubmit = useCallback(() => {
    if (isMultiple) {
      const newValue = mainRef.current.getValue();
      if (!areArraysEqual(newValue, value)) {
        onChange(newValue);
      }
    }
    onClose();
  }, [isMultiple, value, onChange, onClose]);

  return (
    <CustomizePopover
      target={target}
      className={classnames('collaborator-editor-popover', className)}
      hidePopover={handleSubmit}
      hidePopoverWithEsc={handleSubmit}
      sameWidthWithTarget={sameWidthWithTarget}
    >
      <Main
        ref={mainRef}
        id={id}
        isShowDeleteArea={isShowDeleteArea}
        isSearchEnabled={isSearchEnabled}
        isMultiple={isMultiple}
        placeholder={placeholder}
        emptyTip={emptyTip}
        value={value}
        collaborators={collaborators}
        onToggle={onClose}
        onHidden={handleSubmit}
      />
    </CustomizePopover>

  );
};

export default CollaboratorEditor;
