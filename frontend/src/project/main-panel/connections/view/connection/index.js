import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { Modal, ModalBody, ModalFooter, Button, Form, FormGroup, Label, Input } from 'reactstrap';
import copy from 'copy-to-clipboard';
import { processor, getPreviewContent } from '@seafile/seafile-editor';
import SeaMetadata, { CollaboratorsProvider } from '@/sea-metadata';
import RowDetailsDialog from '../../components/row-details-dialog';
import { connectionsAPI, ticketsAPI } from '@/project/api';
import { useConnectionsPage } from '../../hooks';
import { gettext } from '@/constants';
import { CONNECTION_TYPE, GITHUB_STATE_REASON_NAME_MAP, GITHUB_STATE_OPTION_NAME_MAP, CONNECTION_PREDEFINED_COLUMN_CONFIG } from '../../constants';
import { GithubIssue, DiscourseForum, WebCrawl, Seafile } from '../../models';
import context from '@/sea-metadata/context';
import { useConnections } from '../../hooks';
import { toaster, ModalHeader, Loading } from '@/components';

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
      toaster.success(gettext('Ticket created'));
      setTimeout(toggle, 500);
    });
  };

  return (
    <Modal isOpen={isOpen} toggle={toggle} style={{ minWidth: 600 }}>
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
        </div>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={toggle}>{gettext('Cancel')}</Button>
        <Button color="primary" onClick={handleSubmit} disabled={isLoading || !title.trim()}>{gettext('Submit')}</Button>
      </ModalFooter>
    </Modal>
  );
};

const Connection = ({ projectUuid, permission, connectionID }) => {
  const seaMetaDataRef = useRef(null);
  const currentRowRef = useRef(null);
  const { viewID, isLoading, updatePageName, updateViewID } = useConnectionsPage();
  const { connections } = useConnections();
  const [rowDetails, setRowDetails] = useState(null);
  const [rowDetailsTitle, setRowDetailsTitle] = useState('');
  const [siteDetails, setSiteDetails] = useState(null);
  const [connection, setConnection] = useState({});
  const [isLoadingConnection, setLoadingConnection] = useState(true);
  const [typesData, setTypesData] = useState(null);
  const [isTicketDialogOpen, setTicketDialogOpen] = useState(false);
  const [ticketData, setTicketData] = useState(null);
  const [isTicketLoading, setTicketLoading] = useState(false);

  const generateAITitleForRow = useCallback((row) => {
    const recordID = row._id || row._pk;

    if (!recordID) {
      toaster.danger(gettext('Cannot get record ID'));
      return;
    }

    toaster.notify(gettext('Generating AI title...'), { duration: 0 });

    connectionsAPI.generateAITitle(projectUuid, connectionID, recordID)
      .then(res => {
        toaster.closeAll();
        if (res.data && res.data.ai_title) {
          toaster.success(gettext('AI title generated successfully'));
          window.location.reload();
        } else {
          toaster.warning(gettext('Failed to generate AI title'));
        }
      })
      .catch(error => {
        toaster.closeAll();
        const errorMessage = error.response?.data?.error_msg || gettext('Failed to generate AI title');
        toaster.danger(errorMessage);
      });
  }, [projectUuid, connectionID]);

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
        let columns = res?.data?.columns || [];
        let notDisplayColumnNames = ['_pk'];
        let columnConfig = CONNECTION_PREDEFINED_COLUMN_CONFIG[type];
        if (type === CONNECTION_TYPE.GITHUB_ISSUE) {
          rows = Array.isArray(records) ? records.map(r => new GithubIssue(r)) : [];
          const typeColum = columns.find(c => c.name === 'issue_type');
          if (typeColum) {
            const options = typeColum.data?.options || [];
            const _typesData = options.map(o => ({ ...o, _id: o.id }));
            setTypesData({
              rows: _typesData,
              id_row_map: _typesData.reduce((pre, cur) => {
                pre[cur._id] = cur;
                return pre;
              }, {})
            });
            context.setSetting('typeColumnKey', typeColum.key);
          }

          const stateColumnIndex = columns.findIndex(c => c.name === 'state');
          if (stateColumnIndex > -1) {
            const stateColumn = columns[stateColumnIndex];
            context.setSetting('statusColumnKey', stateColumn.key);
            let options = stateColumn.data?.options || [];
            options = options.map(o => ({ ...o, display_name: GITHUB_STATE_OPTION_NAME_MAP[o.name] || o.name }));
            columns[stateColumnIndex].data = { ...stateColumn.data, options };
          }

          const stateReasonColumnIndex = columns.findIndex(c => c.name === 'state_reason');
          if (stateReasonColumnIndex > -1) {
            const stateReasonColumn = columns[stateReasonColumnIndex];
            let options = stateReasonColumn.data?.options || [];
            options = options.map(o => ({ ...o, display_name: GITHUB_STATE_REASON_NAME_MAP[o.name] || o.name }));
            columns[stateReasonColumnIndex].data = { ...stateReasonColumn.data, options };
          }
          notDisplayColumnNames.push('url');
        } else if (type === CONNECTION_TYPE.DISCOURSE_FORUM) {
          rows = Array.isArray(records) ? records.map(r => new DiscourseForum(r)) : [];
        } else if (type === CONNECTION_TYPE.SITE) {
          rows = Array.isArray(records) ? records.map(r => new WebCrawl(r)) : [];
          columnConfig['title'] = {
            ...columnConfig['title'],
            click: (row) => {
              handleClickSiteTitle(row);
            }
          };
        } else if (type === CONNECTION_TYPE.SEAFILE) {
          rows = Array.isArray(records) ? records.map(r => new Seafile(r)) : [];
        }
        columns = columns.filter(c => !notDisplayColumnNames.includes(c.name)).map(c => ({ ...c, ...columnConfig[c.name] }));
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
  }, [projectUuid, connectionID, connection]);

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
          connectionsAPI.convertRecordToTicket(projectUuid, connectionID, row._id).then(res => {
            const data = res.data || {};
            const discourseBaseUrl = connection.config?.url;
            let relatedUrl = '';
            if (discourseBaseUrl && row.slug && row.topic_id) {
              const baseUrl = discourseBaseUrl.replace(/\/$/, '');
              relatedUrl = `${baseUrl}/t/${row.slug}/${row.topic_id}`;
            }
            const prefix = data.description || '';
            const suffix = `${gettext('Related record')}: ${relatedUrl}`;
            data.description = prefix ? `${prefix}\n\n${suffix}` : suffix;
            setTicketData(data);
          }).finally(() => {
            setTicketLoading(false);
          });
        }
      }];
    }

    if (connection?.type === CONNECTION_TYPE.GITHUB_ISSUE){
      return [{
        label: gettext('Create related ticket'),
        callback: () => {
          setTicketData(null);
          setTicketDialogOpen(true);
          setTicketLoading(true);
          connectionsAPI.convertRecordToTicket(projectUuid, connectionID, row._id).then(res => {
            const data = res.data || {};
            const relatedUrl = row.url;
            const prefix = data.description || '';
            const suffix = `${gettext('Related record')}: ${relatedUrl}`;
            data.description = prefix ? `${prefix}\n\n${suffix}` : suffix;
            setTicketData(data);
          }).finally(() => {
            setTicketLoading(false);
          });
        }
      }, {
        label: gettext('Generate AI title'),
        callback: () => generateAITitleForRow(row)
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
  }, [connection, generateAITitleForRow]);

  const localStorageName = useMemo(() => `sea-qa-${projectUuid}-connection-${connectionID}`, [projectUuid, connectionID]);

  const getRowDetails = useCallback((row) => {
    if ([
      CONNECTION_TYPE.GITHUB_ISSUE,
      CONNECTION_TYPE.DISCOURSE_FORUM,
      CONNECTION_TYPE.SEAFILE
    ].includes(connection.type)) {
      connectionsAPI.getConnectionRowDetail(projectUuid, connectionID, { _pk: row._id }).then((res) => {
        const detailData = res.data.row_details.map(detail => ({
          ...detail,
          time: detail.created_at || detail.updated_at,
          body: detail.body || detail.content,
        }));
        setRowDetailsTitle(row.title || row.filename);
        setRowDetails(detailData);
      });
    }
  }, [projectUuid, connectionID, connection]);

  const handleExpandRow = useCallback((row) => {
    currentRowRef.current = row._id;
    if (row && row.url && connection.type !== CONNECTION_TYPE.GITHUB_ISSUE) {
      window.open(row.url);
      return;
    }
    getRowDetails(row);
  }, [projectUuid, connectionID, connection]);

  const handleSwitchRows = useCallback((count) => {
    const rowsData = seaMetaDataRef.current.getOrderRows();
    const index = rowsData.findIndex(r => r._id === currentRowRef.current);
    if (index === -1) return;

    let newIndex = index + count;
    if (newIndex > rowsData.length - 1) {
      newIndex = 0;
    }
    if (newIndex < 0) {
      newIndex = rowsData.length - 1;
    }
    const currentRow = rowsData[newIndex];
    currentRowRef.current = currentRow._id;
    getRowDetails(currentRow);

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
        ref={seaMetaDataRef}
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
      {rowDetails && (
        <RowDetailsDialog
          rowDetailsTitle={rowDetailsTitle}
          rowDetails={rowDetails}
          onClose={() => setRowDetails(null)}
          handleSwitchRows={handleSwitchRows}
        />
      )}
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
