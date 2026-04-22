import React, { useCallback, useMemo, useState } from 'react';
import { VIEW_TOOL } from '@/sea-metadata';
import { gettext } from '@/constants';
import context from '@/sea-metadata/context';
import { portalAPI } from '../api';
import Issues from '@/project/main-panel/portal-issues/components/issues';

const viewTools = [
  VIEW_TOOL.ROWS_TOOLS, VIEW_TOOL.VIEWS,
  VIEW_TOOL.SEARCH, VIEW_TOOL.FILTERS, VIEW_TOOL.SORTS, VIEW_TOOL.GROUPBYS, VIEW_TOOL.ROW_HEIGHT, VIEW_TOOL.ORDER_HIDDEN,
];

const MyIssues = ({ projectUuid, projectName, workspaceID }) => {

  const myIssueViewsData = useMemo(() => ({
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
      return portalAPI.listMyIssues(projectUuid, { ...params[0], filters, filter_conjunction, basic_filters, sorts }).then((res) => {
        const columns = Array.isArray(res?.data?.columns) ? res.data.columns : [];
        const issues = Array.isArray(res?.data?.issues) ? res.data.issues : [];
        const normalizedIssues = issues.map((row) => {
          if (!row || typeof row !== 'object') return row;
          const nextRow = { ...row, _id: row._pk };
          columns.forEach((column) => {
            const columnName = column?.name;
            const columnKey = column?.key;
            if (!columnName || !columnKey || columnName === columnKey) return;
            if (nextRow[columnName] !== undefined && nextRow[columnKey] === undefined) {
              nextRow[columnKey] = nextRow[columnName];
            }
          });
          return nextRow;
        });

        return {
          ...res,
          data: {
            ...res.data,
            tickets: normalizedIssues,
            linked_record_titles: res.data?.linked_record_titles || {},
          },
        };
      });
    },

    getViews: () => new Promise((resolve, reject) => resolve({ data: myIssueViewsData })),

    // view
    getView: (viewID) => {
      return new Promise((resolve, reject) => {
        const view = myIssueViewsData.views.find(v => v._id === viewID) || myIssueViewsData.views[0];
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
  }), [projectUuid, myIssueViewsData]);

  const localStorageNamePrefix = useMemo(() => `sea-ticket-${projectUuid}-my-issues`, [projectUuid]);

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
    <div className="sea-qa-portal-my-issues">
      <Issues
        projectUuid={projectUuid}
        workspaceID={workspaceID}
        projectName={projectName}
        permission="rw"
        viewID={viewID}
        api={api}
        localStorageNamePrefix={localStorageNamePrefix}
        settings={{ isFilterComputedOnServer: true, isSortComputedOnServer: true, canManageView: false }}
        dataDidMount={dataDidMount}
        viewTools={viewTools}
        canCreateRelatedTickets={false}
        isBuiltInView={true}
        canOpenIssue={false}
        toggleView={toggleView}
        createContextMenuOptions={() => []}
      />
    </div>
  );
};

export default MyIssues;
