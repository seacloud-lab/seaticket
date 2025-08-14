import React, { useCallback, useRef } from 'react';
import CustomizePopover from '../customize-popover';
import Main from './main';

import './index.css';

const CollaboratorEditor = ({
  target,
  isShowDeleteArea = true,
  placeholder,
  emptyTip,
  value = [],
  collaborators = [],
  onChange,
  onClose,
}) => {
  const mainRef = useRef(null);

  const handleSubmit = useCallback(() => {
    const value = mainRef.current.getValue();
    onChange(value);
    onClose();
  }, [onChange, onClose]);

  return (
    <CustomizePopover
      target={target}
      className="collaborator-editor-popover"
      hidePopover={handleSubmit}
      hidePopoverWithEsc={handleSubmit}
    >
      <Main ref={mainRef} isShowDeleteArea={isShowDeleteArea} placeholder={placeholder} emptyTip={emptyTip} value={value} collaborators={collaborators} />
    </CustomizePopover>

  );
};

export default CollaboratorEditor;
