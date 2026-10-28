import React, { useRef, useState } from 'react';
import { Button, FormGroup, Input, Label, Modal, ModalBody, ModalFooter, ModalHeader } from 'reactstrap';
import { CustomizeSelect, Option } from '@/components';
import { gettext } from '@/constants';
import { STATUS_OPTIONS } from './constants';

const statusOptions = STATUS_OPTIONS.map(option => ({
  value: option.id,
  label: <Option option={option} />,
}));

const UserModal = ({ user, isSubmitting, onClose, onSubmit }) => {
  const [name, setName] = useState(user.name || '');
  const [status, setStatus] = useState(user.activated ? '1' : '0');
  const inputRef = useRef(null);

  const handleSubmit = () => {
    const trimmedName = name.trim();
    if (!trimmedName || isSubmitting) return;
    onSubmit(trimmedName, status === '1');
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
            maxLength={255}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) handleSubmit();
            }}
          />
        </FormGroup>
        <FormGroup className="mt-3 mb-0" role="group" aria-labelledby="portal-user-status-label">
          <Label id="portal-user-status-label">{gettext('Status')}</Label>
          <CustomizeSelect
            id="portal-user-status"
            value={status}
            options={statusOptions}
            onChange={setStatus}
            disabled={isSubmitting}
            isInModal={true}
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
