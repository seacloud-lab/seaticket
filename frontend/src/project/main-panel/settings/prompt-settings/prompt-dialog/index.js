import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { ModalHeader } from '@/components';
import toaster from '@/components/toaster';
import { gettext } from '@/constants';

import './index.css';

const TAG_LIKE_PATTERN = /<[^>]+>/;

const PromptDialog = ({
  value: initialValue = '',
  onConfirm,
  onToggle,
  title = gettext('Edit prompt'),
  placeholder = gettext('Provide the project background information for the AI to understand the project accurately. Enter your custom project prompt here...'),
  maxLength = 4000,
  validationMessage = gettext('Project prompt cannot contain tag-like content such as <system-reminder>.'),
}) => {
  const [value, setValue] = useState(initialValue);

  const textareaRef = useRef(null);

  const isValid = useMemo(() => {
    const validValue = value?.trim() || '';
    if (initialValue) return validValue !== initialValue;
    return Boolean(validValue);
  }, [initialValue, value]);

  const focusAtEnd = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.focus();
    const end = textarea.value.length;
    textarea.setSelectionRange(end, end);
  }, []);

  const handleInputChange = useCallback((e) => {
    setValue(e.target.value);
  }, []);

  const handleSubmit = useCallback(() => {
    if (TAG_LIKE_PATTERN.test(value || '')) {
      toaster.danger(validationMessage);
      return;
    }
    const validValue = value?.trim() || '';
    onConfirm && onConfirm(validValue);
  }, [value, onConfirm, validationMessage]);

  return (
    <Modal isOpen={true} toggle={onToggle} autoFocus={false} onOpened={focusAtEnd} className="edit-prompt-dialog">
      <ModalHeader toggle={onToggle}>{title}</ModalHeader>
      <ModalBody>
        <textarea
          ref={textareaRef}
          className="form-control edit-prompt-textarea"
          rows={10}
          value={value}
          autoFocus={true}
          onChange={handleInputChange}
          placeholder={placeholder}
          maxLength={maxLength}
        />
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={onToggle}>{gettext('Cancel')}</Button>
        <Button color="primary" disabled={!isValid} onClick={handleSubmit}>{gettext('Submit')}</Button>
      </ModalFooter>
    </Modal>
  );
};

export default PromptDialog;
