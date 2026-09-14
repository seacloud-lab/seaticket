import React, { useState } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import CustomModalHeader from '@/components/modal-header';
import { gettext } from '@/constants';
import InviteUsersPage from '@/portal/main-panel/user-management/invite-users-page';

import '@/portal/main-panel/user-management/index.css';

const InviteUsersDialog = ({ customers, invitations, isSubmitting, onInvite, onCopy, onRevoke, onClose }) => {
  const [email, setEmail] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  const invite = () => {
    const inviteEmail = email.trim();
    if (!inviteEmail || isSubmitting) return;
    onInvite(inviteEmail, selectedCustomerId || null, () => setEmail(''));
  };

  return (
    <Modal isOpen={true} toggle={onClose} className="portal-invite-users-dialog">
      <CustomModalHeader toggle={onClose}>{gettext('Invite users')}</CustomModalHeader>
      <ModalBody>
        <InviteUsersPage
          invitations={invitations}
          email={email}
          selectedCustomerId={selectedCustomerId}
          customers={customers}
          isInModal={true}
          isSubmitting={isSubmitting}
          onEmailChange={setEmail}
          onCustomerChange={setSelectedCustomerId}
          onInvite={invite}
          onCopy={onCopy}
          onRevoke={onRevoke}
        />
      </ModalBody>
    </Modal>
  );
};

export default InviteUsersDialog;
