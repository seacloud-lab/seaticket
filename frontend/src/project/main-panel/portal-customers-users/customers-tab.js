import React, { useCallback, useMemo } from 'react';
import { gettext } from '@/constants';
import SeaMetadata from '@/sea-metadata';
import { CellType, VIEW_TOOL } from '@/sea-metadata/constants';
import context from '@/sea-metadata/context';

const CustomerStatusFormatter = ({ value }) => (
  <span>{value === 'active' ? gettext('Active') : gettext('Inactive')}</span>
);

const CustomersTab = ({ customers, onEdit, onManageUsers, onDelete, viewTabs }) => {
  const metadataID = useMemo(() => {
    return customers.map(customer => `${customer.id}:${customer.updated_at || ''}`).join('|') || 'customers-empty';
  }, [customers]);

  const api = useMemo(() => ({
    getViews: () => Promise.resolve({
      data: {
        views: [{ _id: 'customers', type: 'view' }],
        navigation: [{ _id: 'customers', type: 'view' }],
      },
    }),
    getView: () => Promise.resolve({
      data: {
        view: {
          _id: 'customers',
          type: 'table',
          name: gettext('Customers'),
          columns_keys: ['name', 'email_domain', 'status', 'updated_at'],
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
        rows: customers.map(customer => ({
          ...customer,
          _pk: customer.id,
        })),
        columns: [
          {
            key: 'name',
            name: 'name',
            display_name: gettext('Name'),
            type: CellType.TEXT,
            width: 360,
            frozen: true,
            is_name_column: true,
            editable: false,
          },
          {
            key: 'email_domain',
            name: 'email_domain',
            display_name: gettext('Email domain'),
            type: CellType.TEXT,
            width: 260,
            editable: false,
          },
          {
            key: 'status',
            name: 'status',
            display_name: gettext('Status'),
            type: CellType.TEXT,
            width: 180,
            editable: false,
            formatter: <CustomerStatusFormatter />,
          },
          {
            key: 'updated_at',
            name: 'updated_at',
            display_name: gettext('Updated'),
            type: CellType.MTIME,
            width: 220,
            editable: false,
          },
        ],
        has_more: false,
        error_msg: customers.length === 0 ? gettext('No customer') : '',
      },
    }),
  }), [customers]);

  const createContextMenuOptions = useCallback(({ selectedPosition, rowMetrics, table, rowGetterByIndex, isGroupView }) => {
    const selectedRowIds = rowMetrics ? Object.keys(rowMetrics.idSelectedRowMap || {}) : [];
    const row = selectedPosition
      ? rowGetterByIndex({ isGroupView, groupRowIndex: selectedPosition.groupRowIndex, rowIndex: selectedPosition.rowIdx })
      : selectedRowIds.length === 1 ? table?.id_row_map?.[selectedRowIds[0]] : null;
    if (!row) return [];
    return [
      { label: gettext('Edit customer'), key: 'edit_customer', callback: () => onEdit(row) },
      { label: gettext('Users management'), key: 'manage_customer_users', callback: () => onManageUsers(row) },
      { label: gettext('Delete customer'), key: 'delete_customer', callback: () => onDelete(row) },
    ];
  }, [onDelete, onEdit, onManageUsers]);

  return (
    <SeaMetadata
      key={metadataID}
      className="portal-customers-sea-metadata"
      metadataID={metadataID}
      api={api}
      isShowViewInURL={false}
      fixedColumnCount={1}
      localStorageNamePrefix="seaqa-portal-customers"
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
        row: gettext('customer'),
        rows: gettext('customers'),
        Row: gettext('Customer'),
        Rows: gettext('Customers'),
      }}
    />
  );
};

export default CustomersTab;
