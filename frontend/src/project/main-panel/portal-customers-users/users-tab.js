import React from 'react';
import UsersTable from './users-table';

const UsersTab = ({ users, onEditUser, onDeleteUser, onCustomerClick, viewTabs }) => (
  <UsersTable
    users={users}
    onEditUser={onEditUser}
    onDeleteUser={onDeleteUser}
    onCustomerClick={onCustomerClick}
    viewTabs={viewTabs}
  />
);

export default UsersTab;
