import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Nav, NavItem, NavLink, Button, Input, FormGroup } from 'reactstrap';
import {
  CommonOperationConfirmationDialog, CustomizeTable, EmptyTip,
  toaster, IconButton, UserSelect,
} from '@/components';
import { gettext, mediaUrl } from '@/constants';
import dayjs from '@/utils/dayjs';
import { portalAPI } from '../api';
import InviteUsersPage from './user-management/invite-users-page';
import OperationButton from './user-management/operation-button';
import UsersPage from './user-management/users-page';

import './user-management/index.css';

const Tabs = {
  CUSTOMERS: 'customers',
  USERS: 'users',
  INVITE_USERS: 'invite_users',
};

const TextCellFormatter = ({ value }) => (
  <span className="text-truncate d-block" title={value}>{value}</span>
);

const mergeUsersByEmail = (...userGroups) => {
  const usersByEmail = new Map();
  userGroups.forEach(group => group.forEach(user => usersByEmail.set(user.email, user)));
  return Array.from(usersByEmail.values());
};

const getMemberEmails = (...userGroups) => mergeUsersByEmail(...userGroups).map(user => user.email);

const getSelectableUsers = (users, excludedUsers, searchValue) => {
  const normalizedSearchValue = searchValue.trim().toLowerCase();
  const excludedEmails = new Set(excludedUsers.map(user => user.email));
  return users
    .filter(user => !excludedEmails.has(user.email))
    .filter(user => !normalizedSearchValue || user.email.toLowerCase().includes(normalizedSearchValue))
    .map(user => ({ ...user, name: user.email, nickname: user.email }));
};

const CustomerStatusFormatter = ({ value }) => (
  <span>{value === 'active' ? gettext('Active') : gettext('Disabled')}</span>
);

const CustomerUpdatedFormatter = ({ value }) => (
  <span>{value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'}</span>
);

const CustomerOperationsFormatter = ({ row, isRowActive, onModify, onDelete }) => {
  if (!isRowActive) return null;
  return (
    <div className="portal-customer-operation-btns">
      <OperationButton icon="rename" tip={gettext('Edit')} onClick={() => onModify(row)} />
      <OperationButton icon="delete" tip={gettext('Delete')} onClick={() => onDelete(row)} />
    </div>
  );
};

const CustomerMemberStatusFormatter = ({ value }) => (
  <span>{value ? gettext('Activated') : gettext('Inactive')}</span>
);

const CustomerMemberOperationsFormatter = ({ row, isRowActive, onDelete }) => {
  if (!isRowActive) return null;
  return (
    <div className="portal-customer-operation-btns">
      <OperationButton icon="delete" tip={gettext('Remove')} onClick={() => onDelete(row)} />
    </div>
  );
};

const UserManagement = ({ projectUuid }) => {
  const [activeTab, setActiveTab] = useState(Tabs.CUSTOMERS);
  const [email, setEmail] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [invitations, setInvitations] = useState([]);
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState([]);
  const [isCreatingCustomer, setCreatingCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [selectedCustomerUsers, setSelectedCustomerUsers] = useState([]);
  const [newCustomerMembers, setNewCustomerMembers] = useState([]);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [selectedInviteCustomerId, setSelectedInviteCustomerId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [selectedEditCustomerUsers, setSelectedEditCustomerUsers] = useState([]);
  const [editCustomerMembers, setEditCustomerMembers] = useState([]);

  const loadInvites = useCallback(() => {
    portalAPI.listExternalInvitations(projectUuid).then(res => {
      setInvitations((res.data && res.data.invite_list) || []);
    });
  }, [projectUuid]);

  const loadUsers = useCallback(() => {
    portalAPI.listExternalUsers(projectUuid).then(res => {
      setUsers((res.data && res.data.users) || []);
    });
  }, [projectUuid]);

  const loadCustomers = useCallback(() => {
    portalAPI.listCustomers(projectUuid).then(res => {
      setCustomers((res.data && res.data.customers) || []);
    }).catch(() => toaster.danger(gettext('Failed to load customers')));
  }, [projectUuid]);

  const loadCustomerDetail = useCallback((customerId) => {
    return portalAPI.getCustomer(projectUuid, customerId).then(res => {
      setCustomerDetail(res.data);
      setEditCustomerMembers(res.data?.members || []);
    }).catch(() => toaster.danger(gettext('Failed to load customer details')));
  }, [projectUuid]);

  useEffect(() => { loadCustomers(); loadUsers(); loadInvites(); }, [loadCustomers, loadUsers, loadInvites]);

  const activeCustomers = useMemo(() => customers.filter(customer => customer.status === 'active'), [customers]);
  const unassignedUsers = useMemo(() => users.filter(user => !user.customer_id), [users]);

  const inviteUser = useCallback(() => {
    const inviteEmail = email.trim();
    if (!inviteEmail) return;
    setSubmitting(true);
    portalAPI.createExternalInvitation(projectUuid, inviteEmail, selectedInviteCustomerId || null).then(() => {
      toaster.success(gettext('Link generated'));
      loadInvites();
      loadUsers();
      setEmail('');
    }).catch((error) => {
      const serverDetail = error.response?.data?.detail;
      const serverMsg = error.response?.data?.error_msg;
      toaster.danger(serverDetail || serverMsg || gettext('Failed to generate invitation link'));
    }).finally(() => setSubmitting(false));
  }, [email, selectedInviteCustomerId, projectUuid, loadInvites, loadUsers]);

  const closeCreateCustomer = useCallback(() => {
    setCreatingCustomer(false);
    setNewCustomerName('');
    setSelectedCustomerUsers([]);
    setNewCustomerMembers([]);
  }, []);

  const createCustomer = useCallback(() => {
    const name = newCustomerName.trim();
    if (!name || isSubmitting) return;
    setSubmitting(true);
    portalAPI.createCustomer(projectUuid, {
      name,
      member_emails: getMemberEmails(newCustomerMembers, selectedCustomerUsers),
    }).then(() => {
      toaster.success(gettext('Customer created'));
      loadCustomers();
      loadUsers();
      closeCreateCustomer();
    }).catch((error) => {
      toaster.danger(error.response?.data?.error_msg || gettext('Failed to create customer'));
    }).finally(() => setSubmitting(false));
  }, [
    newCustomerName, newCustomerMembers, selectedCustomerUsers, isSubmitting,
    projectUuid, loadCustomers, loadUsers, closeCreateCustomer,
  ]);

  const searchUnassignedUsers = useCallback((searchValue) => {
    return Promise.resolve({ data: { users: getSelectableUsers(unassignedUsers, newCustomerMembers, searchValue) } });
  }, [unassignedUsers, newCustomerMembers]);

  const handleCreateUserSelectToggle = useCallback((isOpen) => {
    if (isOpen || selectedCustomerUsers.length === 0) return;
    setNewCustomerMembers(members => mergeUsersByEmail(members, selectedCustomerUsers));
    setSelectedCustomerUsers([]);
  }, [selectedCustomerUsers]);

  const removeNewCustomerMember = useCallback((member) => {
    setNewCustomerMembers(members => members.filter(item => item.email !== member.email));
  }, []);

  const deleteCustomer = useCallback(() => {
    if (!customerToDelete) return;
    portalAPI.deleteCustomer(projectUuid, customerToDelete.id).then(() => {
      toaster.success(gettext('Customer deleted'));
      loadCustomers();
      loadUsers();
      loadInvites();
    }).catch((error) => {
      toaster.danger(error.response?.data?.error_msg || gettext('Failed to delete customer'));
    });
  }, [customerToDelete, projectUuid, loadCustomers, loadUsers, loadInvites]);

  const openCustomer = useCallback((customerId) => {
    setSelectedCustomerId(customerId);
    setCustomerDetail(null);
    setSelectedEditCustomerUsers([]);
    setEditCustomerMembers([]);
    loadCustomerDetail(customerId);
  }, [loadCustomerDetail]);

  const closeEditCustomer = useCallback(() => {
    setSelectedCustomerId(null);
    setCustomerDetail(null);
    setSelectedEditCustomerUsers([]);
    setEditCustomerMembers([]);
  }, []);

  const saveCustomer = useCallback(() => {
    const customer = customerDetail?.customer;
    if (!customer || !customer.name.trim() || isSubmitting) return;
    setSubmitting(true);
    portalAPI.updateCustomer(projectUuid, customer.id, {
      name: customer.name.trim(),
      status: customer.status,
      member_emails: getMemberEmails(editCustomerMembers, selectedEditCustomerUsers),
    }).then(() => {
      toaster.success(gettext('Customer updated'));
      loadCustomers();
      loadUsers();
      closeEditCustomer();
    }).catch((error) => {
      toaster.danger(error.response?.data?.error_msg || gettext('Failed to update customer'));
    }).finally(() => setSubmitting(false));
  }, [
    customerDetail, editCustomerMembers, selectedEditCustomerUsers, isSubmitting,
    projectUuid, loadCustomers, loadUsers, closeEditCustomer,
  ]);

  const searchEditCustomerUsers = useCallback((searchValue) => {
    const assignableUsers = users.filter(user => !user.customer_id || user.customer_id === selectedCustomerId);
    return Promise.resolve({ data: { users: getSelectableUsers(assignableUsers, editCustomerMembers, searchValue) } });
  }, [users, selectedCustomerId, editCustomerMembers]);

  const handleEditUserSelectToggle = useCallback((isOpen) => {
    if (isOpen || selectedEditCustomerUsers.length === 0) return;
    setEditCustomerMembers(members => mergeUsersByEmail(members, selectedEditCustomerUsers));
    setSelectedEditCustomerUsers([]);
  }, [selectedEditCustomerUsers]);

  const removeEditCustomerMember = useCallback((member) => {
    setEditCustomerMembers(members => members.filter(item => item.email !== member.email));
  }, []);

  const onCopy = useCallback((text) => {
    navigator.clipboard.writeText(text).then(() => {
      toaster.success(gettext('Copied'), { duration: 2, hasCloseButton: false });
    });
  }, []);

  const deleteExternalUser = useCallback((userEmail) => {
    portalAPI.deleteExternalUser(projectUuid, userEmail).then(loadUsers).catch(() => {
      toaster.danger(gettext('Delete failed'));
    });
  }, [projectUuid, loadUsers]);

  const revokeInvitation = useCallback((token) => {
    portalAPI.revokeExternalInvitation(projectUuid, token).then(loadInvites).catch(() => {
      toaster.danger(gettext('Delete failed'));
    });
  }, [projectUuid, loadInvites]);

  const customerColumns = useMemo(() => [
    { key: 'name', name: gettext('Name'), type: 'customer-name', width: 0.36, formatter: <TextCellFormatter /> },
    { key: 'status', name: gettext('Status'), type: 'customer-status', width: 0.22, formatter: <CustomerStatusFormatter /> },
    { key: 'updated_at', name: gettext('Updated'), type: 'customer-updated', width: 0.42, formatter: <CustomerUpdatedFormatter /> },
    { key: 'op', name: '', type: 'customer-operation', width: 80, isFixed: true, formatter: <CustomerOperationsFormatter /> },
  ], []);

  const customerMemberColumns = useMemo(() => [
    { key: 'email', name: gettext('Email'), type: 'customer-member-email', width: 0.52, formatter: <TextCellFormatter /> },
    { key: 'activated', name: gettext('Status'), type: 'customer-member-status', width: 0.48, formatter: <CustomerMemberStatusFormatter /> },
    { key: 'op', name: '', type: 'customer-operation', width: 80, isFixed: true, formatter: <CustomerMemberOperationsFormatter /> },
  ], []);

  const newCustomerMemberRows = useMemo(() => newCustomerMembers.map(user => ({ ...user, id: user.email })), [newCustomerMembers]);
  const editCustomerMemberRows = useMemo(() => editCustomerMembers.map(user => ({ ...user, id: user.email })), [editCustomerMembers]);

  const currentCustomer = customerDetail?.customer;

  return (
    <>
      <div className="portal-settings-dialog-side portal-user-management-side p-4">
        <Nav pills vertical className="w-100">
          <NavItem>
            <NavLink className={activeTab === Tabs.CUSTOMERS ? 'active' : ''} onClick={() => { setActiveTab(Tabs.CUSTOMERS); closeCreateCustomer(); closeEditCustomer(); }}>
              {gettext('Customers')}
            </NavLink>
          </NavItem>
          <NavItem>
            <NavLink className={activeTab === Tabs.USERS ? 'active' : ''} onClick={() => setActiveTab(Tabs.USERS)}>
              {gettext('Users')}
            </NavLink>
          </NavItem>
          <NavItem>
            <NavLink className={activeTab === Tabs.INVITE_USERS ? 'active' : ''} onClick={() => setActiveTab(Tabs.INVITE_USERS)}>
              {gettext('Invite users')}
            </NavLink>
          </NavItem>
        </Nav>
      </div>
      <div className="portal-settings-dialog-main portal-user-management-main">
        {activeTab === Tabs.CUSTOMERS && !selectedCustomerId && !isCreatingCustomer && (
          <CustomizeTable
            className="portal-customers-table"
            columns={customerColumns}
            rows={customers}
            rowHeight={40}
            onModify={(customer) => openCustomer(customer.id)}
            onDelete={setCustomerToDelete}
            emptyTip={(
              <EmptyTip
                className="portal-customers-empty-tip"
                src={`${mediaUrl}img/no-items-tip.png`}
                text={gettext('No customer')}
              />
            )}
          >
            <div className="portal-customers-header">
              <span>{gettext('Customers')}</span>
              <Button color="primary" outline onClick={() => setCreatingCustomer(true)}>
                {gettext('Create customers')}
              </Button>
            </div>
          </CustomizeTable>
        )}
        {activeTab === Tabs.CUSTOMERS && isCreatingCustomer && (
          <div className="portal-customer-create-page">
            <div className="portal-customer-create-header">
              <button type="button" className="portal-customer-create-back" onClick={closeCreateCustomer}>
                <IconButton icon="arrow-left" className="no-hover-bg" size={{ btn: 20, icon: 16 }} />
                <span>{gettext('Create customer')}</span>
              </button>
              <Button
                color="primary"
                outline
                disabled={isSubmitting || !newCustomerName.trim()}
                onClick={createCustomer}
              >
                {gettext('Submit')}
              </Button>
            </div>
            <div className="portal-customer-create-form">
              <FormGroup className="mb-4">
                <label htmlFor="portal-customer-name">{gettext('Customer name')}</label>
                <Input
                  id="portal-customer-name"
                  className="portal-user-management-input"
                  value={newCustomerName}
                  maxLength={255}
                  onChange={(event) => setNewCustomerName(event.target.value)}
                />
              </FormGroup>
              <div className="mb-4">
                <label>{gettext('Add existing user')}</label>
                <UserSelect
                  className="portal-customer-user-select"
                  popoverClassName="portal-customer-user-select-popover"
                  placeholder={gettext('Select assigned users')}
                  searchPlaceholder={gettext('Search users')}
                  emptyMessage={gettext('No unassigned users')}
                  selectedUsers={selectedCustomerUsers}
                  onSelectChange={setSelectedCustomerUsers}
                  onPopoverToggle={handleCreateUserSelectToggle}
                  api={searchUnassignedUsers}
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
            </div>
            {newCustomerMemberRows.length > 0 && (
              <CustomizeTable
                className="portal-customer-members-table"
                columns={customerMemberColumns}
                rows={newCustomerMemberRows}
                rowHeight={40}
                onDelete={removeNewCustomerMember}
              />
            )}
          </div>
        )}
        {activeTab === Tabs.CUSTOMERS && selectedCustomerId && (
          <div className="portal-customer-create-page">
            {!currentCustomer ? <EmptyTip text={gettext('Loading customer')} /> : (
              <>
                <div className="portal-customer-create-header">
                  <button type="button" className="portal-customer-create-back" onClick={closeEditCustomer}>
                    <IconButton icon="arrow-left" className="no-hover-bg" size={{ btn: 20, icon: 16 }} />
                    <span>{gettext('Edit customer')}</span>
                  </button>
                  <Button
                    color="primary"
                    outline
                    disabled={isSubmitting || !currentCustomer.name.trim()}
                    onClick={saveCustomer}
                  >
                    {gettext('Submit')}
                  </Button>
                </div>
                <div className="portal-customer-create-form">
                  <div className="mb-4">
                    <label htmlFor="portal-edit-customer-name">{gettext('Customer name')}</label>
                    <Input
                      id="portal-edit-customer-name"
                      className="portal-user-management-input"
                      value={currentCustomer.name}
                      maxLength={255}
                      onChange={(event) => setCustomerDetail({ ...customerDetail, customer: { ...currentCustomer, name: event.target.value } })}
                    />
                  </div>
                  <div className="mb-4">
                    <label>{gettext('Add existing user')}</label>
                    <UserSelect
                      className="portal-customer-user-select"
                      popoverClassName="portal-customer-user-select-popover"
                      placeholder={gettext('Select assigned users')}
                      searchPlaceholder={gettext('Search users')}
                      emptyMessage={gettext('No unassigned users')}
                      selectedUsers={selectedEditCustomerUsers}
                      onSelectChange={setSelectedEditCustomerUsers}
                      onPopoverToggle={handleEditUserSelectToggle}
                      api={searchEditCustomerUsers}
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
                </div>
                {editCustomerMemberRows.length > 0 && (
                  <CustomizeTable
                    className="portal-customer-members-table"
                    columns={customerMemberColumns}
                    rows={editCustomerMemberRows}
                    rowHeight={40}
                    onDelete={removeEditCustomerMember}
                  />
                )}
              </>
            )}
          </div>
        )}
        {activeTab === Tabs.USERS && (
          <UsersPage users={users} query={query} onQueryChange={setQuery} onDelete={deleteExternalUser} />
        )}
        {activeTab === Tabs.INVITE_USERS && (
          <InviteUsersPage
            invitations={invitations}
            email={email}
            selectedCustomerId={selectedInviteCustomerId}
            customers={activeCustomers}
            isSubmitting={isSubmitting}
            onEmailChange={setEmail}
            onCustomerChange={setSelectedInviteCustomerId}
            onInvite={inviteUser}
            onCopy={onCopy}
            onRevoke={revokeInvitation}
          />
        )}
      </div>
      {customerToDelete && (
        <CommonOperationConfirmationDialog
          title={gettext('Delete customer')}
          message={gettext('Are you sure you want to delete this customer?')}
          confirmBtnText={gettext('Delete')}
          executeOperation={deleteCustomer}
          toggleDialog={() => setCustomerToDelete(null)}
        />
      )}
    </>
  );
};

export default UserManagement;
