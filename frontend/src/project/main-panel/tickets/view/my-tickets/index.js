import React, { useCallback, useMemo, useRef } from 'react';
import dayjs from 'dayjs';
import { ticketsAPI } from '../../../../api';
import SeaMetadata, { VIEW_TOOL } from '@/sea-metadata';
import { useMetadata, useTicketsPage, useDataCache } from '../../hooks';
import { TICKET_PAGE_SLUG_ID, TICKET_PREDEFINED_COLUMN_CONFIG, TICKET_NOT_DISPLAY_COLUMNS } from '../../constants';
import { BAR_TYPE } from '@/project/constants';
import { gettext } from '@/constants';
import { CenteredLoading } from '@/components';
import context from '@/sea-metadata/context';
import {
  generatorTicketsRowsTools,
  convertRowToServerData, convertRowsToServerData,
  cascadeUpdateSubState, generatorTicketsContextMenuOptions,
} from '../../utils';
import { useAIChatTools } from '@/project/main-panel/ask/hooks';
import { AI_RESOLVE_TYPE } from '@/project/main-panel/ask/constants';

const MyTickets = ({ projectUuid, workspaceID, projectName, permission, toggleBar }) => {

  const { togglePageSlugId, toggleView, isLoading } = useTicketsPage();
  const { tagsData, createTag, typesData, createType, substatesData, createSubstate,
    isLoading: isMetadataLoading } = useMetadata();
  const { cachedData, cacheData, clearCacheData } = useDataCache();
  const { updateAttachments } = useAIChatTools();

  const metadataRef = useRef(null);
  const currentTime = useRef(new Date());

  const expandRow = useCallback((row) => {
    const data = metadataRef.current.getData();
    cacheData(data);
    togglePageSlugId(row._id);
  }, [togglePageSlugId, cacheData]);

  const myTicketViewsData = useMemo(() => ({
    navigation: [{ _id: 'open', type: 'view' }],
    views: [
      {
        _id: 'open',
        name: gettext('Open'),
      }
    ]
  }), []);

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
          const statusColumn = columns.find(c => c.name === 'state');
          if (statusColumn) {
            context.setSetting('stateColumnKey', statusColumn.key);
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
      return ticketsAPI.listMyTickets(projectUuid, ...params).then(res => {
        const rows = Array.isArray(res.data.tickets) ? res.data.tickets : [];
        let columns = res?.data?.columns || [];
        const othersConfig = {
          'title': { click: (row) => togglePageSlugId(row._id) },
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
        const stateColumn = columns.find(c => c.name === 'state');
        if (stateColumn) {
          context.setSetting('stateColumnKey', stateColumn.key);
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
      return new Promise((resolve, reject) => {
        resolve({ data: myTicketViewsData });
      });
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
      return new Promise((resolve, reject) => {
        const view = myTicketViewsData.views[0];
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

    // row
    insertRow: () => togglePageSlugId(TICKET_PAGE_SLUG_ID.NEW),
    modifyRow: (row_id, row_update, isCopyPaste, { data, typesData, tagsData } = {}) => {
      const rowData = convertRowToServerData(row_update, { data, typesData, tagsData });
      return ticketsAPI.modifyProjectTicket(projectUuid, row_id, rowData, isCopyPaste);
    },
    modifyRows: (rowsUpdate, isCopyPaste, { data, typesData, tagsData } = {}) => {
      const rowsData = convertRowsToServerData(rowsUpdate, { data, typesData, tagsData });
      return ticketsAPI.modifyProjectTickets(projectUuid, rowsData, isCopyPaste);
    },
    deleteRow: (...params) => ticketsAPI.deleteProjectTicket(projectUuid, ...params),
    deleteRows: (...params) => ticketsAPI.deleteProjectTickets(projectUuid, ...params),

    // file
    uploadFile: (...params) => ticketsAPI.uploadFile(projectUuid, ...params),
  }), [projectUuid, cachedData, myTicketViewsData, clearCacheData]);

  const localStorageName = useMemo(() => `sea-qa-${projectUuid}-my-tickets`, [projectUuid]);

  const t = useMemo(() => {
    return {
      row: gettext('ticket'),
      rows: gettext('tickets'),
      Row: gettext('Ticket'),
      Rows: gettext('Tickets'),
    };
  }, []);

  const chatTicketsByAI = useCallback((tickets) => {
    updateAttachments(tickets, AI_RESOLVE_TYPE.AGENT);
    toggleBar([BAR_TYPE.CHAT]);
  }, [toggleBar, updateAttachments]);

  const createRowsTools = useCallback((props) => {
    return generatorTicketsRowsTools({ ...props, projectName, workspaceID, chatTicketsByAI });
  }, [workspaceID, projectName, chatTicketsByAI]);

  const createContextMenuOptions = useCallback((props) => {
    return generatorTicketsContextMenuOptions({ ...props, projectName, workspaceID, chatTicketsByAI });
  }, [projectName, workspaceID, chatTicketsByAI]);

  if (isLoading || isMetadataLoading) return (<CenteredLoading />);

  return (
    <SeaMetadata
      ref={metadataRef}
      viewID={''}
      api={api}
      t={t}
      fixedColumnCount={2}
      localStorageNamePrefix={localStorageName}
      permission={permission}
      createContextMenuOptions={createContextMenuOptions}
      createRowsTools={createRowsTools}
      expandRow={expandRow}
      toggleView={toggleView}
      isViewComputedOnServer={false}
      viewTools={[VIEW_TOOL.ROWS_TOOLS, VIEW_TOOL.VIEWS, VIEW_TOOL.SEARCH, VIEW_TOOL.SORTS, VIEW_TOOL.GROUPBYS]}
      tagsData={tagsData}
      createTag={createTag}
      toggleAllTags={() => togglePageSlugId(TICKET_PAGE_SLUG_ID.TAGS)}
      typesData={typesData}
      createType={createType}
      toggleAllTypes={() => togglePageSlugId(TICKET_PAGE_SLUG_ID.TYPES)}
      substatesData={substatesData}
      createSubstate={createSubstate}
      toggleAllSubstates={() => togglePageSlugId(TICKET_PAGE_SLUG_ID.SUBSTATES)}
      cascadeUpdateCells={cascadeUpdateSubState}
    />
  );
};

export default MyTickets;
