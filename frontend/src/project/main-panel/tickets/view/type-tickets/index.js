import React, { useCallback, useMemo } from 'react';
import copy from 'copy-to-clipboard';
import { typesAPI, ticketsAPI } from '../../../../api';
import SeaMetadata, { CellType } from '@/sea-metadata';
import context from '@/sea-metadata/context';
import { useTypes, useTicketsPage } from '../../hooks';
import { TICKET_PAGE_TYPE, TICKET_STATUS_OPTIONS, TICKET_CHILDREN_PAGE_TYPE } from '../../constants';
import { TicketForTickets } from '../../models';
import { gettext } from '@/constants';
import { toaster } from '@/components';
import { getRowById } from '@/sea-metadata/utils/row';
import { BAR_TYPE } from '@/project/constants/bar';

const TypeTickets = ({ projectUuid, workspaceID, projectName }) => {

  const { isLoading, pageType, childrenPageType, togglePageType } = useTicketsPage();
  const { isLoading: isTypesLoading, typesData, createType } = useTypes();

  const columns = useMemo(() => [
    {
      type: CellType.TEXT,
      key: 'title',
      name: gettext('Title'),
      editable: true,
      is_name_column: true,
      frozen: true,
      is_required: true,
      click: (row) => togglePageType(row._id)
    },
    {
      type: CellType.SINGLE_SELECT,
      key: 'status',
      name: gettext('Status'),
      editable: true,
      data: { options: TICKET_STATUS_OPTIONS },
      is_required: true,
    },
    {
      type: CellType.SINGLE_SELECT,
      key: 'type',
      name: gettext('Type'),
      editable: true,
      modify_data_able: true,
      data: { options: typesData.rows },
    },
    {
      type: CellType.LONG_TEXT,
      key: 'content',
      name: gettext('Description'),
      editable: true,
      is_required: true,
    },
    {
      type: CellType.COLLABORATOR,
      key: 'assignees',
      name: gettext('Assignees'),
      editable: true,
    },
    {
      type: CellType.TAGS,
      key: 'tags',
      name: gettext('Tags'),
      editable: true,
      modify_data_able: true,
    },
    {
      type: CellType.COLLABORATOR,
      key: 'participants',
      name: gettext('Participants'),
      editable: false,
    },
    {
      type: CellType.CTIME,
      key: 'created_at',
      name: gettext('Create time'),
      editable: false,
    },
    {
      type: CellType.CREATOR,
      key: 'creator',
      name: gettext('Creator'),
      editable: false,
    },
  ], [togglePageType]);

  const viewsData = useMemo(() => ({
    navigation: [{ _id: '0000', type: 'view' }],
    views: [
      {
        _id: '0000',
        name: gettext('All'),
      }
    ]
  }), []);

  const api = useMemo(() => ({
    getMetadata: (...params) => {
      return typesAPI.listProjectTicketsByType(projectUuid, childrenPageType).then(res => {
        const rows = Array.isArray(res.data.tickets) ? res.data.tickets.map(t => new TicketForTickets(t)) : [];
        return {
          data: {
            rows,
            columns,
          }
        };
      });
    },

    // view
    getViews: () => {
      return new Promise((resolve, reject) => {
        resolve({ data: viewsData });
      });
    },

    getView: (viewID) => {
      return new Promise((resolve, reject) => {
        const view = viewsData.views[0];

        resolve({ data: { view: {
          ...view,
          sorts: context.localStorage.getItem('sorts') || [],
        } } });
      });
    },

    modifyView: (viewID, viewData) => {
      return new Promise((resolve, reject) => {
        Object.keys(viewData).forEach(key => {
          context.localStorage.setItem(key, viewData[key]);
        });
        resolve({ data: { success: true } });
      });
    },

    // row
    insertRow: () => togglePageType(TICKET_PAGE_TYPE.NEW),
    modifyRow: (...params) => ticketsAPI.modifyProjectTicket(projectUuid, ...params),
    deleteRow: (...params) => ticketsAPI.deleteProjectTicket(projectUuid, ...params),

    // file
    uploadFile: (...params) => ticketsAPI.uploadFile(projectUuid, ...params),

  }), [projectUuid, childrenPageType, columns, viewsData]);

  const createContextMenuOptions = useCallback(({
    isGroupView,
    selectedRange,
    selectedPosition,
    position,
    table,
    rowMetrics,
    deleteRows,
    hideMenu,
    onClearSelected,
    onCopySelected,
    rowGetterByIndex,
    selectNone,
    context,
  }) => {
    let list = [];

    // handle selected multiple cells
    if (selectedRange) {
      if (context.canModify()) {
        list.push({
          label: gettext('Clear selected'),
          callback: onClearSelected,
        });
      }
      list.push({
        label: gettext('Copy selected'),
        callback: onCopySelected,
      });

      if (context.canDeleteRow()) {
        const { topLeft, bottomRight } = selectedRange;
        let rows = [];
        for (let i = topLeft.rowIdx; i <= bottomRight.rowIdx; i++) {
          const row = rowGetterByIndex({ isGroupView, groupRowIndex: topLeft.groupRowIndex, rowIndex: i });
          if (row) {
            rows.push(row);
          }
        }
        if (rows.length > 0) {
          list.push({
            label: gettext('Delete selected'),
            rows: rows,
            callback: (event, { rows }) => {
              const rowIds = rows.map(row => row._id);
              deleteRows && deleteRows(rowIds);
            }
          });
        }
      }
      return list;
    }

    // handle selected rows
    const selectedRowIds = rowMetrics ? Object.keys(rowMetrics.idSelectedRowMap) : [];
    if (selectedRowIds.length > 1) {
      let rows = [];
      selectedRowIds.forEach(id => {
        const row = table.id_row_map[id];
        if (row) {
          rows.push(row);
        }
      });

      if (context.canDeleteRow() && rows.length > 0) {
        list.push({
          label: gettext('Delete tickets'),
          callback: (event) => {
            const rowIds = rows.map(row => row._id);
            deleteRows && deleteRows(rowIds);
          }
        });
      }
      return list;
    }

    // handle selected cell
    if (!selectedPosition) return list;
    const { groupRowIndex, rowIdx: rowIndex } = selectedPosition;
    const row = rowGetterByIndex({ isGroupView, groupRowIndex, rowIndex }) || table.id_row_map[selectedRowIds[0]];
    if (!row) return list;
    list.push({
      label: gettext('Open ticket'),
      callback: () => togglePageType(row._id),
    });

    list.push('Divider');

    if (context.canDeleteRow()) {
      list.push({
        label: gettext('Delete ticket'),
        callback: () => deleteRows && deleteRows([row._id])
      });
    }
    list.push({
      label: gettext('Copy link'),
      callback: () => {
        const { origin } = location;
        let url = `${origin}/workspace/${workspaceID}/project/${projectName}/${BAR_TYPE.TICKET}/${row._id}/`;
        copy(url);
        toaster.success(gettext('The ticket link has been copied'));
      }
    });
    return list;
  }, [projectName, workspaceID]);

  const localStorageName = useMemo(() => `sea-qa-${projectUuid}-type-tickets`, [projectUuid]);

  const t = useMemo(() => {
    return {
      row: gettext('ticket'),
      rows: gettext('tickets'),
      Rows: gettext('Tickets'),
    };
  }, []);

  if (isLoading || isTypesLoading) return null;
  const type = getRowById(typesData, childrenPageType);
  if (!type) {
    togglePageType(pageType, TICKET_CHILDREN_PAGE_TYPE.ALL);
    return null;
  }

  return (
    <SeaMetadata
      viewID="0000"
      api={api}
      localStorageNamePrefix={localStorageName}
      createContextMenuOptions={createContextMenuOptions}
      expandRow={(row) => togglePageType(row._id)}
      toggleView={() => {}}
      viewTools={['search', 'sorts']}
      isViewComputedOnServer={false}

      // types
      typesData={typesData}
      createType={createType}

      t={t}
    />
  );
};

export default TypeTickets;
