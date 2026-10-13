import React, { useEffect, useRef, useState } from 'react';
import { Button, FormGroup, Input, Label, Modal, ModalBody, ModalFooter, ModalHeader } from 'reactstrap';
import { gettext } from '@/constants';

const CustomerModal = ({ customer, isSubmitting, onClose, onSubmit, triggerRef }) => {
  const [name, setName] = useState(customer?.name || '');
  const [emailDomain, setEmailDomain] = useState(customer?.email_domain || '');
  const inputRef = useRef(null);
  const isEditing = Boolean(customer);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmedName = name.trim();
    if (!trimmedName || isSubmitting) return;
    onSubmit(trimmedName, emailDomain.trim());
  };

  const handleClosed = () => {
    triggerRef?.current?.focus();
  };

  return (
    <Modal isOpen={true} toggle={onClose} onClosed={handleClosed} className="portal-customer-dialog" autoFocus={false}>
      <ModalHeader toggle={onClose}>{isEditing ? gettext('Edit customer') : gettext('New customer')}</ModalHeader>
      <ModalBody>
        <FormGroup className="mb-0">
          <Label for="portal-customer-name">{gettext('Customer name')}</Label>
          <Input
            id="portal-customer-name"
            innerRef={inputRef}
            value={name}
            maxLength={255}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSubmit();
            }}
            autoFocus
          />
        </FormGroup>
        <FormGroup className="mt-3 mb-0">
          <Label for="portal-customer-email-domain">{gettext('Email domain (optional)')}</Label>
          <Input
            id="portal-customer-email-domain"
            value={emailDomain}
            maxLength={255}
            placeholder="example.com"
            onChange={(event) => setEmailDomain(event.target.value)}
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

export default CustomerModal;
