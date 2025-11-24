import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { Button } from 'reactstrap';
import SeaMetadata, { CollaboratorsProvider } from '@/sea-metadata';
import RowDetailsDialog from '../../components/row-details-dialog';
import EmbeddingVisualization from '../../components/embedding-visualization';
import { connectionsAPI } from '@/project/api';
import CreateTicketDialog from '../../components/create-ticket-dialog';
import { useConnectionsPage } from '../../hooks';
import { gettext } from '@/constants';
import { BAR_TYPE } from '@/project/constants';
import { useProblemToBeResolved } from '@/project/main-panel/ask/hooks';
import {
  CONNECTION_TYPE, GITHUB_STATE_REASON_NAME_MAP, GITHUB_STATE_OPTION_NAME_MAP, CONNECTION_PREDEFINED_COLUMN_CONFIG,
  SUPPORT_OPEN_ORIGINAL_PAGE_CONNECTION_TYPES, SUPPORT_CREATE_RELATED_TICKET_CONNECTION_TYPES,
  SUPPORT_AI_CONNECTION_TYPES,
} from '../../constants';
import context from '@/sea-metadata/context';
import { useConnections } from '../../hooks';
import { toaster } from '@/components';
import { getOriginalPageUrl } from '../../utils';
import { AI_RESOLVE_TYPE } from '@/project/main-panel/ask/constants';
import { TagsProvider, TypesProvider } from '../../../tickets/hooks';

const Connection = ({ projectUuid, permission, connectionID, toggleBar }) => {
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

  const { updateIssue } = useProblemToBeResolved();

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

  const api = useMemo(() => {
    const getMetadata = (...params) => {
      return connectionsAPI.getConnectionDetails(projectUuid, connectionID, ...params).then(res => {
        const { type, records } = res.data;
        let rows = Array.isArray(records) ? records : [];
        let columns = res?.data?.columns || [];
        let notDisplayColumnNames = ['_pk'];
        let columnConfig = CONNECTION_PREDEFINED_COLUMN_CONFIG[type];
        if (type === CONNECTION_TYPE.GITHUB_ISSUE) {
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
            context.setSetting('stateColumnKey', stateColumn.key);
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
        }
        if (SUPPORT_OPEN_ORIGINAL_PAGE_CONNECTION_TYPES.includes(type)) {
          columnConfig['title'] = {
            ...columnConfig['title'],
            click: (row) => {
              const url = getOriginalPageUrl(connection, row);
              if (!url) {
                toaster.danger(gettext('Missing required information'));
                return;
              }
              window.open(url, '_blank', 'noopener,noreferrer');
            }
          };
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
  }, [projectUuid, connectionID, connection]);

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

  const handleCreateRelatedTicket = useCallback((row) => {
    if (!row) return;
    setTicketData(null);
    setTicketDialogOpen(true);
    setTicketLoading(true);
    connectionsAPI.convertRecordToTicket(projectUuid, connectionID, row._id).then(res => {
      const data = res.data || {};
      const relatedUrl = getOriginalPageUrl(connection, row);
      const prefix = data.content || '';
      const suffix = `${gettext('Related record')}: ${relatedUrl}`;
      data.content = prefix ? `${prefix}\n\n${suffix}` : suffix;
      setTicketData(data);
    }).finally(() => {
      setTicketLoading(false);
    });
  }, [projectUuid, connectionID, connection]);

  const handleResolveIssueByAI = useCallback((issue) => {
    if (!issue || !connectionID) return;
    updateIssue({ ...issue, connection_id: connectionID }, AI_RESOLVE_TYPE.AGENT);
    toggleBar([BAR_TYPE.CHAT]);
  }, [connectionID, toggleBar, updateIssue]);

  const generateCreateRelatedTicketOption = useCallback(({ row }) => {
    const enableCreateRelatedTicket = SUPPORT_CREATE_RELATED_TICKET_CONNECTION_TYPES.includes(connection?.type);
    if (!enableCreateRelatedTicket) return null;
    return {
      key: 'create_related_ticket',
      label: gettext('Create related ticket'),
      callback: () => handleCreateRelatedTicket(row),
    };
  }, [connection, handleCreateRelatedTicket]);

  const generateAIOptions = useCallback(({ row, updateLocalRow }) => {
    const enableUseAI = SUPPORT_AI_CONNECTION_TYPES.includes(connection?.type);
    if (!enableUseAI) return null;
    return {
      key: 'AI',
      label: gettext('AI'),
      children: [
        {
          label: gettext('Generate summary'),
          key: 'generate_summary',
          callback: () => generateAISummaryForRow(row, updateLocalRow)
        },
        connection?.type === CONNECTION_TYPE.GITHUB_ISSUE ? {
          label: gettext('Resolve issue'),
          key: 'resolve_issue',
          callback: () => handleResolveIssueByAI(row)
        } : null,
      ].filter(Boolean)
    };
  }, [connection, generateAISummaryForRow, handleResolveIssueByAI]);

  const generateOpenOriginalPageOption = useCallback(({ row }) => {
    const url = getOriginalPageUrl(connection, row);
    if (!url) return null;
    return {
      label: gettext('Open original page'),
      key: 'open_original_page',
      callback: () => window.open(url, '_blank', 'noopener,noreferrer'),
    };
  }, [connection]);

  const createRowsTools = useCallback(({ rows, updateLocalRow }) => {
    if (rows.length > 1) return [];
    let tools = [];
    const row = rows[0];
    const openOriginalPageOption = generateOpenOriginalPageOption({ row });
    const createRelatedTicketOption = generateCreateRelatedTicketOption({ row });
    const AIOption = generateAIOptions({ row, updateLocalRow });
    if (createRelatedTicketOption || AIOption || openOriginalPageOption) {
      tools.push({
        key: 'more',
        icon: 'more',
        children: [
          openOriginalPageOption,
          createRelatedTicketOption,
          createRelatedTicketOption && AIOption ? { key: 'divider' } : null,
          AIOption,
        ].filter(Boolean)
      });
    }
    return tools;
  }, [connection, generateOpenOriginalPageOption, generateCreateRelatedTicketOption, generateAIOptions]);

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

    let list = [];
    const openOriginalPageOption = generateOpenOriginalPageOption({ row });
    list.push(openOriginalPageOption);

    const createRelatedTicketOption = generateCreateRelatedTicketOption({ row });
    list.push(createRelatedTicketOption);

    list = list.filter(Boolean);

    const AIOptions = generateAIOptions({ row, updateLocalRow });
    if (list.length > 0 && AIOptions) {
      list.push('Divider');
    }
    list.push(AIOptions);
    return list.filter(Boolean);
  }, [connection, generateOpenOriginalPageOption, generateCreateRelatedTicketOption, generateAIOptions]);

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

  if (isLoading || isLoadingConnection) return null;

  return (
    <CollaboratorsProvider>
      <TypesProvider projectUuid={projectUuid}>
        <TagsProvider projectUuid={projectUuid}>
          {(connection?.type === CONNECTION_TYPE.GITHUB_ISSUE || connection?.type === CONNECTION_TYPE.DISCOURSE_FORUM) && (
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
            viewID={viewID}
            api={api}
            ref={seaMetaDataRef}
            className="sea-qa-connection-details"
            localStorageNamePrefix={localStorageName}
            createRowsTools={createRowsTools}
            createContextMenuOptions={createContextMenuOptions}
            permission={permission}
            typesData={typesData}
            toggleView={updateViewID}
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
