import React from 'react';
import UsersTable from './users-table';

const UsersTab = ({ users, onDeleteUser, onCustomerClick, viewTabs }) => (
  <UsersTable
    users={users}
    onDeleteUser={onDeleteUser}
    onCustomerClick={onCustomerClick}
    viewTabs={viewTabs}
  />
);

export default UsersTab;
