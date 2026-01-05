import React, { useCallback, useMemo, useRef } from 'react';
import { ticketsAPI } from '../../../../api';
import SeaMetadata, { VIEW_TOOL } from '@/sea-metadata';
import { useMetadata, useTicketsPage } from '../../hooks';
import { TICKET_PREDEFINED_COLUMN_CONFIG, TICKET_NOT_DISPLAY_COLUMNS } from '../../constants';
import { gettext } from '@/constants';
import { CenteredLoading, toaster } from '@/components';
import context from '@/sea-metadata/context';
import CleanTickets from './clean-tickets';

const TrashTickets = ({ projectUuid, workspaceID, projectName, permission }) => {

  const { toggleView, isLoading } = useTicketsPage();
  const { tagsData, typesData, substatesData, isLoading: isMetadataLoading } = useMetadata();

  const metadataRef = useRef(null);

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
    getMetadata: (...params) => {
      return ticketsAPI.listTicketsTrash(projectUuid, ...params).then(res => {
        const rows = Array.isArray(res.data.tickets) ? res.data.tickets : [];
        let columns = res?.data?.columns || [];
        const othersConfig = {};
        columns = columns.filter(c => !TICKET_NOT_DISPLAY_COLUMNS.includes(c.name)).map(c => {
          const { name } = c;
          const predefinedConfig = TICKET_PREDEFINED_COLUMN_CONFIG[name];
          const otherConfig = othersConfig[name];
          return {
            ...c,
            ...predefinedConfig,
            ...otherConfig,
          };
        });
        const typeColum = columns.find(c => c.name === 'type');
        if (typeColum) {
          context.setSetting('typeColumnKey', typeColum.key);
        }
        const stateColumn = columns.find(c => c.name === 'state');
        if (stateColumn) {
          context.setSetting('stateColumnKey', stateColumn.key);
        }
        const tagsColumn = columns.find(c => c.name === 'tags');
        if (tagsColumn) {
          context.setSetting('tagsColumnKey', tagsColumn.key);
        }
        return {
          data: {
            rows,
            columns,
          }
        };
      });
    },

    getViews: () => {
      return new Promise((resolve, reject) => {
        resolve({ data: viewsData });
      });
    },

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
    modifyView: (viewID, viewData) => {
      return new Promise((resolve, reject) => {
        Object.keys(viewData).forEach(key => {
          context.localStorage.setItem(key, viewData[key]);
        });
        resolve({ data: { success: true } });
      });
    },
  }), [projectUuid, viewsData]);

  const localStorageName = useMemo(() => `sea-qa-${projectUuid}-deleted-tickets`, [projectUuid]);

  const t = useMemo(() => {
    return {
      row: gettext('ticket'),
      rows: gettext('tickets'),
      Row: gettext('Ticket'),
      Rows: gettext('Tickets'),
    };
  }, []);

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
        ticketsAPI.restoreTickets(projectUuid, rowIds).then(res => {
          deleteLocalRows(rowIds);
          selectNone && selectNone();
          toaster.success(gettext('Tickets restored'));
        }).catch(error => {
          toaster.danger(gettext('Failed to restore tickets'));
        });
      },
    });
    return tools;
  }, [workspaceID, projectName]);

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
    const handleRestoreTickets = (ticketIds) => {
      ticketsAPI.restoreTickets(projectUuid, ticketIds).then(res => {
        deleteLocalRows(ticketIds);
        selectNone && selectNone();
        toaster.success(gettext('Tickets restored'));
      }).catch(error => {
        toaster.danger(gettext('Failed to restore tickets'));
      });
    };

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
            handleRestoreTickets(rowIds);
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
        callback: () => handleRestoreTickets([row._id]),
      });
    }
    return list;
  }, [projectName, workspaceID]);

  if (isLoading || isMetadataLoading) return (<CenteredLoading />);

  return (
    <>
      <SeaMetadata
        ref={metadataRef}
        viewID={''}
        api={api}
        t={t}
        fixedColumnCount={2}
        localStorageNamePrefix={localStorageName}
        toggleView={toggleView}
        permission={permission}
        settings={{ isFilterComputedOnServer: false, isSortComputedOnServer: false, canManageView: false }}
        viewTools={[VIEW_TOOL.ROWS_TOOLS, VIEW_TOOL.VIEWS, VIEW_TOOL.SEARCH, VIEW_TOOL.SORTS, VIEW_TOOL.GROUPBYS]}
        tagsData={tagsData}
        typesData={typesData}
        substatesData={substatesData}
        createContextMenuOptions={createContextMenuOptions}
        createRowsTools={createRowsTools}
      />
      <CleanTickets projectUuid={projectUuid} />
    </>
  );
};

export default TrashTickets;
