import { useMemo, useCallback, useState } from 'react';
import { Modal, ModalHeader, ModalBody } from 'reactstrap';
import SeaMetadata, { CellType, CollaboratorsProvider } from '@/sea-metadata';
import { connectionsAPI } from '@/project/api';
import { useConnectionsPage } from '../../hooks';
import { gettext } from '@/constants';
import { GITHUB_STATUS_OPTIONS, CONNECTION_TYPE } from '../../constants';
import { GithubIssue, DiscourseForum, WebCrawl } from '../../models';
import context from '@/sea-metadata/context';

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

const SiteContentDialog = ({ title, content, onClose }) => {
  return (
    <Modal isOpen={true} toggle={onClose} style={{ minWidth: 900 }}>
      <ModalHeader toggle={onClose}>{title || gettext('Content')}</ModalHeader>
      <ModalBody>
        <div style={{ maxHeight: '70vh', overflow: 'auto', padding: '0.5rem 1rem' }}>
          {!content && <div>{gettext('Loading...')}</div>}
          {!!content && (
            <div className="site-page-content" dangerouslySetInnerHTML={{ __html: content }}></div>
          )}
        </div>
      </ModalBody>
    </Modal>
  );
};

const getColumns = (connType, { onClickSiteTitle } = {}) => {
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
  if (connType === CONNECTION_TYPE.SITE) {
    return [
      {
        type: CellType.TEXT, key: 'title', name: gettext('Title'),
        editable: false, is_name_column: true, frozen: true, expand_able: true,
        click: (row) => {
          if (onClickSiteTitle) {
            onClickSiteTitle(row);
            return;
          }
          if (row && row.url) window.open(row.url);
        }
      },
      { type: CellType.URL, key: 'url', name: gettext('URL'), editable: false },
      { type: CellType.MTIME, key: 'last_modified', name: gettext('Last modify time'), editable: false },
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

const getT = (connectionType) => {
  if (connectionType === CONNECTION_TYPE.SITE) {
    return {
      row: gettext('site'),
      rows: gettext('sites'),
      Row: gettext('Site'),
      Rows: gettext('Sites'),
    };
  }
  if (connectionType === CONNECTION_TYPE.GITHUB_ISSUE) {
    return {
      row: gettext('github issue'),
      rows: gettext('github issues'),
      Row: gettext('Github issue'),
      Rows: gettext('Github issues'),
    };
  }
  if (connectionType === CONNECTION_TYPE.DISCOURSE_FORUM) {
    return {
      row: gettext('discourse forum'),
      rows: gettext('discourse forums'),
      Row: gettext('Discourse forum'),
      Rows: gettext('Discourse forums'),
    };
  }
  return {};
};

const Connection = ({ projectUuid, permission, connectionID }) => {
  const { viewID, isLoading, updatePageName, updateViewID } = useConnectionsPage();
  const [rowDetails, setRowDetails] = useState(null);
  const [siteDetails, setSiteDetails] = useState(null);

  const viewsData = useMemo(() => ({
    navigation: [{ _id: '0000', type: 'view' }],
    views: [
      {
        _id: '0000',
        name: gettext('All'),
      }
    ]
  }), []);

  const handleClickSiteTitle = useCallback((row) => {
    if (!row || !row.url) return;
    // open dialog first with loading state
    setSiteDetails({ title: row.title, content: '' });
    const params = { url: row.url };
    connectionsAPI.getConnectionRowDetail(projectUuid, connectionID, params).then((res) => {
      setSiteDetails({ title: row.title, content: res.data.content || '' });
    }).catch(() => {
      setSiteDetails({ title: row.title, content: gettext('Failed to load content.') });
    });
  }, [projectUuid, connectionID]);

  const api = useMemo(() => ({
    getMetadata: (...params) => {
      return connectionsAPI.getConnectionDetails(projectUuid, connectionID, ...params).then(res => {
        const { name, type, records } = res.data;
        let rows = [];
        context.re_set({ t: getT(type) });
        if (type === CONNECTION_TYPE.GITHUB_ISSUE) {
          rows = Array.isArray(records) ? records.map(r => new GithubIssue(r)) : [];
        } else if (type === CONNECTION_TYPE.DISCOURSE_FORUM) {
          rows = Array.isArray(records) ? records.map(r => new DiscourseForum(r)) : [];
        } else if (type === CONNECTION_TYPE.SITE) {
          rows = Array.isArray(records) ? records.map(r => new WebCrawl(r)) : [];
        }
        updatePageName && updatePageName(name);
        return {
          data: {
            rows,
            columns: getColumns(type, { onClickSiteTitle: handleClickSiteTitle }),
          }
        };
      });
    },
    getViews: () => connectionsAPI.listViews(projectUuid),
    getView: (viewID) => connectionsAPI.getView(projectUuid, viewID),
    insertView: (name, viewData) => connectionsAPI.insertView(projectUuid, name, viewData),
    deleteView: (viewID) => connectionsAPI.deleteView(projectUuid, viewID),
    moveView: (sourceViewID, targetViewID) => connectionsAPI.moveView(projectUuid, sourceViewID, targetViewID),
    duplicateView: (viewID) => connectionsAPI.duplicateView(projectUuid, viewID),
    modifyView: (viewID, viewData) => connectionsAPI.modifyView(projectUuid, viewID, viewData),

  }), [projectUuid, connectionID, viewsData, updatePageName, handleClickSiteTitle]);

  const createContextMenuOptions = useCallback(() => {
    return [];
  }, []);

  const localStorageName = useMemo(() => `sea-qa-${projectUuid}-connection-${connectionID}`, [projectUuid, connectionID]);

  const handleExpandRow = useCallback((row) => {
    if (row && row.url) {
      window.open(row.url);
      return;
    }
    const params = { topic_id: row.topic_id };
    connectionsAPI.getConnectionRowDetail(projectUuid, connectionID, params).then((res) => {
      setRowDetails(res.data.row_details);
    });
  }, [projectUuid, connectionID]);

  const onRowDetailsClose = useCallback(() => {
    setRowDetails(null);
  }, []);

  if (isLoading) return null;

  return (
    <CollaboratorsProvider>
      <SeaMetadata
        viewID={viewID}
        api={api}
        className="sea-qa-connection-details"
        localStorageNamePrefix={localStorageName}
        createContextMenuOptions={createContextMenuOptions}
        isViewComputedOnServer={false}
        permission={permission}
        viewTools={['views', 'search', 'sorts', 'groupbys', 'order_and_hidden']}
        toggleView={updateViewID}
        expandRow={handleExpandRow}
      />
      {rowDetails && <RowDetails rowDetails={rowDetails} onClose={onRowDetailsClose} />}
      {siteDetails && (
        <SiteContentDialog
          title={siteDetails.title}
          content={siteDetails.content}
          onClose={() => setSiteDetails(null)}
        />
      )}
    </CollaboratorsProvider>
  );

};

export default Connection;
