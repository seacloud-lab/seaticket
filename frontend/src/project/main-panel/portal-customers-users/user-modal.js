import React, { useRef, useState } from 'react';
import { Button, FormGroup, Input, Label, Modal, ModalBody, ModalFooter, ModalHeader } from 'reactstrap';
import { gettext } from '@/constants';

const UserModal = ({ user, isSubmitting, onClose, onSubmit }) => {
  const [name, setName] = useState(user.name || '');
  const inputRef = useRef(null);

  const handleSubmit = () => {
    const trimmedName = name.trim();
    if (!trimmedName || isSubmitting) return;
    onSubmit(trimmedName);
  };

  return (
    <Modal
      isOpen={true}
      toggle={onClose}
      className="portal-user-dialog"
      autoFocus={false}
      onOpened={() => inputRef.current?.focus()}
    >
      <ModalHeader toggle={onClose}>{gettext('Edit user')}</ModalHeader>
      <ModalBody>
        <FormGroup className="mb-0">
          <Label for="portal-user-name">{gettext('User name')}</Label>
          <Input
            id="portal-user-name"
            innerRef={inputRef}
            value={name}
            disabled={isSubmitting}
            maxLength={255}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) handleSubmit();
            }}
          />
        </FormGroup>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={onClose}>{gettext('Cancel')}</Button>
        <Button color="primary" disabled={isSubmitting || !name.trim()} onClick={handleSubmit}>
          {gettext('Submit')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default UserModal;
