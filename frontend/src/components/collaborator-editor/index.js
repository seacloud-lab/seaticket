import React, { useCallback, useRef } from 'react';
import CustomizePopover from '../customize-popover';
import Main from './main';
import { areArraysEqual } from '../../utils/array-utils';

import './index.css';

const CollaboratorEditor = ({
  target,
  isShowDeleteArea = true,
  isSearchEnabled = true,
  isMultiple = true,
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
  }, [value, onChange, onClose]);

  return (
    <CustomizePopover
      target={target}
      className="collaborator-editor-popover"
      hidePopover={handleSubmit}
      hidePopoverWithEsc={handleSubmit}
    >
      <Main
        ref={mainRef}
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
