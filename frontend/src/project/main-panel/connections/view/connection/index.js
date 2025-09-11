import { useMemo, useCallback, useState, useEffect } from 'react';
import { Modal, ModalHeader, ModalBody } from 'reactstrap';
import SeaMetadata, { CellType, CollaboratorsProvider } from '@/sea-metadata';
import DiscourseForumsDetails from '../../components/discourse-forums-details';
import { connectionsAPI } from '@/project/api';
import { useConnectionsPage } from '../../hooks';
import { gettext } from '@/constants';
import { GITHUB_STATUS_OPTIONS, CONNECTION_TYPE } from '../../constants';
import { GithubIssue, DiscourseForum, WebCrawl } from '../../models';
import context from '@/sea-metadata/context';
import { useConnections } from '../../hooks';
import { toaster } from '@/components';
import { processor } from '@seafile/seafile-editor';

const SiteContentDialog = ({ title, content, onClose }) => {

  const [innerHtml, setInnerHtml] = useState('');

  useEffect(() => {
    // replace error markdown format -\n to \n\n
    const newContent = content.replace(/-\n/ig, '\n\n');
    processor.process(newContent).then((result) => {
      let innerHtml = String(result).replace(/<a /ig, '<a target="_blank" tabindex="-1"').replace(/<table>/ig, '<table class="table table-bordered w-100">');
      setInnerHtml(innerHtml);
    });
  }, [content]);
  return (
    <Modal isOpen={true} toggle={onClose} style={{ minWidth: 900 }}>
      <ModalHeader toggle={onClose}>{title || gettext('Description')}</ModalHeader>
      <ModalBody>
        <div style={{ maxHeight: '70vh', overflow: 'auto', padding: '0.5rem 1rem' }}>
          <div className="site-page-content" dangerouslySetInnerHTML={{ __html: innerHtml }}></div>
        </div>
      </ModalBody>
    </Modal>
  );
};

const Connection = ({ projectUuid, permission, connectionID }) => {
  const { viewID, isLoading, updatePageName, updateViewID } = useConnectionsPage();
  const { connections } = useConnections();
  const [rowDetails, setRowDetails] = useState(null);
  const [rowDetailsTitle, setRowDetailsTitle] = useState('');
  const [siteDetails, setSiteDetails] = useState(null);
  const [connection, setConnection] = useState({});
  const [isLoadingConnection, setLoadingConnection] = useState(true);

  const handleClickSiteTitle = useCallback((row) => {
    if (!row || !row.url) return;
    // open dialog first with loading state
    setSiteDetails({ title: row.title, content: '' });
    const params = { url: row.url };
    connectionsAPI.getConnectionRowDetail(projectUuid, connectionID, params).then((res) => {
      const raw = res.data.row_details || '';
      setSiteDetails({ title: row.title, content: raw.content });
    }).catch(() => {
      setSiteDetails({ title: row.title, content: gettext('Failed to load content.') });
    });
  }, [projectUuid, connectionID]);

  const t = useMemo(() => {
    const connectionType = connection?.type;
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
  }, [connection]);

  const columns = useMemo(() => {
    const connectionType = connection?.type;
    if (connectionType === CONNECTION_TYPE.DISCOURSE_FORUM) {
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
    if (connectionType === CONNECTION_TYPE.SITE) {
      return [
        {
          type: CellType.TEXT, key: 'title', name: gettext('Title'),
          editable: false, is_name_column: true, frozen: true, expand_able: true,
          click: (row) => {
            handleClickSiteTitle(row);
          }
        },
        { type: CellType.URL, key: 'url', name: gettext('URL'), editable: false },
        { type: CellType.MTIME, key: 'last_modified', name: gettext('Last modify time'), editable: false, sort_able: false, filter_able: false },
      ];
    }
    if (connectionType === CONNECTION_TYPE.GITHUB_ISSUE) {
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
    }
    return [];
  }, [connection, handleClickSiteTitle]);

  const viewsData = useMemo(() => ({
    navigation: [{ _id: '0000', type: 'view' }],
    views: [
      {
        _id: '0000',
        name: gettext('All'),
      }
    ]
  }), []);

  const api = useMemo(() => {
    const getMetadata = (...params) => {
      return connectionsAPI.getConnectionDetails(projectUuid, connectionID, ...params).then(res => {
        const { type, records } = res.data;
        let rows = [];
        if (type === CONNECTION_TYPE.GITHUB_ISSUE) {
          rows = Array.isArray(records) ? records.map(r => new GithubIssue(r)) : [];
        } else if (type === CONNECTION_TYPE.DISCOURSE_FORUM) {
          rows = Array.isArray(records) ? records.map(r => new DiscourseForum(r)) : [];
        } else if (type === CONNECTION_TYPE.SITE) {
          rows = Array.isArray(records) ? records.map(r => new WebCrawl(r)) : [];
        }
        return {
          data: {
            rows,
            columns,
          }
        };
      });
    };

    if (connection?.type === CONNECTION_TYPE.GITHUB_ISSUE || connection?.type === CONNECTION_TYPE.SITE) {
      return {
        getMetadata,
        getViews: () => connectionsAPI.listViews(projectUuid, connectionID),
        getView: (viewID) => connectionsAPI.getView(projectUuid, viewID, connectionID),
        insertView: (name, viewData) => connectionsAPI.insertView(projectUuid, connectionID, name, viewData),
        deleteView: (viewID) => connectionsAPI.deleteView(projectUuid, connectionID, viewID),
        moveView: (sourceViewID, targetViewID) => connectionsAPI.moveView(projectUuid, connectionID, sourceViewID, targetViewID),
        duplicateView: (viewID) => connectionsAPI.duplicateView(projectUuid, connectionID, viewID),
        modifyView: (viewID, viewData) => connectionsAPI.modifyView(projectUuid, connectionID, viewID, viewData),
      };
    }

    return {
      getMetadata,
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
    };
  }, [projectUuid, connectionID, connection, columns]);

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
      setRowDetailsTitle(row.title);
      setRowDetails(res.data.row_details);
    });
  }, [projectUuid, connectionID]);

  const onRowDetailsClose = useCallback(() => {
    setRowDetails(null);
  }, []);

  useEffect(() => {
    const connection = connections.find(c => c.id === connectionID);
    if (connection) {
      setConnection(connection);
      updatePageName && updatePageName(connection.name);
      setLoadingConnection(false);
      return;
    }
    connectionsAPI.getConnection(projectUuid, connectionID).then(res => {
      const connection = res.data.record;
      updatePageName && updatePageName(connection.name);
      setConnection(connection);
      setLoadingConnection(false);
    }).catch(error => {
      toaster.danger(gettext('Connection not found'));
    });
  }, []);

  useEffect(() => {
    if (isLoadingConnection) return;
    const isMultiView = [CONNECTION_TYPE.GITHUB_ISSUE, CONNECTION_TYPE.SITE].includes(connection.type);
    if (!isMultiView) {
      updateViewID('');
    }
  }, [isLoadingConnection, connection, viewID, updateViewID]);

  if (isLoading || isLoadingConnection) return null;

  const isGithubIssuesView = connection?.type === CONNECTION_TYPE.GITHUB_ISSUE;
  const isMultiView = [CONNECTION_TYPE.GITHUB_ISSUE, CONNECTION_TYPE.SITE].includes(connection?.type);

  return (
    <CollaboratorsProvider>
      <SeaMetadata
        viewID={isMultiView ? viewID : '0000'}
        api={api}
        className="sea-qa-connection-details"
        localStorageNamePrefix={localStorageName}
        createContextMenuOptions={createContextMenuOptions}
        permission={permission}
        isViewComputedOnServer={isGithubIssuesView}
        toggleView={isMultiView ? updateViewID : undefined}
        expandRow={handleExpandRow}
        t={t}
      />
      {rowDetails && <DiscourseForumsDetails rowDetailsTitle={rowDetailsTitle} rowDetails={rowDetails} onClose={onRowDetailsClose} />}
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
