import React, { useMemo } from 'react';
import { EmptyTip, SearchInput } from '@/components';
import { gettext } from '@/constants';
import OperationButton from './operation-button';

import './users-page.css';

const UsersPage = ({ users, query, onQueryChange, onDelete }) => {
  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return users;
    return users.filter(user => (
      (user.name || '').toLowerCase().includes(normalizedQuery) ||
      (user.email || '').toLowerCase().includes(normalizedQuery)
    ));
  }, [query, users]);

  return (
    <div className="portal-users-page">
      <SearchInput
        className="portal-users-search"
        value={query}
        onChange={onQueryChange}
        onClear={() => onQueryChange('')}
        placeholder={gettext('Search user')}
        size={38}
        wait={0}
      />
      {users.length > 0 ? (
        <div className="portal-user-management-table-wrapper">
          <table className="table table-sm portal-user-management-table">
            <colgroup>
              <col className="portal-users-user-column" />
              <col className="portal-users-customer-column" />
              <col className="portal-users-status-column" />
              <col className="portal-user-operations-column" />
            </colgroup>
            <thead>
              <tr>
                <th>{gettext('User')}</th>
                <th>{gettext('Customer')}</th>
                <th>{gettext('Status')}</th>
                <th>{/* More operations */}</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => (
                <tr key={user.email}>
                  <td>
                    <span className="text-truncate d-block" title={user.name || user.email}>{user.name || user.email}</span>
                  </td>
                  <td>
                    <span className="text-truncate d-block" title={user.customer_name || '-'}>{user.customer_name || '-'}</span>
                  </td>
                  <td>{user.activated ? gettext('Activated') : gettext('Inactive')}</td>
                  <td className="text-right operation-btns">
                    <div className="portal-customer-operation-btns">
                      <OperationButton icon="delete" tip={gettext('Delete')} onClick={() => onDelete(user.email)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="portal-user-management-empty">
          <EmptyTip text={gettext('No users')} />
        </div>
      )}
    </div>
  );
};

export default UsersPage;
