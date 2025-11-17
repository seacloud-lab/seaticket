import React, { useCallback, useMemo, useRef } from 'react';
import copy from 'copy-to-clipboard';
import dayjs from 'dayjs';
import { ticketsAPI } from '../../../../api';
import SeaMetadata from '@/sea-metadata';
import { useTags, useTypes, useSubstates, useTicketsPage, useDataCache } from '../../hooks';
import { TICKET_PAGE_TYPE, TICKET_PREDEFINED_COLUMN_CONFIG, TICKET_NOT_DISPLAY_COLUMNS } from '../../constants';
import { BAR_TYPE } from '@/project/constants/bar';
import { TicketForTickets } from '../../models';
import { gettext } from '@/constants';
import { toaster } from '@/components';
import context from '@/sea-metadata/context';
import { generatorRowCopyLinkTool, generatorRowsMoreTool } from '../../utils';

const AllTickets = ({ projectUuid, workspaceID, projectName, permission }) => {

  const { togglePageType, viewID, updateViewID, isLoading } = useTicketsPage();
  const { tagsData, createTag } = useTags();
  const { typesData, createType, isLoading: isTypesLoading } = useTypes();
  const { substatesData, createSubstate, isLoading: isSubstatesLoading } = useSubstates();
  const { cachedData, cacheData, clearCacheData } = useDataCache();
  const metadataRef = useRef(null);
  const currentTime = useRef(new Date());

  const expandRow = useCallback((row) => {
    const data = metadataRef.current.getData();
    cacheData(data);
    togglePageType(row._id);
  }, [togglePageType, cacheData]);

  const api = useMemo(() => ({
    getMetadata: (...params) => {
      const { view_id } = params[0];
      if (cachedData && cachedData.view?._id === view_id && dayjs(currentTime.current).diff(cachedData.create_at, 'hours') < 1) {
        return new Promise((resolve, reject) => {
          const rows = cachedData.rows;
          const columns = cachedData.columns;
          const typeColum = columns.find(c => c.name === 'type');
          if (typeColum) {
            context.setSetting('typeColumnKey', typeColum.key);
          }
          const statusColumn = columns.find(c => c.name === 'status');
          if (statusColumn) {
            context.setSetting('statusColumnKey', statusColumn.key);
          }
          const tagsColumn = columns.find(c => c.name === 'tags');
          if (tagsColumn) {
            context.setSetting('tagsColumnKey', tagsColumn.key);
          }
          resolve({
            data: {
              rows: rows,
              columns: columns,
            }
          });
        }).then(res => {
          clearCacheData();
          return res;
        });
      }
      return ticketsAPI.listProjectTickets(projectUuid, ...params).then(res => {
        const rows = Array.isArray(res.data.tickets) ? res.data.tickets.map(t => new TicketForTickets(t)) : [];
        let columns = res?.data?.columns || [];
        const othersConfig = {
          'title': { click: (row) => togglePageType(row._id) },
        };
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
        const statusColumn = columns.find(c => c.name === 'status');
        if (statusColumn) {
          context.setSetting('statusColumnKey', statusColumn.key);
        }
        const tagsColumn = columns.find(c => c.name === 'tags');
        if (tagsColumn) {
          context.setSetting('tagsColumnKey', tagsColumn.key);
        }
        clearCacheData();
        return {
          data: {
            rows,
            columns,
          }
        };
      });
    },

    getViews: () => {
      if (cachedData && cachedData.views && dayjs(currentTime.current).diff(cachedData.create_at, 'hours') < 1) {
        return new Promise((resolve, reject) => {
          resolve({
            data: cachedData.views
          });
        });
      }
      return ticketsAPI.listViews(projectUuid);
    },

    // view
    getView: (viewID) => {
      if (cachedData && cachedData.view?._id === viewID && dayjs(currentTime.current).diff(cachedData.create_at, 'hours') < 1) {
        return new Promise((resolve, reject) => {
          resolve({
            data: {
              view: cachedData.view
            }
          });
        });
      }
      return ticketsAPI.getView(projectUuid, viewID);
    },
    insertView: (name, viewData) => ticketsAPI.insertView(projectUuid, name, viewData),
    modifyView: (viewID, viewData) => ticketsAPI.modifyView(projectUuid, viewID, viewData),
    deleteView: (viewID) => ticketsAPI.deleteView(projectUuid, viewID),
    moveView: (sourceViewID, targetViewID) => ticketsAPI.moveView(projectUuid, sourceViewID, targetViewID),
    duplicateView: (viewID) => ticketsAPI.duplicateView(projectUuid, viewID),

    // row
    insertRow: () => togglePageType(TICKET_PAGE_TYPE.NEW),
    modifyRow: (...params) => ticketsAPI.modifyProjectTicket(projectUuid, ...params),
    deleteRow: (...params) => ticketsAPI.deleteProjectTicket(projectUuid, ...params),
    deleteRows: (...params) => ticketsAPI.deleteProjectTickets(projectUuid, ...params),

    // file
    uploadFile: (...params) => ticketsAPI.uploadFile(projectUuid, ...params),

  }), [projectUuid, cachedData, updateViewID, clearCacheData]);

  const localStorageName = useMemo(() => `sea-qa-${projectUuid}-tickets`, [projectUuid]);

  const t = useMemo(() => {
    return {
      row: gettext('ticket'),
      rows: gettext('tickets'),
      Row: gettext('Ticket'),
      Rows: gettext('Tickets'),
    };
  }, []);

  const createRowsTools = useCallback(({ rows, modifyRows }) => {
    let tools = [];
    if (rows.length === 1) {
      const row = rows[0];
      const tool = generatorRowCopyLinkTool({ row, workspaceID, projectName });
      tools.push(tool);
    }
    const moreTool = generatorRowsMoreTool({ rows, modifyRows });
    tools.push(moreTool);
    return tools;
  }, [workspaceID, projectName]);

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

  if (isLoading || isTypesLoading || isSubstatesLoading) return null;

  return (
    <SeaMetadata
      ref={metadataRef}
      viewID={viewID}
      api={api}
      t={t}
      fixedColumnCount={2}
      localStorageNamePrefix={localStorageName}
      permission={permission}
      createContextMenuOptions={createContextMenuOptions}
      createRowsTools={createRowsTools}
      expandRow={expandRow}
      toggleView={updateViewID}
      tagsData={tagsData}
      createTag={createTag}
      toggleAllTags={() => togglePageType(TICKET_PAGE_TYPE.TAGS)}
      typesData={typesData}
      createType={createType}
      toggleAllTypes={() => togglePageType(TICKET_PAGE_TYPE.TYPES)}
      substatesData={substatesData}
      createSubstate={createSubstate}
      toggleAllSubstates={() => togglePageType(TICKET_PAGE_TYPE.SUBSTATES)}
    />
  );
};

export default AllTickets;
