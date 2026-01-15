import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import dayjs from 'dayjs';
import SeaMetadata, { VIEW_TOOL, DataCacheProvider, useDataCache } from '@/sea-metadata';
import { gettext } from '@/constants';
import { CenteredLoading } from '@/components';
import context from '@/sea-metadata/context';
import { TICKET_NOT_DISPLAY_COLUMNS, TICKET_COLUMNS_WIDTH_CONFIG } from '@/project/main-panel/tickets/constants';
import { portalAPI } from '../api';

const TICKET_PREDEFINED_COLUMN_CONFIG = {
  'priority': {
    type: 'priority',
    display_name: gettext('Priority'),
    editable: false,
    is_width_fixed: true,
    frozen: true,
    width: 33,
  },
  'title': {
    type: 'text',
    display_name: gettext('Title'),
    editable: false,
    is_name_column: true,
    frozen: true,
  },
  'state': {
    type: 'single-select',
    display_name: gettext('State'),
    editable: false,
  },
  'substate': {
    type: 'single-select',
    display_name: gettext('Substate'),
    editable: false,
  },
  'type': {
    type: 'type',
    display_name: gettext('Type'),
    editable: false,
  },
  'content': {
    type: 'long-text',
    display_name: gettext('Content'),
    editable: false,
  },
  'assignees': {
    type: 'collaborator',
    display_name: gettext('Assignees'),
    editable: false,
  },
  'tags': {
    type: 'tags',
    display_name: gettext('Tags'),
    editable: false,
  },
  'participants': {
    type: 'collaborator',
    display_name: gettext('Participants'),
    editable: false,
  },
  'created_time': {
    type: 'ctime',
    display_name: gettext('Created time'),
    editable: false,
  },
  'modified_time': {
    type: 'mtime',
    display_name: gettext('Last modified time'),
    editable: false,
  },
  'creator': {
    type: 'creator',
    display_name: gettext('Creator'),
    editable: false,
  },
};

const TICKET_COLUMNS_ORDER_CONFIG = {
  'priority': 1,
  'title': 2,
  'type': 3,
  'state': 4,
  'substate': 5,
  'assignees': 6,
  'tags': 7,
  'created_time': 8,
  'modified_time': 9,
  'creator': 10,
};

const viewTools = [
  VIEW_TOOL.VIEWS,
  VIEW_TOOL.SEARCH,
  VIEW_TOOL.FILTERS,
  VIEW_TOOL.SORTS,
  VIEW_TOOL.GROUPBYS,
  VIEW_TOOL.ROW_HEIGHT,
  VIEW_TOOL.ORDER_HIDDEN,
];

const MyTicketsInner = ({ projectUuid, tagsData, typesData }) => {
  const { cachedData, clearCacheData } = useDataCache();
  const metadataRef = useRef(null);
  const currentTime = useRef(new Date());

  const myTicketViewsData = useMemo(() => ({
    navigation: [
      { _id: 'open', type: 'view' },
      { _id: 'closed', type: 'view' },
    ],
    views: [
      { _id: 'open', name: gettext('Open') },
      { _id: 'closed', name: gettext('Closed') },
    ]
  }), []);

  const api = useMemo(() => ({
    getMetadata: (params) => {
      const { view_id } = params;
      if (cachedData && cachedData.view?._id === view_id && dayjs(currentTime.current).diff(cachedData.create_at, 'hours') < 1) {
        return Promise.resolve({
          data: { rows: cachedData.rows, columns: cachedData.columns }
        }).then(res => {
          clearCacheData();
          return res;
        });
      }

      const sorts = context.localStorage.getItem('sorts') || [];
      const filters = context.localStorage.getItem('filters') || [];
      const filter_conjunction = context.localStorage.getItem('filter_conjunction') || 'And';
      const basic_filters = context.localStorage.getItem('basic_filters') || [];

      return portalAPI.listMyTickets(projectUuid, {
        view_id,
        config: { filters, filter_conjunction, basic_filters, sorts }
      }).then(res => {
        let rows = Array.isArray(res.data.tickets) ? res.data.tickets : [];
        const rawColumns = res?.data?.columns || [];

        const pkRawColumn = rawColumns.find(c => c.name === '_pk');
        const pkColumnKey = pkRawColumn ? (pkRawColumn.id || pkRawColumn.key) : undefined;

        let columns = rawColumns;
        columns = columns
          .filter(c => !TICKET_NOT_DISPLAY_COLUMNS.includes(c.name))
          .map(c => {
            const { name } = c;
            const predefinedConfig = TICKET_PREDEFINED_COLUMN_CONFIG[name];
            const columnId = c.id || c.key;
            return {
              ...c,
              ...predefinedConfig,
              original_key: c.key,
              key: columnId,
            };
          });

        rows = rows.map(row => {
          const newRow = { ...row };
          columns.forEach(c => {
            const id = c.key;
            const name = c.name;
            if (id && (newRow[id] === undefined) && (newRow[name] !== undefined)) {
              newRow[id] = newRow[name];
            }
            if (name && (newRow[name] === undefined) && (newRow[id] !== undefined)) {
              newRow[name] = newRow[id];
            }
          });

          if (pkColumnKey) {
            const pkValue = newRow[pkColumnKey] ?? newRow._pk ?? newRow._id;
            if (pkValue !== undefined) {
              newRow[pkColumnKey] = pkValue;
              newRow._pk = pkValue;
              newRow._id = pkValue;
            }
          } else {
            const pkValue = newRow._id ?? newRow._pk;
            if (pkValue !== undefined) {
              newRow._pk = pkValue;
              newRow._id = pkValue;
            }
          }
          return newRow;
        });

        const tagsColumn = columns.find(c => c.name === 'tags');
        if (tagsColumn) {
          context.setSetting('tagsColumnKey', tagsColumn.key);
        }
        clearCacheData();
        return { data: { rows, columns } };
      });
    },

    getViews: () => {
      if (cachedData && cachedData.views && dayjs(currentTime.current).diff(cachedData.create_at, 'hours') < 1) {
        return Promise.resolve({ data: cachedData.views });
      }
      return Promise.resolve({ data: myTicketViewsData });
    },

    getView: (viewID) => {
      if (cachedData && cachedData.view?._id === viewID && dayjs(currentTime.current).diff(cachedData.create_at, 'hours') < 1) {
        return Promise.resolve({ data: { view: cachedData.view } });
      }
      const view = myTicketViewsData.views.find(v => v._id === viewID) || myTicketViewsData.views[0];
      return Promise.resolve({
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
    },

    modifyView: (_viewID, viewData) => {
      return new Promise((resolve) => {
        Object.keys(viewData).forEach(key => {
          context.localStorage.setItem(key, viewData[key]);
        });
        resolve({ data: { success: true } });
      });
    },
  }), [projectUuid, cachedData, myTicketViewsData, clearCacheData]);

  const localStorageName = useMemo(() => `sea-qa-portal-${projectUuid}-my-tickets`, [projectUuid]);

  const t = useMemo(() => ({
    row: gettext('ticket'),
    rows: gettext('tickets'),
    Row: gettext('Ticket'),
    Rows: gettext('Tickets'),
  }), []);

  const [viewID, setViewID] = useState('open');

  const toggleView = useCallback((newViewID) => {
    setViewID(newViewID);
  }, []);

  return (
    <SeaMetadata
      ref={metadataRef}
      viewID={viewID}
      api={api}
      t={t}
      fixedColumnCount={2}
      localStorageNamePrefix={localStorageName}
      permission={{ isAdmin: false, canEdit: false }}
      toggleView={toggleView}
      settings={{
        isFilterComputedOnServer: true,
        isSortComputedOnServer: true,
        canManageView: false,
        canInsertRow: false,
        canDeleteRow: false,
        canModifyRow: false,
      }}
      viewTools={viewTools}
      tagsData={tagsData}
      typesData={typesData}
      columnOrderRules={TICKET_COLUMNS_ORDER_CONFIG}
      columnWidthRules={TICKET_COLUMNS_WIDTH_CONFIG}
    />
  );
};

const MyTickets = ({ projectUuid }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [tagsData, setTagsData] = useState({ rows: [], row_ids: [], id_row_map: {} });
  const [typesData, setTypesData] = useState({ rows: [], row_ids: [], id_row_map: {} });

  useEffect(() => {
    Promise.all([
      portalAPI.listTicketTags(projectUuid).catch(() => ({ data: { tags: [] } })),
      portalAPI.listTicketTypes(projectUuid).catch(() => ({ data: { types: [] } })),
    ]).then(([tagsRes, typesRes]) => {
      const tags = (tagsRes.data.tags || []).map(t => ({ ...t, _id: t.id }));
      const types = (typesRes.data.types || []).map(t => ({ ...t, _id: t.id }));

      const tagsRowMap = {};
      tags.forEach(t => { tagsRowMap[t._id] = t; });

      const typesRowMap = {};
      types.forEach(t => { typesRowMap[t._id] = t; });

      setTagsData({
        rows: tags,
        row_ids: tags.map(t => t._id),
        id_row_map: tagsRowMap,
      });
      setTypesData({
        rows: types,
        row_ids: types.map(t => t._id),
        id_row_map: typesRowMap,
      });
      setIsLoading(false);
    });
  }, [projectUuid]);

  if (isLoading) {
    return <CenteredLoading />;
  }

  return (
    <DataCacheProvider>
      <MyTicketsInner
        projectUuid={projectUuid}
        tagsData={tagsData}
        typesData={typesData}
      />
    </DataCacheProvider>
  );
};

export default MyTickets;
