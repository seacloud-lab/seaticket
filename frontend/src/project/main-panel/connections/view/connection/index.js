import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import SeaMetadata, { CollaboratorsProvider } from '@/sea-metadata';
import RowDetailsDialog from '../../components/row-details-dialog';
import EmbeddingVisualization from '../../components/embedding-visualization';
import { connectionsAPI } from '@/project/api';
import CreateTicketDialog from '../../components/create-ticket-dialog';
import RelatedIssuesDialog from '../../components/related-issues-dialog';
import { useConnectionsPage } from '../../hooks';
import { gettext } from '@/constants';
import { BAR_TYPE } from '@/project/constants';
import { useProblemToBeResolved } from '@/project/main-panel/ask/hooks';
import {
  CONNECTION_TYPE, GITHUB_STATE_REASON_NAME_MAP, GITHUB_STATE_OPTION_NAME_MAP, CONNECTION_PREDEFINED_COLUMN_CONFIG,
  SUPPORT_OPEN_ORIGINAL_PAGE_CONNECTION_TYPES, SUPPORT_CREATE_RELATED_TICKET_CONNECTION_TYPES,
  SUPPORT_AI_CONNECTION_TYPES, SUPPORT_FIND_RELATED_ISSUES_CONNECTION_TYPES,
} from '../../constants';
import { toaster } from '@/components';
import context from '@/sea-metadata/context';
import { useConnections } from '../../hooks';
import { getOriginalPageUrl } from '../../utils';
import { AI_RESOLVE_TYPE } from '@/project/main-panel/ask/constants';
import { MetadataProvider } from '../../../tickets/hooks';
import eventBus from '@/utils/event-bus';
import { EVENT_BUS_TYPE } from '@/project/constants';

const Connection = ({ projectUuid, permission, connectionID, toggleBar }) => {
  const seaMetaDataRef = useRef(null);
  const allColumns = useRef([]);
  const { viewID, isLoading, updateConnectionInfo, updateViewID } = useConnectionsPage();
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
  const [isRelatedIssuesDialogOpen, setIsRelatedIssuesDialogOpen] = useState(false);
  const [relatedIssues, setRelatedIssues] = useState([]);
  const [isLoadingRelatedIssues, setIsLoadingRelatedIssues] = useState(false);

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
      allColumns.current = [];
      return connectionsAPI.getConnectionDetails(projectUuid, connectionID, ...params).then(res => {
        const { type, records } = res.data;
        let rows = Array.isArray(records) ? records : [];
        let columns = res?.data?.columns || [];
        allColumns.current = columns;
        let notDisplayColumnNames = ['_pk', 'slug', 'topic_id', 'url'];
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
              const url = getOriginalPageUrl(connection, row, allColumns.current);
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


  const handleCreateRelatedTicket = useCallback((row) => {
    if (!row) return;
    setTicketData(null);
    setTicketDialogOpen(true);
    setTicketLoading(true);
    connectionsAPI.convertRecordToTicket(projectUuid, connectionID, row._id).then(res => {
      const data = res.data || {};
      const relatedUrl = getOriginalPageUrl(connection, row, allColumns.current);
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

  const handleFindRelatedIssues = useCallback((row) => {
    if (!row) return;
    setIsLoadingRelatedIssues(true);
    setRelatedIssues([]);
    setIsRelatedIssuesDialogOpen(true);

    connectionsAPI.findRelatedRecords(projectUuid, connectionID, row._id)
      .then(res => {
        const relatedRecords = res.data.related_records || [];
        setRelatedIssues(relatedRecords);
      })
      .catch(error => {
        toaster.danger(gettext('Failed to find related issues'));
      })
      .finally(() => {
        setIsLoadingRelatedIssues(false);
      });
  }, [projectUuid, connectionID]);

  const generateFindRelatedIssuesOption = useCallback(({ row }) => {
    const enableFindRelatedIssues = SUPPORT_FIND_RELATED_ISSUES_CONNECTION_TYPES.includes(connection?.type);
    if (!enableFindRelatedIssues) return null;
    return {
      key: 'find_related_issues',
      label: gettext('Find related issues'),
      callback: () => handleFindRelatedIssues(row),
    };
  }, [connection, handleFindRelatedIssues]);

  const generateCreateRelatedTicketOption = useCallback(({ row }) => {
    const enableCreateRelatedTicket = SUPPORT_CREATE_RELATED_TICKET_CONNECTION_TYPES.includes(connection?.type);
    if (!enableCreateRelatedTicket) return null;
    return {
      key: 'create_related_ticket',
      label: gettext('Create related ticket'),
      callback: () => handleCreateRelatedTicket(row),
    };
  }, [connection, handleCreateRelatedTicket]);

  const generateAIOptions = useCallback(({ row }) => {
    const enableUseAI = SUPPORT_AI_CONNECTION_TYPES.includes(connection?.type);
    if (!enableUseAI) return null;

    const children = [
      connection?.type === CONNECTION_TYPE.GITHUB_ISSUE ? {
        label: gettext('Resolve issue'),
        key: 'resolve_issue',
        callback: () => handleResolveIssueByAI(row)
      } : null,
    ].filter(Boolean);

    if (children.length === 0) return null;

    return {
      key: 'AI',
      label: gettext('AI'),
      children
    };
  }, [connection, handleResolveIssueByAI]);

  const generateOpenOriginalPageOption = useCallback(({ row }) => {
    const url = getOriginalPageUrl(connection, row, allColumns.current);
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
    const findRelatedIssuesOption = generateFindRelatedIssuesOption({ row });
    const AIOption = generateAIOptions({ row, updateLocalRow });
    if (createRelatedTicketOption || findRelatedIssuesOption || AIOption || openOriginalPageOption) {
      tools.push({
        key: 'more',
        icon: 'more',
        children: [
          openOriginalPageOption,
          createRelatedTicketOption,
          findRelatedIssuesOption,
          (createRelatedTicketOption || findRelatedIssuesOption) && AIOption ? { key: 'divider' } : null,
          AIOption,
        ].filter(Boolean)
      });
    }
    return tools;
  }, [connection, generateOpenOriginalPageOption, generateCreateRelatedTicketOption, generateFindRelatedIssuesOption, generateAIOptions]);

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

    const findRelatedIssuesOption = generateFindRelatedIssuesOption({ row });
    list.push(findRelatedIssuesOption);

    list = list.filter(Boolean);

    const AIOptions = generateAIOptions({ row, updateLocalRow });
    if (list.length > 0 && AIOptions) {
      list.push('Divider');
    }
    list.push(AIOptions);
    return list.filter(Boolean);
  }, [connection, generateOpenOriginalPageOption, generateCreateRelatedTicketOption, generateFindRelatedIssuesOption, generateAIOptions]);

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
      updateConnectionInfo && updateConnectionInfo({ name: connection.name, type: connection.type });
      setLoadingConnection(false);
      return;
    }
    connectionsAPI.getConnection(projectUuid, connectionID).then(res => {
      const connection = res.data.record;
      updateConnectionInfo && updateConnectionInfo({ name: connection.name, type: connection.type });
      setConnection(connection);
      setLoadingConnection(false);
    }).catch(error => {
      toaster.danger(gettext('Connection not found'));
    });
  }, []);

  useEffect(() => {
    const unsubscribeNewConnection = eventBus.subscribe(EVENT_BUS_TYPE.OPEN_CONNECTION_EMBEDDING_VISUALIZATION, () => {
      setEmbeddingVisualizationOpen(true);
    });
    return () => {
      unsubscribeNewConnection();
    };
  }, []);

  if (isLoading || isLoadingConnection) return null;

  return (
    <CollaboratorsProvider>
      <MetadataProvider projectUuid={projectUuid}>
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
            columns={allColumns.current}
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
            onClose={() => setEmbeddingVisualizationOpen(false)}
            connectionId={connectionID}
            connectionName={connection?.name || ''}
            projectUuid={projectUuid}
          />
        )}
      </MetadataProvider>
      {isRelatedIssuesDialogOpen && (
        <RelatedIssuesDialog
          isOpen={isRelatedIssuesDialogOpen}
          isLoading={isLoadingRelatedIssues}
          relatedIssues={relatedIssues}
          connection={connection}
          connections={connections}
          onClose={() => setIsRelatedIssuesDialogOpen(false)}
          onRowClick={handleCreateRelatedTicket}
        />
      )}
    </CollaboratorsProvider>
  );

};

export default Connection;
