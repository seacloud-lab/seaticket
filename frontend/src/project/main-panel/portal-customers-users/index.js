import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from 'reactstrap';
import { CommonOperationConfirmationDialog, Icon, toaster } from '@/components';
import { gettext } from '@/constants';
import { portalAPI } from '@/portal/api';
import { Utils } from '@/utils/utils';
import TopBar from '../top-bar';
import CustomerMembersModal from './customer-members-modal';
import CustomerModal from './customer-modal';
import CustomerUsersTabs from './customer-users-tabs';
import CustomersTab from './customers-tab';
import InviteUsersDialog from './invite-users-dialog';
import UsersTab from './users-tab';

import './index.css';

const Tabs = {
  CUSTOMERS: 'customers',
  USERS: 'users',
};

const PortalCustomersUsers = ({ title }) => {
  const { projectUuid } = window.app.pageOptions;
  const [activeTab, setActiveTab] = useState(Tabs.CUSTOMERS);
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [isSubmitting, setSubmitting] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState(null);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [customerToManage, setCustomerToManage] = useState(null);
  const [customerMembers, setCustomerMembers] = useState([]);
  const [isLoadingCustomerMembers, setLoadingCustomerMembers] = useState(false);
  const [userOperation, setUserOperation] = useState(null);
  const [isInviteDialogOpen, setInviteDialogOpen] = useState(false);
  const customerMembersRequestRef = useRef(0);

  const showError = useCallback((error, fallback) => {
    toaster.danger(error.response?.data?.detail || error.response?.data?.error_msg || Utils.getErrorMsg(error) || fallback);
  }, []);

  const loadCustomers = useCallback(() => {
    return portalAPI.listCustomers(projectUuid).then((res) => {
      setCustomers(res.data?.customers || []);
    }).catch((error) => showError(error, gettext('Failed to load customers')));
  }, [projectUuid, showError]);

  const loadUsers = useCallback(() => {
    return portalAPI.listExternalUsers(projectUuid).then((res) => {
      setUsers(res.data?.users || []);
    }).catch((error) => showError(error, gettext('Failed to load users')));
  }, [projectUuid, showError]);

  const loadInvitations = useCallback(() => {
    return portalAPI.listExternalInvitations(projectUuid).then((res) => {
      setInvitations(res.data?.invite_list || []);
    }).catch((error) => showError(error, gettext('Failed to load invitations')));
  }, [projectUuid, showError]);

  useEffect(() => {
    loadCustomers();
    loadUsers();
    loadInvitations();
  }, [loadCustomers, loadInvitations, loadUsers]);

  useEffect(() => {
    return () => {
      customerMembersRequestRef.current += 1;
    };
  }, []);

  const closeCustomerModal = useCallback(() => setCustomerToEdit(null), []);

  const saveCustomer = useCallback((name) => {
    const request = customerToEdit?.id
      ? portalAPI.updateCustomer(projectUuid, customerToEdit.id, { name })
      : portalAPI.createCustomer(projectUuid, { name });
    setSubmitting(true);
    request.then(() => {
      toaster.success(customerToEdit?.id ? gettext('Customer updated') : gettext('Customer created'));
      closeCustomerModal();
      loadCustomers();
    }).catch((error) => showError(error, customerToEdit?.id ? gettext('Failed to update customer') : gettext('Failed to create customer')))
      .finally(() => setSubmitting(false));
  }, [closeCustomerModal, customerToEdit, loadCustomers, projectUuid, showError]);

  const deleteCustomer = useCallback(() => {
    if (!customerToDelete) return;
    setSubmitting(true);
    portalAPI.deleteCustomer(projectUuid, customerToDelete.id).then(() => {
      toaster.success(gettext('Customer deleted'));
      setCustomerToDelete(null);
      loadCustomers();
      loadUsers();
      loadInvitations();
    }).catch((error) => showError(error, gettext('Failed to delete customer')))
      .finally(() => setSubmitting(false));
  }, [customerToDelete, loadCustomers, loadInvitations, loadUsers, projectUuid, showError]);

  const closeCustomerMembers = useCallback(() => {
    customerMembersRequestRef.current += 1;
    setCustomerToManage(null);
    setCustomerMembers([]);
    setLoadingCustomerMembers(false);
  }, []);

  const loadCustomerMembers = useCallback((customerId, requestId) => {
    return portalAPI.getCustomerMembers(projectUuid, customerId).then((res) => {
      if (requestId !== customerMembersRequestRef.current) return;
      setCustomerMembers(res.data?.members || []);
    });
  }, [projectUuid]);

  const manageUsers = useCallback((customer) => {
    const requestId = customerMembersRequestRef.current + 1;
    customerMembersRequestRef.current = requestId;
    setCustomerToManage(customer);
    setCustomerMembers([]);
    setLoadingCustomerMembers(true);
    loadCustomerMembers(customer.id, requestId).catch((error) => {
      if (requestId !== customerMembersRequestRef.current) return;
      showError(error, gettext('Failed to load customer users'));
      closeCustomerMembers();
    }).finally(() => {
      if (requestId !== customerMembersRequestRef.current) return;
      setLoadingCustomerMembers(false);
    });
  }, [closeCustomerMembers, loadCustomerMembers, showError]);

  const openCustomerUsers = useCallback((customerId) => {
    const customer = customers.find(item => String(item.id) === String(customerId));
    if (customer) manageUsers(customer);
  }, [customers, manageUsers]);

  const saveCustomerMembers = useCallback((members, closeModal = true) => {
    if (!customerToManage) return;
    const requestId = customerMembersRequestRef.current;
    const currentMemberEmails = new Set(customerMembers.map(member => member.email));
    const desiredMemberEmails = new Set(members.map(member => member.email));
    const addedMemberEmails = members
      .map(member => member.email)
      .filter(email => !currentMemberEmails.has(email));
    const removedMembers = customerMembers
      .filter(member => !desiredMemberEmails.has(member.email));

    if (addedMemberEmails.length === 0 && removedMembers.length === 0) {
      if (closeModal) closeCustomerMembers();
      return;
    }

    setSubmitting(true);
    const memberRequests = [];
    if (addedMemberEmails.length > 0) {
      memberRequests.push(portalAPI.addCustomerMembers(projectUuid, customerToManage.id, addedMemberEmails));
    }
    removedMembers.forEach(member => {
      memberRequests.push(portalAPI.removeCustomerMember(
        projectUuid,
        customerToManage.id,
        member.id,
      ));
    });
    Promise.all(memberRequests).then((responses) => {
      if (requestId !== customerMembersRequestRef.current) return;
      const failedMembers = responses.reduce((failed, response) => (
        failed.concat(response.data?.failed || [])
      ), []);
      failedMembers.forEach((item) => {
        toaster.danger(`${item.email}: ${item.error_msg}`, { duration: 3 });
      });
      loadCustomers();
      loadUsers();
      if (failedMembers.length > 0) {
        loadCustomerMembers(customerToManage.id, requestId).catch((refreshError) => {
          if (requestId !== customerMembersRequestRef.current) return;
          showError(refreshError, gettext('Failed to load customer users'));
        });
        return;
      }
      setCustomerMembers(members);
      toaster.success(gettext('Customer users updated'));
      if (closeModal) closeCustomerMembers();
    }).catch((error) => {
      if (requestId !== customerMembersRequestRef.current) return;
      showError(error, gettext('Failed to update customer users'));
      loadCustomerMembers(customerToManage.id, requestId).catch((refreshError) => {
        if (requestId !== customerMembersRequestRef.current) return;
        showError(refreshError, gettext('Failed to load customer users'));
      });
    })
      .finally(() => setSubmitting(false));
  }, [closeCustomerMembers, customerMembers, customerToManage, loadCustomerMembers, loadCustomers, loadUsers, projectUuid, showError]);

  const inviteUser = useCallback((email, customerId, onSuccess) => {
    setSubmitting(true);
    portalAPI.createExternalInvitation(projectUuid, email, customerId).then(() => {
      toaster.success(gettext('Link generated'));
      onSuccess();
      loadInvitations();
      loadUsers();
    }).catch((error) => showError(error, gettext('Failed to generate invitation link')))
      .finally(() => setSubmitting(false));
  }, [loadInvitations, loadUsers, projectUuid, showError]);

  const executeUserOperation = useCallback(() => {
    if (!userOperation) return;
    setSubmitting(true);
    portalAPI.deleteExternalUser(projectUuid, userOperation.user.email).then(() => {
      toaster.success(gettext('User deleted'));
      setUserOperation(null);
      loadCustomers();
      loadUsers();
      loadInvitations();
    }).catch((error) => showError(error, gettext('Delete failed')))
      .finally(() => setSubmitting(false));
  }, [loadCustomers, loadInvitations, loadUsers, projectUuid, showError, userOperation]);

  const revokeInvitation = useCallback((token) => {
    portalAPI.revokeExternalInvitation(projectUuid, token).then(() => {
      toaster.success(gettext('Invitation deleted'));
      loadInvitations();
    }).catch((error) => showError(error, gettext('Delete failed')));
  }, [loadInvitations, projectUuid, showError]);

  const copyInvitation = useCallback((link) => {
    navigator.clipboard.writeText(link).then(() => {
      toaster.success(gettext('Copied'), { duration: 2, hasCloseButton: false });
    }).catch(() => toaster.danger(gettext('Copy failed')));
  }, []);

  return (
    <>
      <TopBar>
        {[
          <span key="title" className="text-truncate" title={title}>{title}</span>,
          activeTab === Tabs.CUSTOMERS ? (
            <Button key="new-customer" color="primary" className="btn-xs" onClick={() => setCustomerToEdit({})}>
              <Icon symbol="plus" aria-hidden="true" />
              {gettext('New customer')}
            </Button>
          ) : (
            <Button key="invite-users" color="primary" className="btn-xs" onClick={() => setInviteDialogOpen(true)}>
              <Icon symbol="invite-members" aria-hidden="true" />
              {gettext('Invite users')}
            </Button>
          ),
        ]}
      </TopBar>
      <div className="portal-customers-users-page">
        <div className="portal-customers-users-content" role="tabpanel">
          {activeTab === Tabs.CUSTOMERS ? (
            <CustomersTab
              customers={customers}
              onEdit={setCustomerToEdit}
              onManageUsers={manageUsers}
              onDelete={setCustomerToDelete}
              viewTabs={(
                <CustomerUsersTabs
                  activeTab={activeTab}
                  onChange={setActiveTab}
                  customersTab={Tabs.CUSTOMERS}
                  usersTab={Tabs.USERS}
                />
              )}
            />
          ) : (
            <UsersTab
              onDeleteUser={(user) => setUserOperation({ user })}
              onCustomerClick={openCustomerUsers}
              users={users}
              viewTabs={(
                <CustomerUsersTabs
                  activeTab={activeTab}
                  onChange={setActiveTab}
                  customersTab={Tabs.CUSTOMERS}
                  usersTab={Tabs.USERS}
                />
              )}
            />
          )}
        </div>
      </div>
      {isInviteDialogOpen && (
        <InviteUsersDialog
          customers={customers.filter(customer => customer.status === 'active')}
          invitations={invitations}
          isSubmitting={isSubmitting}
          onInvite={inviteUser}
          onCopy={copyInvitation}
          onRevoke={revokeInvitation}
          onClose={() => setInviteDialogOpen(false)}
        />
      )}
      {customerToEdit && (
        <CustomerModal
          customer={customerToEdit.id ? customerToEdit : null}
          isSubmitting={isSubmitting}
          onClose={closeCustomerModal}
          onSubmit={saveCustomer}
        />
      )}
      {customerToManage && (
        <CustomerMembersModal
          customer={customerToManage}
          members={customerMembers}
          users={users}
          isLoading={isLoadingCustomerMembers}
          isSubmitting={isSubmitting}
          onClose={closeCustomerMembers}
          onSubmit={saveCustomerMembers}
        />
      )}
      {customerToDelete && (
        <CommonOperationConfirmationDialog
          title={gettext('Delete customer')}
          message={gettext('Are you sure you want to delete "{customer_name}"?').replace('{customer_name}', () => Utils.HTMLescape(customerToDelete.name))}
          confirmBtnText={gettext('Delete')}
          executeOperation={deleteCustomer}
          toggleDialog={() => setCustomerToDelete(null)}
        />
      )}
      {userOperation && (
        <CommonOperationConfirmationDialog
          title={gettext('Delete user')}
          message={gettext('Are you sure you want to delete this user?')}
          confirmBtnText={gettext('Delete')}
          executeOperation={executeUserOperation}
          toggleDialog={() => setUserOperation(null)}
        />
      )}
    </>
  );
};

export default PortalCustomersUsers;
