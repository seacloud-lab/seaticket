import React, { useState, useCallback } from 'react';
import { Modal, ModalBody, ModalFooter } from 'reactstrap';
import { ModalHeader } from '@/components';
import { gettext } from '@/constants';
import toaster from '@/components/toaster';

import './edit-prompt-dialog.css';

const TAG_LIKE_PATTERN = /<[^>]+>/;

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
    if (TAG_LIKE_PATTERN.test(value || '')) {
      toaster.danger(gettext('Project prompt cannot contain tag-like content such as <system-reminder>.'));
      return;
    }
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
          placeholder={gettext('Provide the project background information for the AI to understand the project accurately. Enter your custom project prompt here...')}
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
