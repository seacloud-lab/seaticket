import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import copy from 'copy-to-clipboard';
import { Button } from 'reactstrap';
import SeaMetadata, { CollaboratorsProvider } from '@/sea-metadata';
import RowDetailsDialog from '../../components/row-details-dialog';
import EmbeddingVisualization from '../../components/embedding-visualization';
import { connectionsAPI } from '@/project/api';
import CreateTicketDialog from '../../components/create-ticket-dialog';
import { useConnectionsPage } from '../../hooks';
import { gettext } from '@/constants';
import { CONNECTION_TYPE, GITHUB_STATE_REASON_NAME_MAP, GITHUB_STATE_OPTION_NAME_MAP, CONNECTION_PREDEFINED_COLUMN_CONFIG } from '../../constants';
import { GithubIssue, DiscourseForum, WebCrawl, Seafile, Email } from '../../models';
import context from '@/sea-metadata/context';
import { useConnections } from '../../hooks';
import { toaster } from '@/components';
import { TagsProvider, TypesProvider } from '../../../tickets/hooks';

const SERVER_COMPUTABLE_CONNECTION_TYPE = [
  CONNECTION_TYPE.GITHUB_ISSUE,
  CONNECTION_TYPE.SITE,
  CONNECTION_TYPE.DISCOURSE_FORUM,
  CONNECTION_TYPE.SEAFILE,
  CONNECTION_TYPE.EMAIL,
];

const MULTIPLE_VIEWS_CONNECTION_TYPE = [
  CONNECTION_TYPE.GITHUB_ISSUE,
  CONNECTION_TYPE.SITE,
  CONNECTION_TYPE.DISCOURSE_FORUM,
  CONNECTION_TYPE.SEAFILE,
  CONNECTION_TYPE.EMAIL,
];

const Connection = ({ projectUuid, permission, connectionID }) => {
  const seaMetaDataRef = useRef(null);
  const { viewID, isLoading, updatePageName, updateViewID } = useConnectionsPage();
  const { connections } = useConnections();
  const [connection, setConnection] = useState({});
  const [currentRow, setCurrentRow] = useState({});
  const [isLoadingConnection, setLoadingConnection] = useState(true);
  const [typesData, setTypesData] = useState(null);
  const [isTicketDialogOpen, setTicketDialogOpen] = useState(false);
  const [isEmbeddingVisualizationOpen, setEmbeddingVisualizationOpen] = useState(false);
  const [ticketData, setTicketData] = useState(null);
  const [isTicketLoading, setTicketLoading] = useState(false);
  const [isShowRowDetailsDialog, setIsShowRowDetailsDialog] = useState(false);

  const generateAISummaryForRow = useCallback((row, updateLocalRow) => {
    toaster.notify(gettext('Generating AI summary...'), { duration: 0 });

    connectionsAPI.generateAISummary(projectUuid, connectionID, row._id)
      .then(res => {
        toaster.closeAll();
        if (res.data && res.data.ai_summary) {
          toaster.success(gettext('AI summary generated'));
          updateLocalRow && updateLocalRow({ rowId: row._id }, { ai_summary: res.data.ai_summary, ai_processed_time: res.data.ai_processed_time });
        } else {
          toaster.warning(gettext('Failed to generate AI summary'));
        }
      })
      .catch(error => {
        toaster.closeAll();
        const errorMessage = error.response?.data?.error_msg || gettext('Failed to generate AI summary');
        toaster.danger(errorMessage);
      });
  }, [projectUuid, connectionID]);

  const getDiscourseOriginalPageUrl = useCallback((connection, row) => {
    const discourseBaseUrl = connection.config?.url;
    if (!discourseBaseUrl || !row.slug || !row.topic_id) {
      toaster.danger(gettext('Missing required information'));
      return;
    }
    const baseUrl = discourseBaseUrl.replace(/\/$/, '');
    const originalPageUrl = `${baseUrl}/t/${row.slug}/${row.topic_id}`;
    return originalPageUrl;
  }, []);

  const getSeafileOriginalPageUrl = useCallback((connection, row) => {
    const { server_url, repo_id } = connection.config;
    const { path, title } = row;
    if (!server_url || !repo_id || !title || !path) {
      toaster.danger(gettext('Missing required information'));
      return;
    }
    const baseUrl = server_url.replace(/\/$/, '');
    const filePath = path.replace(/\/$/, '');
    const originalPageUrl = `${baseUrl}/lib/${repo_id}/file${filePath}/${title}`;
    return originalPageUrl;
  }, []);

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
        row: gettext('GitHub issue'),
        rows: gettext('GitHub issues'),
        Row: gettext('GitHub issue'),
        Rows: gettext('GitHub issues'),
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
          columnConfig['title'] = {
            ...columnConfig['title'],
            click: (row) => {
              const discourseOriginalPageUrl = getDiscourseOriginalPageUrl(connection, row);
              window.open(discourseOriginalPageUrl, '_blank', 'noopener,noreferrer');
            }
          };
        } else if (type === CONNECTION_TYPE.SITE) {
          rows = Array.isArray(records) ? records.map(r => new WebCrawl(r)) : [];
        } else if (type === CONNECTION_TYPE.SEAFILE) {
          rows = Array.isArray(records) ? records.map(r => new Seafile(r)) : [];
          columnConfig['title'] = {
            ...columnConfig['title'],
            click: (row) => {
              const seafileOriginalPageUrl = getSeafileOriginalPageUrl(connection, row);
              window.open(seafileOriginalPageUrl, '_blank', 'noopener,noreferrer');
            }
          };
        } else if (type === CONNECTION_TYPE.EMAIL) {
          rows = Array.isArray(records) ? records.map(r => new Email(r)) : [];
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
    updateLocalRow,
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
          const discourseOriginalPageUrl = getDiscourseOriginalPageUrl(connection, row);
          window.open(discourseOriginalPageUrl, '_blank', 'noopener,noreferrer');
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
      }, {
        label: gettext('Generate AI summary'),
        callback: () => generateAISummaryForRow(row, updateLocalRow)
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
        label: gettext('Generate AI summary'),
        callback: () => generateAISummaryForRow(row, updateLocalRow)
      }];
    }

    if (connection?.type === CONNECTION_TYPE.SITE) {
      return [{
        label: gettext('Open original page'),
        callback: () => {
          window.open(row.url, '_blank', 'noopener,noreferrer');
        }
      }, {
        label: gettext('Generate AI summary'),
        callback: () => generateAISummaryForRow(row, updateLocalRow)
      }];
    }

    if (connection?.type === CONNECTION_TYPE.SEAFILE) {
      return [{
        label: gettext('Generate AI summary'),
        callback: () => generateAISummaryForRow(row, updateLocalRow)
      }];
    }
    return [];
  }, [connection, generateAISummaryForRow]);

  const localStorageName = useMemo(() => `sea-qa-${projectUuid}-connection-${connectionID}`, [projectUuid, connectionID]);

  const handleExpandRow = useCallback((row) => {
    setCurrentRow(row);
    setIsShowRowDetailsDialog(true);
  }, [projectUuid, connectionID, connection]);

  const switchRow = useCallback((step) => {
    const rowsData = seaMetaDataRef.current.getOrderRows();
    const index = rowsData.findIndex(r => r._id === currentRow._id);
    if (index === -1) return;

    let newIndex = index + step;
    if (newIndex > rowsData.length - 1) {
      newIndex = 0;
    }
    if (newIndex < 0) {
      newIndex = rowsData.length - 1;
    }
    setCurrentRow(rowsData[newIndex]);
  }, [currentRow, seaMetaDataRef]);

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
      <TypesProvider projectUuid={projectUuid}>
        <TagsProvider projectUuid={projectUuid}>
          {connection?.type === CONNECTION_TYPE.GITHUB_ISSUE && (
            <div style={{
              position: 'absolute',
              top: '8px',
              right: '140px',
              zIndex: 100
            }}>
              <Button
                color="primary"
                size="sm"
                className="sea-qa-project-add-connection-btn"
                style={{ height: '28px', display: 'inline-flex', alignItems: 'center', paddingTop: 0, paddingBottom: 0 }}
                onClick={() => setEmbeddingVisualizationOpen(true)}
              >
                <i className="sf3-font-ai sf3-font mr-2"></i>
                {gettext('Analyze')}
              </Button>
            </div>
          )}
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
          {isShowRowDetailsDialog && (
            <RowDetailsDialog
              projectUuid={projectUuid}
              connection={connection}
              row={currentRow}
              switchRow={switchRow}
              onToggle={() => setIsShowRowDetailsDialog(false)}
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
          {isEmbeddingVisualizationOpen && (
            <EmbeddingVisualization
              isOpen={isEmbeddingVisualizationOpen}
              onClose={() => setEmbeddingVisualizationOpen(false)}
              connectionId={connectionID}
              connectionName={connection?.name || ''}
              projectUuid={projectUuid}
              viewId={viewID}
            />
          )}
        </TagsProvider>
      </TypesProvider>
    </CollaboratorsProvider>
  );

};

export default Connection;
