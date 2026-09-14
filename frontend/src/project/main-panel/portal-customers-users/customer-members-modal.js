import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from 'reactstrap';
import { CustomizeTable, EmptyTip, IconTooltip, UserSelect } from '@/components';
import { gettext } from '@/constants';

const mergeUsersByEmail = (...groups) => {
  const usersByEmail = new Map();
  groups.forEach(group => group.forEach(user => usersByEmail.set(user.email, user)));
  return Array.from(usersByEmail.values());
};

const MemberStatus = ({ value }) => <span>{value ? gettext('Activated') : gettext('Inactive')}</span>;

const TextCell = ({ value }) => <span className="text-truncate d-block" title={value}>{value}</span>;

const MembersOperations = ({ row, isRowActive, onDelete }) => {
  if (!isRowActive) return null;
  return (
    <div className="portal-customer-members-operation">
      <IconTooltip
        icon="delete"
        tip={gettext('Remove')}
        className="bg-color-deep"
        hoverBackground
        onClick={() => onDelete(row)}
        placement="bottom"
      />
    </div>
  );
};

const CustomerMembersModal = ({ customer, members, users, isLoading, isSubmitting, onClose, onSubmit }) => {
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [newMembers, setNewMembers] = useState(members || []);
  const selectableUsers = useMemo(() => users.filter(user => (
    !user.customer_id || user.customer_id === customer.id
  )), [customer.id, users]);
  const memberRows = useMemo(() => newMembers.map(member => ({ ...member, id: member.email })), [newMembers]);

  useEffect(() => {
    if (!isLoading) setNewMembers(members || []);
  }, [isLoading, members]);

  const searchUsers = useCallback((searchValue) => {
    const query = searchValue.trim().toLowerCase();
    const existingEmails = new Set(newMembers.map(member => member.email));
    return Promise.resolve({ data: { users: selectableUsers
      .filter(user => !existingEmails.has(user.email))
      .filter(user => !query || user.email.toLowerCase().includes(query))
      .map(user => ({ ...user, name: user.email, nickname: user.email })) } });
  }, [newMembers, selectableUsers]);

  const handlePopoverToggle = (isOpen) => {
    if (isOpen || selectedUsers.length === 0) return;
    setNewMembers(current => mergeUsersByEmail(current, selectedUsers));
    setSelectedUsers([]);
  };

  const handleDelete = (member) => {
    const updatedMembers = newMembers.filter(item => item.email !== member.email);
    setNewMembers(updatedMembers);
    onSubmit(updatedMembers, false);
  };

  const columns = useMemo(() => [
    { key: 'email', name: gettext('Email'), type: 'customer-member-email', width: 0.52, formatter: <TextCell /> },
    { key: 'activated', name: gettext('Status'), type: 'customer-member-status', width: 0.4, formatter: <MemberStatus /> },
    { key: 'op', name: '', type: 'customer-member-operation', width: 80, isFixed: true, formatter: <MembersOperations /> },
  ], []);

  return (
    <Modal isOpen={true} toggle={onClose} className="portal-customer-members-dialog">
      <ModalHeader toggle={onClose}>{gettext('Users management')}</ModalHeader>
      <ModalBody>
        <div className="portal-customer-members-form">
          <label htmlFor="portal-customer-member-select">{gettext('Add existing user')}</label>
          <UserSelect
            id="portal-customer-member-select"
            className="portal-customer-member-select"
            popoverClassName="portal-customer-user-select-popover"
            placeholder={gettext('Select assigned users')}
            searchPlaceholder={gettext('Search users')}
            emptyMessage={gettext('No unassigned users')}
            selectedUsers={selectedUsers}
            disabled={isLoading || isSubmitting}
            onSelectChange={setSelectedUsers}
            onPopoverToggle={handlePopoverToggle}
            api={searchUsers}
            allowEmptySearch={true}
            showDropdownIndicator={true}
            showSearchClearIcon={true}
            searchInputSize={32}
            popoverOffset={[0, 4]}
            hideSearchWhenEmpty={true}
            matchTargetWidth={true}
            isMulti={true}
          />
        </div>
        {isLoading ? (
          <div className="portal-customer-members-empty"><EmptyTip text={gettext('Loading...')} /></div>
        ) : memberRows.length > 0 ? (
          <CustomizeTable
            className="portal-customer-members-table"
            columns={columns}
            rows={memberRows}
            rowHeight={40}
            onDelete={handleDelete}
          />
        ) : (
          <div className="portal-customer-members-empty"><EmptyTip text={gettext('No users')} /></div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={onClose}>{gettext('Cancel')}</Button>
        <Button color="primary" disabled={isLoading || isSubmitting} onClick={() => onSubmit(newMembers)}>{gettext('Submit')}</Button>
      </ModalFooter>
    </Modal>
  );
};

export default CustomerMembersModal;
