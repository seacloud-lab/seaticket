import { useMemo, useCallback, useState } from 'react';
import SeaMetadata, { CellType, CollaboratorsProvider } from '@/sea-metadata';
import { connectionsAPI } from '@/project/api';
import { useConnectionsPage } from '../../hooks';
import { gettext } from '@/constants';
import { GITHUB_STATUS_OPTIONS, CONNECTION_TYPE } from '../../constants';
import { GithubIssue, DiscourseForum } from '../../models';
import context from '@/sea-metadata/context';
import { Modal, ModalHeader, ModalBody } from 'reactstrap';

const RowDetails = ({ rowDetails, onClose }) => {
  return (
    <Modal isOpen={true} toggle={onClose} style={{ minWidth: 800 }}>
      <ModalHeader toggle={onClose}>{gettext('Replies')}</ModalHeader>
      <ModalBody>
        <div className="sea-qa-row-details" style={{ maxHeight: '60vh', overflow: 'auto', padding: '1rem 2rem' }}>
          {rowDetails.map(detail => (
            <div key={detail.id} className="reply-item" style={{ marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
              <div className="author" style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>{detail.author}</div>
              <div className="content" dangerouslySetInnerHTML={{ __html: detail.content }}></div>
            </div>
          ))}
        </div>
      </ModalBody>
    </Modal>
  );
};

const getColumns = (connType) => {
  if (connType === CONNECTION_TYPE.DISCOURSE_FORUM) {
    return [
      {
        type: CellType.TEXT, key: 'title', name: gettext('Title'),
        editable: false, is_name_column: true, frozen: true,
      },
      { type: CellType.TEXT, key: 'slug', name: gettext('Slug'), editable: false, is_required: true },
      { type: CellType.NUMBER, key: 'views', name: gettext('Views count'), editable: false },
      { type: CellType.DATE, key: 'bumped_at', name: gettext('Last activity'), data: { format: 'YYYY-MM-DD' }, editable: false },
    ];
  }
  // GITHUB_ISSUE
  return [
    {
      type: CellType.TEXT, key: 'title', name: gettext('Title'),
      editable: false, is_name_column: true, frozen: true,
      click: (row) => {
        if (row && row.url) {
          window.open(row.url);
        }
      }
    },
    { type: CellType.TEXT, key: 'author', name: gettext('Author'), editable: false, is_required: true },
    { type: CellType.SINGLE_SELECT, key: 'status', name: gettext('Status'), data: { options: GITHUB_STATUS_OPTIONS }, editable: false },
    { type: CellType.TEXT, key: 'labels', name: gettext('Labels'), editable: false },
    { type: CellType.DATE, key: 'closed_at', name: gettext('Closed at'), data: { format: 'YYYY-MM-DD' }, editable: false },
    { type: CellType.CTIME, key: 'created_at', name: gettext('Create time'), editable: false },
  ];
};

const Connection = ({ projectUuid, connectionID }) => {
  const { isLoading, updatePageName } = useConnectionsPage();
  const [rowDetails, setRowDetails] = useState(null);

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
        const { name, type, records } = res.data;
        let rows = [];
        if (type === CONNECTION_TYPE.GITHUB_ISSUE) {
          rows = Array.isArray(records) ? records.map(r => new GithubIssue(r)) : [];
        } else if (type === CONNECTION_TYPE.DISCOURSE_FORUM) {
          rows = Array.isArray(records) ? records.map(r => new DiscourseForum(r)) : [];
        }
        updatePageName && updatePageName(name);
        return {
          data: {
            rows,
            columns: getColumns(type),
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

  }), [projectUuid, connectionID, viewsData, updatePageName]);

  const createContextMenuOptions = useCallback(() => {
    return [];
  }, []);

  const localStorageName = useMemo(() => `sea-qa-${projectUuid}-connection-${connectionID}`, [projectUuid, connectionID]);

  const t = useMemo(() => {
    return {
      row: gettext('github issue'),
      rows: gettext('github issues'),
      Row: gettext('Github issue'),
      Rows: gettext('Github issues'),
    };
  }, []);

  const handleExpandRow = useCallback((row) => {
    if (row && row.url) {
      window.open(row.url);
    } else {
      const params = { topic_id: row.topic_id };
      connectionsAPI.getConnectionRowDetail(projectUuid, connectionID, params).then((res) => {
        setRowDetails(res.data.row_details);
      });
    }
  }, [projectUuid, connectionID]);

  const onRowDetailsClose = useCallback(() => {
    setRowDetails(null);
  }, []);

  if (isLoading) return null;

  return (
    <CollaboratorsProvider>
      <SeaMetadata
        viewID="0000"
        api={api}
        className="sea-qa-connection-details"
        localStorageNamePrefix={localStorageName}
        createContextMenuOptions={createContextMenuOptions}
        isViewComputedOnServer={false}
        viewTools={['views', 'search', 'sorts', 'groupbys', 'order_and_hidden']}
        expandRow={handleExpandRow}

        t={t}
      />
      {rowDetails && <RowDetails rowDetails={rowDetails} onClose={onRowDetailsClose} />}
    </CollaboratorsProvider>
  );

};

export default Connection;
