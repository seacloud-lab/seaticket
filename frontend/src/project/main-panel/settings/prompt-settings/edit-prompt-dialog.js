import React, { useState, useCallback } from 'react';
import { Modal, ModalBody, ModalFooter } from 'reactstrap';
import { ModalHeader } from '@/components';
import { gettext } from '@/constants';

import './edit-prompt-dialog.css';

const EditPromptDialog = ({
  value: initialValue = '',
  onConfirm,
  onToggle,
}) => {
  const [value, setValue] = useState(initialValue);

  const handleInputChange = useCallback((e) => {
    setValue(e.target.value);
  }, []);

  const handleSubmit = useCallback(() => {
    onConfirm && onConfirm(value);
  }, [value, onConfirm]);

  return (
    <Modal isOpen={true} toggle={onToggle} className="edit-prompt-dialog">
      <ModalHeader toggle={onToggle}>{gettext('Edit Prompt')}</ModalHeader>
      <ModalBody>
        <textarea
          className="form-control edit-prompt-textarea"
          rows={10}
          value={value}
          onChange={handleInputChange}
          placeholder={gettext('Enter your custom prompt here...')}
          maxLength={4000}
        />
      </ModalBody>
      <ModalFooter>
        <button className="btn btn-secondary" onClick={onToggle}>{gettext('Cancel')}</button>
        <button className="btn btn-primary" onClick={handleSubmit}>{gettext('Submit')}</button>
      </ModalFooter>
    </Modal>
  );
};

export default EditPromptDialog;
