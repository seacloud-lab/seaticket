import { useMemo, useCallback, useState, useEffect } from 'react';
import { Modal, ModalBody, ModalFooter, Button, Form, FormGroup, Label, Input } from 'reactstrap';
import copy from 'copy-to-clipboard';
import { processor, getPreviewContent } from '@seafile/seafile-editor';
import SeaMetadata, { CellType, CollaboratorsProvider } from '@/sea-metadata';
import DiscourseForumsDetails from '../../components/discourse-forums-details';
import GithubIssueDetails from '../../components/github-issue-details';
import { connectionsAPI, ticketsAPI } from '@/project/api';
import { useConnectionsPage } from '../../hooks';
import { gettext } from '@/constants';
import { GITHUB_STATE_OPTIONS, CONNECTION_TYPE, GITHUB_STATE_REASON_NAME_MAP } from '../../constants';
import { GithubIssue, DiscourseForum, WebCrawl, Seafile } from '../../models';
import context from '@/sea-metadata/context';
import { useConnections } from '../../hooks';
import { toaster, ModalHeader, Loading } from '@/components';
import { isDarkColor } from '@/utils/utils';

const SERVER_COMPUTABLE_CONNECTION_TYPE = [
  CONNECTION_TYPE.GITHUB_ISSUE,
  CONNECTION_TYPE.SITE,
  CONNECTION_TYPE.DISCOURSE_FORUM,
  CONNECTION_TYPE.SEAFILE
];

const MULTIPLE_VIEWS_CONNECTION_TYPE = [
  CONNECTION_TYPE.GITHUB_ISSUE,
  CONNECTION_TYPE.SITE,
  CONNECTION_TYPE.DISCOURSE_FORUM,
  CONNECTION_TYPE.SEAFILE,
];

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
      <ModalBody style={{ padding: 0 }}>
        <div style={{ maxHeight: '70vh', overflow: 'auto', padding: '16px' }}>
          <div className="site-page-content" dangerouslySetInnerHTML={{ __html: innerHtml }}></div>
        </div>
      </ModalBody>
    </Modal>
  );
};

const CreateTicketDialog = ({ initialData, isOpen, toggle, isLoading, projectUuid }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
    } else {
      setTitle('');
      setDescription('');
    }
  }, [initialData]);

  const handleSubmit = () => {
    const { previewText, images, links, checklist } = getPreviewContent(description);
    const content = {
      text: description,
      preview: previewText,
      images,
      links,
      checklist,
    };
    const ticketData = {
      title: title,
      description: content,
      type: '',
      assignees: [],
      tags: [],
    };
    ticketsAPI.createProjectTicket(projectUuid, ticketData).then(() => {
      toaster.success(gettext('Successfully created ticket.'));
      setTimeout(toggle, 500);
    });
  };

  return (
    <Modal isOpen={isOpen} toggle={toggle} style={{ minWidth: 800 }}>
      <ModalHeader toggle={toggle}>{gettext('Create related ticket')}</ModalHeader>
      <ModalBody>
        <div className="d-flex">
          <div style={{ flex: 2, paddingRight: '1rem' }}>
            {isLoading && <Loading/>}
            <Form>
              <FormGroup>
                <Label for="ticketTitle">{gettext('Title')}</Label>
                <Input
                  type="text"
                  name="title"
                  id="ticketTitle"
                  value={title}
                  readOnly={isLoading}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ marginBottom: '1rem' }}
                />
              </FormGroup>
              <FormGroup>
                <Label for="ticketDescription">{gettext('Description')}</Label>
                <Input
                  type="textarea"
                  name="description"
                  id="ticketDescription"
                  value={description}
                  readOnly={isLoading}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ height: '250px' }}
                />
              </FormGroup>
            </Form>
          </div>
          <div style={{ flex: 1, padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
            <p>{gettext('Describe your instructions of how to create related tickets')}</p>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button color="primary" onClick={handleSubmit} disabled={isLoading || !title.trim()}>{gettext('Submit')}</Button>
        <Button color="secondary" onClick={toggle}>{gettext('Cancel')}</Button>
      </ModalFooter>
    </Modal>
  );
};

const Connection = ({ projectUuid, permission, connectionID }) => {
  const { viewID, isLoading, updatePageName, updateViewID } = useConnectionsPage();
  const { connections } = useConnections();
  const [discourseForumsDetails, setDiscourseForumsDetails] = useState(null);
  const [discourseForumsDetailsTitle, setDiscourseForumsDetailsTitle] = useState('');
  const [githubIssueDetails, setGithubIssueDetails] = useState(null);
  const [githubIssueDetailsTitle, setGithubIssueDetailsTitle] = useState('');
  const [siteDetails, setSiteDetails] = useState(null);
  const [connection, setConnection] = useState({});
  const [isLoadingConnection, setLoadingConnection] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [typesData, setTypesData] = useState(null);
  const [isTicketDialogOpen, setTicketDialogOpen] = useState(false);
  const [ticketData, setTicketData] = useState(null);
  const [isTicketLoading, setTicketLoading] = useState(false);

  const parseChecklistFromBody = (bodyText) => {
    if (!bodyText) return { total: 0, completed: 0 };
    const regex = /^\s*[-*]\s*\[( |x|X)\]/gm;
    const matches = bodyText.match(regex) || [];
    const total = matches.length;
    const completed = matches.filter(item => /\[x\]/i.test(item)).length;
    return { total, completed };
  };

  const createTicketFromRow = useCallback(async (rowData) => {
    setIsSubmitting(true);

    const bodyText = rowData.body || 'body is empty';
    const checklist = parseChecklistFromBody(bodyText);
    const descriptionData = {
      text: bodyText,
      preview: bodyText.substring(0, 100) + '...',
      images: [],
      links: [],
      checklist
    };

    const ticketData = {
      title: `${rowData.title || ''}`,
      description: descriptionData,
      author: `${rowData.author || ''}`,
      status: `${rowData.status_reason || ''}`
    };

    ticketsAPI.createProjectTicket(projectUuid, ticketData).then(res => {
      setIsSubmitting(false);
    }).catch(error => {
      setIsSubmitting(false);
    });
  }, [projectUuid]);


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

  const initColumns = useMemo(() => {
    const connectionType = connection?.type;
    if (connectionType === CONNECTION_TYPE.DISCOURSE_FORUM) {
      return [
        {
          type: CellType.TEXT, key: 'title', name: gettext('Title'),
          editable: false, is_name_column: true, frozen: true,
        },
        { type: CellType.NUMBER, key: 'topic_id', name: gettext('Topic ID'), editable: false },
        { type: CellType.NUMBER, key: 'views', name: gettext('Views count'), editable: false },
        { type: CellType.DATE, key: 'bumped_at', name: gettext('Last activity'), data: { format: 'YYYY-MM-DD HH:mm:ss' }, editable: false },
        { type: CellType.DATE, key: 'created_at', name: gettext('Created at'), data: { format: 'YYYY-MM-DD HH:mm:ss' }, editable: false }
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
        { type: CellType.MTIME, key: 'last_modified', name: gettext('Last modify time'), editable: false, sort_able: true, filter_able: true },
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
        { type: CellType.SINGLE_SELECT, key: 'status', name: gettext('State'), data: { options: GITHUB_STATE_OPTIONS }, editable: false },
        { type: CellType.SINGLE_SELECT, key: 'state_reason', name: gettext('State reason'), data: { options: [] }, editable: false },
        { type: CellType.SINGLE_SELECT, key: 'type', name: gettext('Type'), data: { options: [] }, editable: false },
        { type: CellType.MULTIPLE_SELECT, key: 'labels', name: gettext('Labels'), data: { options: [] }, editable: false },
        { type: CellType.DATE, key: 'closed_at', name: gettext('Closed at'), data: { format: 'YYYY-MM-DD' }, editable: false },
        { type: CellType.CTIME, key: 'created_at', name: gettext('Create time'), editable: false },
      ];
    }

    if (connectionType === CONNECTION_TYPE.SEAFILE) {
      return [
        {
          type: CellType.TEXT, key: 'filename', name: gettext('File name'),
          editable: false, is_name_column: true, frozen: true
        },
        { type: CellType.TEXT, key: 'path', name: gettext('Parent folder'), editable: false, is_required: true },
        { type: CellType.DATE, key: 'mtime', name: gettext('Last modified time'), data: { format: 'YYYY-MM-DD HH:mm:ss' }, editable: false },
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
        let columns = initColumns;
        if (type === CONNECTION_TYPE.GITHUB_ISSUE) {
          rows = Array.isArray(records) ? records.map(r => new GithubIssue(r)) : [];
          const dbColumns = res?.data?.columns || [];
          const dbLabelsColum = dbColumns.find(c => c.name === 'labels');
          const labelsColumIndex = columns.findIndex(c => c.key === 'labels');
          if (dbLabelsColum && labelsColumIndex > -1) {
            let options = dbLabelsColum?.data?.options || [];
            options = options.map(o => {
              if (o.textColor) return o;
              return {
                ...o,
                textColor: isDarkColor(o.color) ? '#FFF' : '#212529',
              };
            });
            columns[labelsColumIndex].data = { ...dbLabelsColum.data, options };
          }
          const dbTypeColumn = dbColumns.find(c => c.name === 'issue_type');
          const typeColumIndex = columns.findIndex(c => c.key === 'type');
          if (dbTypeColumn && typeColumIndex > -1) {
            const options = dbTypeColumn?.data?.options || [];
            columns[typeColumIndex].data = { ...dbTypeColumn.data, options };
            const _typesData = options.map(o => ({ ...o, _id: o.name }));
            setTypesData({
              rows: _typesData,
              id_row_map: _typesData.reduce((pre, cur) => {
                pre[cur._id] = cur;
                return pre;
              }, {})
            });
          }
          const dbStateReasonColumn = dbColumns.find(c => c.name === 'state_reason');
          const stateReasonColumnIndex = columns.findIndex(c => c.key === 'state_reason');
          if (dbStateReasonColumn && stateReasonColumnIndex > -1) {
            let options = dbStateReasonColumn?.data?.options || [];
            options = options.map(o => {
              return {
                ...o,
                id: o.name,
                name: GITHUB_STATE_REASON_NAME_MAP[o.name],
              };
            });
            columns[stateReasonColumnIndex].data = { ...dbStateReasonColumn.data, options };
          }
        } else if (type === CONNECTION_TYPE.DISCOURSE_FORUM) {
          rows = Array.isArray(records) ? records.map(r => new DiscourseForum(r)) : [];
        } else if (type === CONNECTION_TYPE.SITE) {
          rows = Array.isArray(records) ? records.map(r => new WebCrawl(r)) : [];
        } else if (type === CONNECTION_TYPE.SEAFILE) {
          rows = Array.isArray(records) ? records.map(r => new Seafile(r)) : [];
        }
        return {
          data: {
            rows,
            columns: columns,
          }
        };
      });
    };

    if (SERVER_COMPUTABLE_CONNECTION_TYPE.includes(connection?.type)) {
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
  }, [projectUuid, connectionID, connection, initColumns]);

  const createRowsTools = useCallback(({ rows, modifyRows }) => {
    if (rows.length > 1) return [];
    const row = rows[0];
    if (connection?.type === CONNECTION_TYPE.DISCOURSE_FORUM) {
      const discourseBaseUrl = connection.config?.url;
      if (!discourseBaseUrl) return [];
      return [{
        key: 'copy',
        icon: 'copy',
        name: gettext('Copy original page link'),
        callback: () => {
          const baseUrl = discourseBaseUrl.replace(/\/$/, '');
          const url = `${baseUrl}/t/${row.slug}/${row.topic_id}`;
          copy(url);
          toaster.success(gettext('The original page link has been copied'));
        }
      }];
    }
    if (connection?.type === CONNECTION_TYPE.SITE) {
      if (!row?.url) return [];
      return [
        {
          key: 'copy',
          icon: 'copy',
          name: gettext('Copy original page link'),
          callback: (event) => {
            event && event.stopPropagation();
            event?.nativeEvent && event.nativeEvent.stopImmediatePropagation();
            const url = row.url;
            copy(url);
            toaster.success(gettext('The original page link has been copied'));
          },
        }
      ];
    }

    return [];
  }, [connection]);

  const createContextMenuOptions = useCallback(({
    isGroupView,
    selectedRange,
    selectedPosition,
    table,
    rowMetrics,
    rowGetterByIndex,
  }) => {
    // handle selected multiple cells
    if (selectedRange) {
      return [];
    }

    // handle selected rows
    const selectedRowIds = rowMetrics ? Object.keys(rowMetrics.idSelectedRowMap) : [];
    if (selectedRowIds.length > 1) {
      return [];
    }

    // handle selected cell
    if (!selectedPosition) return [];
    const { groupRowIndex, rowIdx: rowIndex } = selectedPosition;
    const row = rowGetterByIndex({ isGroupView, groupRowIndex, rowIndex }) || table.id_row_map[selectedRowIds[0]];
    if (!row) return [];

    if (connection?.type === CONNECTION_TYPE.DISCOURSE_FORUM) {
      return [{
        label: gettext('Open original page'),
        callback: () => {
          const discourseBaseUrl = connection.config?.url;
          if (!discourseBaseUrl || !row.slug || !row.topic_id) {
            toaster.danger(gettext('Missing required information to open original page'));
            return;
          }
          const baseUrl = discourseBaseUrl.replace(/\/$/, '');
          const originalPageUrl = `${baseUrl}/t/${row.slug}/${row.topic_id}`;
          window.open(originalPageUrl, '_blank', 'noopener,noreferrer');
        }
      }, {
        label: gettext('Create related ticket'),
        callback: () => {
          setTicketData(null);
          setTicketDialogOpen(true);
          setTicketLoading(true);
          connectionsAPI.createTicketInfo(projectUuid, connectionID, row.topic_id).then(res => {
            setTicketData(res.data);
          }).finally(() => {
            setTicketLoading(false);
          });
        }
      }];
    }

    if (connection?.type === CONNECTION_TYPE.GITHUB_ISSUE){
      return [{
        label: isSubmitting ? gettext('Create new ticket') : gettext('Create new ticket'),
        callback: () => createTicketFromRow(row),
        disabled: isSubmitting
      }];
    }

    if (connection?.type === CONNECTION_TYPE.SITE) {
      return [{
        label: gettext('Open original page'),
        callback: () => {
          window.open(row.url, '_blank', 'noopener,noreferrer');
        }
      }];
    }
    return [];
  }, [connection, isSubmitting, createTicketFromRow]);

  const localStorageName = useMemo(() => `sea-qa-${projectUuid}-connection-${connectionID}`, [projectUuid, connectionID]);

  const handleExpandRow = useCallback((row) => {
    if (row && row.url && connection.type !== CONNECTION_TYPE.GITHUB_ISSUE) {
      window.open(row.url);
      return;
    }

    if (connection.type === CONNECTION_TYPE.DISCOURSE_FORUM) {
      connectionsAPI.getConnectionRowDetail(projectUuid, connectionID, { topic_id: row.topic_id }).then((res) => {
        setDiscourseForumsDetailsTitle(row.title);
        setDiscourseForumsDetails(res.data.row_details);
      });
    }
    if (connection.type === CONNECTION_TYPE.GITHUB_ISSUE) {
      connectionsAPI.getConnectionRowDetail(projectUuid, connectionID, { issue_id: row.issue_id }).then((res) => {
        setGithubIssueDetailsTitle(row.title);
        setGithubIssueDetails(res.data.row_details);
      });
    }
  }, [projectUuid, connectionID, connection]);

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
    const isMultiView = MULTIPLE_VIEWS_CONNECTION_TYPE.includes(connection.type);
    if (!isMultiView) {
      updateViewID('');
    }
  }, [isLoadingConnection, connection, viewID, updateViewID]);

  if (isLoading || isLoadingConnection) return null;

  const isServerComputableView = SERVER_COMPUTABLE_CONNECTION_TYPE.includes(connection?.type);
  const isMultiView = MULTIPLE_VIEWS_CONNECTION_TYPE.includes(connection?.type);

  return (
    <CollaboratorsProvider>
      <SeaMetadata
        viewID={isMultiView ? viewID : '0000'}
        api={api}
        className="sea-qa-connection-details"
        localStorageNamePrefix={localStorageName}
        createRowsTools={createRowsTools}
        createContextMenuOptions={createContextMenuOptions}
        permission={permission}
        isViewComputedOnServer={isServerComputableView}
        typesData={typesData}
        toggleView={isMultiView ? updateViewID : undefined}
        expandRow={handleExpandRow}
        t={t}
      />
      {discourseForumsDetails && <DiscourseForumsDetails rowDetailsTitle={discourseForumsDetailsTitle} rowDetails={discourseForumsDetails} onClose={() => {setDiscourseForumsDetails(null);}} />}
      {githubIssueDetails && <GithubIssueDetails rowDetailsTitle={githubIssueDetailsTitle} rowDetails={githubIssueDetails} onClose={() => {setGithubIssueDetails(null);}} />}
      {siteDetails && (
        <SiteContentDialog
          title={siteDetails.title}
          content={siteDetails.content}
          onClose={() => setSiteDetails(null)}
        />
      )}
      {isTicketDialogOpen && (
        <CreateTicketDialog
          projectUuid={projectUuid}
          initialData={ticketData}
          isLoading={isTicketLoading}
          isOpen={isTicketDialogOpen}
          toggle={() => setTicketDialogOpen(false)}
        />
      )}
    </CollaboratorsProvider>
  );

};

export default Connection;
