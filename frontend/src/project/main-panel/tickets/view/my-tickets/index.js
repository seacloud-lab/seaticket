import React, { useCallback, useMemo, useRef } from 'react';
import dayjs from 'dayjs';
import { ticketsAPI } from '../../../../api';
import SeaMetadata, { VIEW_TOOL, useDataCache } from '@/sea-metadata';
import { useMetadata, useTicketsPage } from '../../hooks';
import {
  TICKET_PAGE_SLUG_ID, TICKET_PREDEFINED_COLUMN_CONFIG,
  TICKET_NOT_DISPLAY_COLUMNS, PREDEFINED_TICKET_COLUMN_NAME,
  TICKET_COLUMNS_ORDER_CONFIG, TICKET_COLUMNS_WIDTH_CONFIG,
} from '../../constants';
import { BAR_TYPE } from '@/project/constants';
import { gettext } from '@/constants';
import { CenteredLoading } from '@/components';
import context from '@/sea-metadata/context';
import {
  generatorTicketsRowsTools,
  cascadeUpdate, generatorTicketsContextMenuOptions,
} from '../../utils';
import { convertRowToNameValue, convertRowsToNameValue } from '@/sea-metadata/utils/row';
import { useAIChatTools } from '@/project/main-panel/ask/hooks';
import { AI_RESOLVE_TYPE } from '@/project/main-panel/ask/constants';

const viewTools = [
  VIEW_TOOL.ROWS_TOOLS, VIEW_TOOL.VIEWS,
  VIEW_TOOL.SEARCH, VIEW_TOOL.FILTERS, VIEW_TOOL.SORTS, VIEW_TOOL.GROUPBYS, VIEW_TOOL.ROW_HEIGHT, VIEW_TOOL.ORDER_HIDDEN,
];

const MyTickets = ({ projectUuid, workspaceID, projectName, permission, toggleBar }) => {

  const { togglePageSlugId, viewID, toggleView, isLoading } = useTicketsPage();
  const { tagsData, createTag, typesData, createType, substatesData, createSubstate } = useMetadata();
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
    navigation: [
      { _id: 'open', type: 'view' },
      { _id: 'closed', type: 'view' },
    ],
    views: [
      {
        _id: 'open',
        name: gettext('Open'),
      }, {
        _id: 'closed',
        name: gettext('Closed'),
      },
    ]
  }), []);

  const api = useMemo(() => ({
    getMetadata: (...params) => {
      const { view_id } = params[0];
      if (cachedData && cachedData.view?._id === view_id && dayjs(currentTime.current).diff(cachedData.create_at, 'hours') < 1) {
        return new Promise((resolve, reject) => {
          const rows = cachedData.rows;
          const columns = cachedData.columns;
          const typeColum = columns.find(c => c.name === PREDEFINED_TICKET_COLUMN_NAME.TYPE);
          if (typeColum) {
            context.setSetting('typeColumnKey', typeColum.key);
          }
          const tagsColumn = columns.find(c => c.name === PREDEFINED_TICKET_COLUMN_NAME.TAGS);
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
      const sorts = context.localStorage.getItem('sorts') || [];
      const filters = context.localStorage.getItem('filters') || [];
      const filter_conjunction = context.localStorage.getItem('filter_conjunction') || 'And';
      const basic_filters = context.localStorage.getItem('basic_filters') || [];
      return ticketsAPI.listMyTickets(projectUuid, { ...params[0], filters, filter_conjunction, basic_filters, sorts }).then(res => {
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
        const typeColum = columns.find(c => c.name === PREDEFINED_TICKET_COLUMN_NAME.TYPE);
        if (typeColum) {
          context.setSetting('typeColumnKey', typeColum.key);
        }
        const tagsColumn = columns.find(c => c.name === PREDEFINED_TICKET_COLUMN_NAME.TAGS);
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
        resolve({
          data: {
            view: {
              ...view,
              sorts: context.localStorage.getItem('sorts') || [],
              groupbys: context.localStorage.getItem('groupbys') || [],
              filters: context.localStorage.getItem('filters') || [],
              filter_conjunction: context.localStorage.getItem('filter_conjunction') || 'And',
              basic_filters: context.localStorage.getItem('basic_filters') || [],
              row_height: context.localStorage.getItem('row_height') || '',
              hidden_columns: context.localStorage.getItem('hidden_columns') || [],
              columns_keys: context.localStorage.getItem('columns_keys') || [],
            }
          }
        });
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
      const rowData = convertRowToNameValue(row_update, { data, typesData, tagsData });
      return ticketsAPI.modifyProjectTicket(projectUuid, row_id, rowData, isCopyPaste);
    },
    modifyRows: (rowsUpdate, isCopyPaste, { data, typesData, tagsData } = {}) => {
      const rowsData = convertRowsToNameValue(rowsUpdate, { data, typesData, tagsData });
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

  const dataDidMount = useCallback((data) => {
    if (data.view.basic_filters.length !== 2) {
      data.view.basic_filters = [
        { column_key: context.getSetting('typeColumnKey'), filter_predicate: 'is_any_of', filter_term: [] },
        { column_key: context.getSetting('tagsColumnKey'), filter_predicate: 'has_any_of', filter_term: [] },
      ];
    }
  }, []);

  if (isLoading) return (<CenteredLoading />);

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
      toggleView={toggleView}
      settings={{ isFilterComputedOnServer: true, isSortComputedOnServer: true, canManageView: false }}
      dataDidMount={dataDidMount}
      viewTools={viewTools}
      tagsData={tagsData}
      createTag={createTag}
      toggleAllTags={() => togglePageSlugId(TICKET_PAGE_SLUG_ID.TAGS)}
      typesData={typesData}
      createType={createType}
      toggleAllTypes={() => togglePageSlugId(TICKET_PAGE_SLUG_ID.TYPES)}
      substatesData={substatesData}
      createSubstate={createSubstate}
      toggleAllSubstates={() => togglePageSlugId(TICKET_PAGE_SLUG_ID.SUBSTATES)}
      cascadeUpdateCells={cascadeUpdate}
      columnOrderRules={TICKET_COLUMNS_ORDER_CONFIG}
      columnWidthRules={TICKET_COLUMNS_WIDTH_CONFIG}
    />
  );
};

export default MyTickets;
