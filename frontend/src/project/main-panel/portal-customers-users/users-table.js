import React, { useCallback, useMemo } from 'react';
import { gettext } from '@/constants';
import { CellType, VIEW_TOOL } from '@/sea-metadata/constants';
import context from '@/sea-metadata/context';
import SeaMetadata from '@/sea-metadata';

const UserStatusFormatter = ({ value }) => (
  <span>{value ? gettext('Active') : gettext('Inactive')}</span>
);

const CustomerFormatter = ({ value, row, onCustomerClick }) => {
  if (!value || !row?.customer_id) return null;
  return (
    <div className="sea-metadata-ui cell-formatter-container link-formatter" title={value}>
      <div className="link-item" onClick={() => onCustomerClick?.(row.customer_id)}>
        <span className="link-item-name" title={value}>{value}</span>
      </div>
    </div>
  );
};

const UsersTable = ({ users, onDeleteUser, onCustomerClick, viewTabs }) => {
  const metadataID = useMemo(() => {
    return users.map(user => `${user.email}:${user.activated ? '1' : '0'}:${user.customer_id || ''}`).join('|') || 'users-empty';
  }, [users]);

  const api = useMemo(() => ({
    getViews: () => Promise.resolve({
      data: {
        views: [{ _id: 'users', type: 'view' }],
        navigation: [{ _id: 'users', type: 'view' }],
      },
    }),
    getView: () => Promise.resolve({
      data: {
        view: {
          _id: 'users',
          type: 'table',
          name: gettext('Users'),
          columns_keys: ['user', 'customer', 'status'],
          sorts: context.localStorage?.getItem('sorts') || [],
        },
      },
    }),
    modifyView: (viewID, viewData) => {
      Object.keys(viewData).forEach(key => {
        context.localStorage?.setItem(key, viewData[key]);
      });
      return Promise.resolve({ data: { success: true } });
    },
    getMetadata: () => Promise.resolve({
      data: {
        rows: users.map(user => ({
          ...user,
          _pk: user.email,
          user: user.email,
          customer: user.customer_name || '',
          status: user.activated,
        })),
        columns: [
          {
            key: 'user',
            name: 'user',
            display_name: gettext('User'),
            type: CellType.TEXT,
            width: 320,
            frozen: true,
            is_name_column: true,
            editable: false,
          },
          {
            key: 'customer',
            name: 'customer',
            display_name: gettext('Customer'),
            type: CellType.TEXT,
            width: 280,
            editable: false,
            formatter: <CustomerFormatter onCustomerClick={onCustomerClick} />,
          },
          {
            key: 'status',
            name: 'status',
            display_name: gettext('Status'),
            type: CellType.TEXT,
            width: 180,
            editable: false,
            formatter: <UserStatusFormatter />,
          },
        ],
        has_more: false,
        error_msg: users.length === 0 ? gettext('No user') : '',
      },
    }),
  }), [onCustomerClick, users]);

  const createContextMenuOptions = useCallback(({ selectedPosition, rowMetrics, table, rowGetterByIndex, isGroupView }) => {
    const selectedRowIds = rowMetrics ? Object.keys(rowMetrics.idSelectedRowMap || {}) : [];
    const row = selectedPosition
      ? rowGetterByIndex({ isGroupView, groupRowIndex: selectedPosition.groupRowIndex, rowIndex: selectedPosition.rowIdx })
      : selectedRowIds.length === 1 ? table?.id_row_map?.[selectedRowIds[0]] : null;
    if (!row) return [];

    return [{
      label: gettext('Delete user'),
      key: 'delete_user',
      callback: () => onDeleteUser(row),
    }];
  }, [onDeleteUser]);

  return (
    <SeaMetadata
      key={metadataID}
      className="portal-customers-sea-metadata"
      metadataID={metadataID}
      api={api}
      isShowViewInURL={false}
      fixedColumnCount={1}
      localStorageNamePrefix="seaqa-portal-users"
      viewTools={[VIEW_TOOL.SEARCH, VIEW_TOOL.SORTS]}
      viewTabs={viewTabs}
      createContextMenuOptions={createContextMenuOptions}
      settings={{
        canManageView: false,
        isFilterComputedOnServer: false,
        isSortComputedOnServer: false,
        canClearCells: false,
        canPasteCells: false,
        canDragFillCells: false,
      }}
      permission="rw"
      t={{
        row: gettext('user'),
        rows: gettext('users'),
        Row: gettext('User'),
        Rows: gettext('Users'),
      }}
    />
  );
};

export default UsersTable;
