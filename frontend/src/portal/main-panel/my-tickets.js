import React, { useCallback, useMemo, useState } from 'react';
import { VIEW_TOOL } from '@/sea-metadata';
import { gettext } from '@/constants';
import context from '@/sea-metadata/context';
import { portalAPI } from '../api';
import Tickets from '@/project/main-panel/tickets/components/tickets';

const viewTools = [
  VIEW_TOOL.ROWS_TOOLS, VIEW_TOOL.VIEWS,
  VIEW_TOOL.SEARCH, VIEW_TOOL.FILTERS, VIEW_TOOL.SORTS, VIEW_TOOL.GROUPBYS, VIEW_TOOL.ROW_HEIGHT, VIEW_TOOL.ORDER_HIDDEN,
];

const MyTickets = ({ projectUuid, projectName, workspaceID }) => {

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
      const sorts = context.localStorage.getItem('sorts') || [];
      const filters = context.localStorage.getItem('filters') || [];
      const filter_conjunction = context.localStorage.getItem('filter_conjunction') || 'And';
      const basic_filters = context.localStorage.getItem('basic_filters') || [];
      return portalAPI.listMyTickets(projectUuid, { ...params[0], filters, filter_conjunction, basic_filters, sorts });
    },

    getViews: () => new Promise((resolve, reject) => resolve({ data: myTicketViewsData })),

    // view
    getView: (viewID) => {
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
    modifyView: (viewID, viewData) => new Promise((resolve, reject) => {
      Object.keys(viewData).forEach(key => {
        context.localStorage.setItem(key, viewData[key]);
      });
      resolve({ data: { success: true } });
    }),

    // file
    uploadFile: (...params) => portalAPI.uploadFile(projectUuid, ...params),
  }), [projectUuid, myTicketViewsData]);

  const localStorageNamePrefix = useMemo(() => `sea-qa-${projectUuid}-my-tickets`, [projectUuid]);

  const [viewID, setViewID] = useState('open');

  const toggleView = useCallback((newViewID) => {
    setViewID(newViewID);
  }, []);

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
      permission="r"
      viewID={viewID}
      api={api}
      localStorageNamePrefix={localStorageNamePrefix}
      settings={{ isFilterComputedOnServer: true, isSortComputedOnServer: true, canManageView: false }}
      dataDidMount={dataDidMount}
      viewTools={viewTools}
      isBuiltInView={true}
      toggleView={toggleView}
      createContextMenuOptions={() => []}
      createRowsTools={() => []}
    />
  );
};

export default MyTickets;
