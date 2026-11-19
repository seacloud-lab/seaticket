import React, { useCallback, useMemo } from 'react';
import { username } from '@/constants';
import { ticketsAPI } from '@/project/api';
import { MY_TICKETS_SCOPE } from '@/project/utils';
import { VIEW_TOOL } from '@/sea-metadata';
import context from '@/sea-metadata/context';
import { getColumnByName } from '@/sea-metadata/utils/column';
import Tickets from '../../components/tickets';
import { MY_TICKETS_VIEW_IDS, PREDEFINED_TICKET_COLUMN_NAME } from '../../constants';
import { useTicketsPage } from '../../hooks';

const viewTools = [
  VIEW_TOOL.ROWS_TOOLS, VIEW_TOOL.VIEWS,
  VIEW_TOOL.SEARCH, VIEW_TOOL.FILTERS, VIEW_TOOL.SORTS, VIEW_TOOL.GROUPBYS, VIEW_TOOL.ROW_COLOR, VIEW_TOOL.ROW_HEIGHT, VIEW_TOOL.ORDER_HIDDEN,
];

const isUnassignedFromMe = (update, columns) => {
  const assigneesColumn = getColumnByName(columns, PREDEFINED_TICKET_COLUMN_NAME.ASSIGNEES);
  const assignees = update?.[assigneesColumn?.key];
  return Boolean(username) && (assignees === null || (Array.isArray(assignees) && !assignees.includes(username)));
};

const MyTickets = ({ projectUuid, workspaceID, projectName, permission, toggleBar, scope }) => {
  const { isLoading, togglePageSlugId } = useTicketsPage();
  const isCreated = scope === MY_TICKETS_SCOPE.CREATED;
  const viewIDs = isCreated ? MY_TICKETS_VIEW_IDS.created : MY_TICKETS_VIEW_IDS.assigned;

  const myTicketViewsData = useMemo(() => {
    const views = [
      { _id: viewIDs.open, name: 'Open', state: 'open' },
      { _id: viewIDs.closed, name: 'Closed', state: 'closed' },
    ];
    return { navigation: views.map(({ _id }) => ({ _id, type: 'view' })), views };
  }, [viewIDs]);

  const api = useMemo(() => ({
    getMetadata: ({ view_id: viewID, ...params }) => {
      const sorts = context.localStorage.getItem('sorts') || [];
      const filters = context.localStorage.getItem('filters') || [];
      const filter_conjunction = context.localStorage.getItem('filter_conjunction') || 'And';
      const basic_filters = context.localStorage.getItem('basic_filters') || [];
      const isUnfiltered = Array.isArray(filters) && filters.length === 0 && Array.isArray(basic_filters)
        && basic_filters.every(filter => (
          ['is_any_of', 'has_any_of'].includes(filter?.filter_predicate) && Array.isArray(filter.filter_term) && filter.filter_term.length === 0
        ));
      const usesDefaultSort = Array.isArray(sorts) && sorts.length === 0;
      const view = myTicketViewsData.views.find(v => v._id === viewID) || myTicketViewsData.views[0];
      return ticketsAPI.listMyTickets(projectUuid, { ...params, view_id: view.state, scope, filters, filter_conjunction, basic_filters, sorts })
        .then(res => ({ ...res, data: { ...res.data, isUnfiltered, usesDefaultSort } }));
    },

    getViews: () => new Promise((resolve, reject) => resolve({ data: myTicketViewsData })),

    // view
    getView: (viewID) => {
      return new Promise((resolve, reject) => {
        const view = myTicketViewsData.views.find(v => v._id === viewID) || myTicketViewsData.views[0];
        resolve({
          data: {
            view: {
              ...view,
              sorts: context.localStorage.getItem('sorts') || [],
              groupbys: context.localStorage.getItem('groupbys') || [],
              filters: context.localStorage.getItem('filters') || [],
              filter_conjunction: context.localStorage.getItem('filter_conjunction') || 'And',
              basic_filters: context.localStorage.getItem('basic_filters') || [],
              colorbys: context.localStorage.getItem('colorbys') || {},
              row_height: context.localStorage.getItem('row_height') || '',
              hidden_columns: context.localStorage.getItem('hidden_columns') || [],
              columns_keys: context.localStorage.getItem('columns_keys') || [],
            }
          }
        });
      });
    },
    modifyView: (viewID, viewData) => new Promise((resolve, reject) => {
      Object.keys(viewData).forEach(key => {
        context.localStorage.setItem(key, viewData[key]);
      });
      resolve({ data: { success: true } });
    }),

    // row
    modifyRow: (...params) => ticketsAPI.modifyProjectTicket(projectUuid, ...params),
    modifyRows: (...params) => ticketsAPI.modifyProjectTickets(projectUuid, ...params),
    deleteRow: (...params) => ticketsAPI.deleteProjectTicket(projectUuid, ...params),
    deleteRows: (...params) => ticketsAPI.deleteProjectTickets(projectUuid, ...params),

    // file
    uploadFile: (...params) => ticketsAPI.uploadFile(projectUuid, ...params),
  }), [projectUuid, scope, myTicketViewsData]);

  const localStorageNamePrefix = useMemo(() => `seaqa-${projectUuid}-my-tickets`, [projectUuid]);

  const dataDidMount = useCallback((data) => {
    if (data.view.basic_filters.length !== 2) {
      data.view.basic_filters = [
        { column_key: context.getSetting('typeColumnKey'), filter_predicate: 'is_any_of', filter_term: [] },
        { column_key: context.getSetting('tagsColumnKey'), filter_predicate: 'has_any_of', filter_term: [] },
      ];
    }
  }, []);

  return (
    <Tickets
      projectUuid={projectUuid}
      workspaceID={workspaceID}
      projectName={projectName}
      permission={permission}
      toggleBar={toggleBar}
      api={api}
      localStorageNamePrefix={localStorageNamePrefix}
      settings={{ isFilterComputedOnServer: true, isSortComputedOnServer: true, canManageView: false }}
      dataDidMount={dataDidMount}
      shouldRemoveRowAfterUpdate={isCreated ? undefined : isUnassignedFromMe}
      viewTools={viewTools}
      isBuiltInView={true}
      isLoading={isLoading}
      togglePageSlugId={togglePageSlugId}
    />
  );
};

export default MyTickets;
