import { useMemo, useCallback } from 'react';
import SeaMetadata, { CellType, CollaboratorsProvider } from '@/sea-metadata';
import { connectionsAPI } from '@/project/api';
import { useConnectionsPage } from '../../hooks';
import { gettext } from '@/constants';
import { GITHUB_STATUS_OPTIONS } from '@/project/constants';
import { GithubIssue } from '../../models';
import context from '@/sea-metadata/context';

const Connection = ({ projectUuid, connectionID }) => {
  const { isLoading } = useConnectionsPage();

  const columns = useMemo(() => [
    { type: CellType.TEXT, key: 'title', name: gettext('Title'), editable: false, is_name_column: true, frozen: true, expand_able: true },
    // { type: CellType.LONG_TEXT, key: 'body', name: gettext('Body'), editable: false, is_required: true },
    { type: CellType.TEXT, key: 'author', name: gettext('Author'), editable: false, is_required: true },
    { type: CellType.SINGLE_SELECT, key: 'status', name: gettext('Status'), data: { options: GITHUB_STATUS_OPTIONS }, editable: false },
    { type: CellType.TEXT, key: 'labels', name: gettext('Labels'), editable: false },
    // { type: CellType.URL, key: 'url', name: gettext('URL'), editable: false },
    { type: CellType.DATE, key: 'closed_at', name: gettext('Closed at'), data: { format: 'YYYY-MM-DD' }, editable: false },
    { type: CellType.CTIME, key: 'created_at', name: gettext('Create time'), editable: false },
    // { type: CellType.MTIME, key: 'updated_at', name: gettext('Last modify time'), editable: false },
  ], []);

  const viewsData = useMemo(() => ({
    navigation: [{ _id: '0000', type: 'view' }],
    views: [
      {
        _id: '0000',
        name: gettext('All'),
      }
    ]
  }), []);

  const api = useMemo(() => ({
    getMetadata: (...params) => {
      return connectionsAPI.getConnectionDetails(projectUuid, connectionID, ...params).then(res => {
        const rows = Array.isArray(res.data.records) ? res.data.records.map(r => new GithubIssue(r)) : [];
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
          columns_keys: context.localStorage.getItem('columns_keys') || [],
          filter_conjunction: context.localStorage.getItem('filter_conjunction') || 'Or',
          filters: context.localStorage.getItem('filters') || [],
          sorts: context.localStorage.getItem('sorts') || [],
          groupbys: context.localStorage.getItem('groupbys') || [],
          hidden_columns: context.localStorage.getItem('hidden_columns') || [],
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

  }), [projectUuid, columns, connectionID, viewsData]);

  const createContextMenuOptions = useCallback(() => {
    return [];
  }, []);

  const localStorageName = useMemo(() => `sea-qa-${projectUuid}-connection-${connectionID}`, [projectUuid, connectionID]);

  const t = useMemo(() => {
    return {
      row: gettext('github issues'),
      rows: gettext('github issues'),
      Rows: gettext('Github issues'),
    };
  }, []);

  const handleExpandRow = useCallback((row) => {
    if (row && row.url) {
      window.open(row.url);
    }
  }, []);

  if (isLoading) return null;

  return (
    <CollaboratorsProvider>
      <SeaMetadata
        viewID="0000"
        api={api}
        isShowViews={false}
        className="sea-qa-connection-details"
        localStorageNamePrefix={localStorageName}
        createContextMenuOptions={createContextMenuOptions}
        toggleView={() => {}}
        expandRow={handleExpandRow}

        t={t}
      />
    </CollaboratorsProvider>
  );

};

export default Connection;
