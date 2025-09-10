import React, { useCallback, useMemo } from 'react';
import copy from 'copy-to-clipboard';
import { ticketsAPI } from '../../../../api';
import SeaMetadata, { CellType } from '@/sea-metadata';
import { useTags, useTypes, useTicketsPage } from '../../hooks';
import { TICKET_PAGE_TYPE, TICKET_STATUS_OPTIONS } from '../../constants';
import { BAR_TYPE } from '@/project/constants/bar';
import { TicketForTickets } from '../../models';
import { gettext } from '@/constants';
import { toaster } from '@/components';

const AllTickets = ({ projectUuid, workspaceID, projectName, permission }) => {

  const { togglePageType, viewID, updateViewID, isLoading } = useTicketsPage();
  const { tagsData, createTag } = useTags();
  const { typesData, createType, isLoading: isTypesLoading } = useTypes();

  const columns = useMemo(() => [
    {
      type: CellType.RATE,
      key: 'priority',
      name: gettext('Priority'),
      editable: true,
      frozen: true,
      width: 33,
      data: { type: 'rate' }
    }, {
      type: CellType.TEXT,
      key: 'title',
      name: gettext('Title'),
      editable: true,
      is_name_column: true,
      frozen: true,
      is_required: true,
      click: (row) => togglePageType(row._id)
    }, {
      type: CellType.SINGLE_SELECT,
      key: 'status',
      name: gettext('Status'),
      editable: true,
      data: { options: TICKET_STATUS_OPTIONS },
      is_required: true,
    }, {
      type: CellType.TYPE,
      key: 'type',
      name: gettext('Type'),
      editable: true,
    }, {
      type: CellType.LONG_TEXT,
      key: 'content',
      name: gettext('Description'),
      editable: true,
      is_required: true,
    }, {
      type: CellType.COLLABORATOR,
      key: 'assignees',
      name: gettext('Assignees'),
      editable: true,
    }, {
      type: CellType.TAGS,
      key: 'tags',
      name: gettext('Tags'),
      editable: true,
      modify_data_able: true,
    }, {
      type: CellType.COLLABORATOR,
      key: 'participants',
      name: gettext('Participants'),
      editable: false,
    }, {
      type: CellType.CTIME,
      key: 'created_at',
      name: gettext('Create time'),
      editable: false,
    }, {
      type: CellType.CREATOR,
      key: 'creator',
      name: gettext('Creator'),
      editable: false,
    },
  ], [togglePageType, typesData]);

  const api = useMemo(() => ({
    getMetadata: (...params) => {
      return ticketsAPI.listProjectTickets(projectUuid, ...params).then(res => {
        const rows = Array.isArray(res.data.tickets) ? res.data.tickets.map(t => new TicketForTickets(t)) : [];
        return {
          data: {
            rows,
            columns,
          }
        };
      });
    },

    getViews: () => ticketsAPI.listViews(projectUuid),

    // view
    getView: (viewID) => ticketsAPI.getView(projectUuid, viewID).then(res => {
      const view = res?.data?.view;
      const basic_filters = view?.basic_filters || [];
      if (basic_filters.length === 3) return { data: { view } };
      return {
        data: {
          view: {
            ...view,
            basic_filters: [
              basic_filters.find(f => f.column_key === 'status') || { column_key: 'status', filter_predicate: 'is_any_of', filter_term: [] },
              basic_filters.find(f => f.column_key === 'type') || { column_key: 'type', filter_predicate: 'is_any_of', filter_term: [] },
              basic_filters.find(f => f.column_key === 'tags') || { column_key: 'type', filter_predicate: 'is_any_of', filter_term: [] },
            ]
          }
        }
      };
    }),
    insertView: (name, viewData) => ticketsAPI.insertView(projectUuid, name, viewData),
    modifyView: (viewID, viewData) => ticketsAPI.modifyView(projectUuid, viewID, viewData),
    deleteView: (viewID) => ticketsAPI.deleteView(projectUuid, viewID),
    moveView: (sourceViewID, targetViewID) => ticketsAPI.moveView(projectUuid, sourceViewID, targetViewID),
    duplicateView: (viewID) => ticketsAPI.duplicateView(projectUuid, viewID),

    // row
    insertRow: () => togglePageType(TICKET_PAGE_TYPE.NEW),
    modifyRow: (...params) => ticketsAPI.modifyProjectTicket(projectUuid, ...params),
    deleteRow: (...params) => ticketsAPI.deleteProjectTicket(projectUuid, ...params),

    // file
    uploadFile: (...params) => ticketsAPI.uploadFile(projectUuid, ...params),

  }), [projectUuid, columns, updateViewID]);

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

  const localStorageName = useMemo(() => `sea-qa-${projectUuid}-tickets`, [projectUuid]);

  const t = useMemo(() => {
    return {
      row: gettext('ticket'),
      rows: gettext('tickets'),
      Row: gettext('Ticket'),
      Rows: gettext('Tickets'),
    };
  }, []);

  if (isLoading || isTypesLoading) return null;

  return (
    <SeaMetadata
      viewID={viewID}
      api={api}
      t={t}
      groupHeaderColSpan={2}
      localStorageNamePrefix={localStorageName}
      permission={permission}
      createContextMenuOptions={createContextMenuOptions}
      expandRow={(row) => togglePageType(row._id)}
      toggleView={updateViewID}
      tagsData={tagsData}
      createTag={createTag}
      toggleAllTags={() => togglePageType(TICKET_PAGE_TYPE.TAGS)}
      typesData={typesData}
      createType={createType}
      toggleAllTypes={() => togglePageType(TICKET_PAGE_TYPE.TYPES)}
    />
  );
};

export default AllTickets;
