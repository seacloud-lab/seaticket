import React, { useCallback, useMemo } from 'react';
import { ticketsAPI } from '../../../../api';
import { VIEW_TOOL } from '@/sea-metadata';
import { EVENT_BUS_TYPE as SEA_METADATA_EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import { gettext } from '@/constants';
import { toaster } from '@/components';
import context from '@/sea-metadata/context';
import CleanTickets from './clean-tickets';
import Tickets from '../../components/tickets';
import { useData } from '@/project/hooks';
import { TICKET_TABLE_NAME } from '../../constants';
import { useTicketsPage } from '../../hooks';

const viewTools = [VIEW_TOOL.ROWS_TOOLS, VIEW_TOOL.VIEWS, VIEW_TOOL.SEARCH, VIEW_TOOL.SORTS, VIEW_TOOL.GROUPBYS];

const TrashTickets = ({ projectUuid, workspaceID, projectName, permission, toggleBar }) => {

  const { clearViewRows, restoreRows } = useData();
  const { isLoading, togglePageSlugId } = useTicketsPage();

  const viewsData = useMemo(() => ({
    navigation: [{ _id: 'all', type: 'view' }],
    views: [
      {
        _id: 'all',
        name: gettext('All'),
      }
    ]
  }), []);

  const api = useMemo(() => ({
    getMetadata: (...params) => ticketsAPI.listTicketsTrash(projectUuid, ...params),

    getViews: () => new Promise((resolve, reject) => resolve({ data: viewsData })),

    // view
    getView: (viewID) => {
      return new Promise((resolve, reject) => {
        const view = viewsData.views[0];
        resolve({ data: { view: {
          ...view,
          sorts: context.localStorage.getItem('sorts') || [],
          groupbys: context.localStorage.getItem('groupbys') || [],
        } } });
      });
    },
    modifyView: (viewID, viewData) => new Promise((resolve, reject) => {
      Object.keys(viewData).forEach(key => {
        context.localStorage.setItem(key, viewData[key]);
      });
      resolve({ data: { success: true } });
    }),
  }), [projectUuid, viewsData]);

  const localStorageNamePrefix = useMemo(() => `seaqa-${projectUuid}-deleted-tickets`, [projectUuid]);

  const handleRestoreTickets = useCallback((ticketIds, { deleteLocalRows, selectNone }) => {
    ticketsAPI.restoreTickets(projectUuid, ticketIds).then(res => {
      deleteLocalRows(ticketIds);
      selectNone && selectNone();
      toaster.success(gettext('Tickets restored'));
      restoreRows(TICKET_TABLE_NAME, ticketIds);
    }).catch(error => {
      toaster.danger(gettext('Failed to restore tickets'));
    });
  }, [projectUuid, restoreRows]);

  const createRowsTools = useCallback(({ rows, deleteLocalRows, selectNone }) => {
    let tools = [];
    tools.push({
      key: 'restore',
      icon: 'revoke',
      label: gettext('Restore'),
      callback: (event) => {
        event && event.stopPropagation();
        event?.nativeEvent && event.nativeEvent.stopImmediatePropagation();
        const rowIds = rows.map(r => r._id);
        handleRestoreTickets(rowIds, { deleteLocalRows, selectNone });
      },
    });
    return tools;
  }, [workspaceID, projectName, handleRestoreTickets]);

  const createContextMenuOptions = useCallback(({
    isGroupView,
    selectedRange,
    selectedPosition,
    position,
    table,
    rowMetrics,
    deleteRow,
    deleteLocalRows,
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
      list.push({
        label: gettext('Copy selected'),
        key: 'copy_selected',
        callback: onCopySelected,
      });
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

      if (rows.length > 0) {
        list.push({
          label: gettext('Restore'),
          key: 'restore',
          callback: (event) => {
            const rowIds = rows.map(row => row._id);
            handleRestoreTickets(rowIds, { deleteLocalRows, selectNone });
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

    if (selectedRowIds.length === 1) {
      list.push({
        label: gettext('Restore'),
        key: 'restore',
        callback: () => handleRestoreTickets([row._id], { deleteLocalRows, selectNone }),
      });
    }
    return list;
  }, [projectName, workspaceID, handleRestoreTickets]);

  const cleanTickets = useCallback(() => {
    clearViewRows(TICKET_TABLE_NAME, 'trash', () => ticketsAPI.cleanTicketsTrash(projectUuid), true).then(() => {
      context.eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.CLEAR_DATA);
      toaster.success(gettext('The ticket trash cleaned'));
    }).catch(() => {
      toaster.danger(gettext('Failed to clean the ticket trash'));
    });
  }, [projectUuid, clearViewRows]);

  return (
    <>
      <Tickets
        localStorageNamePrefix={localStorageNamePrefix}
        projectUuid={projectUuid}
        workspaceID={workspaceID}
        projectName={projectName}
        permission={permission}
        isShowViewInURL={false}
        toggleBar={toggleBar}
        api={api}
        settings={{ isFilterComputedOnServer: false, isSortComputedOnServer: false, canManageView: false }}
        viewTools={viewTools}
        createRowsTools={createRowsTools}
        createContextMenuOptions={createContextMenuOptions}
        isBuiltInView={true}
        isLoading={isLoading}
        togglePageSlugId={togglePageSlugId}
      />
      <CleanTickets cleanTickets={cleanTickets} />
    </>
  );
};

export default TrashTickets;
