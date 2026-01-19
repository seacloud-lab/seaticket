import React, { useMemo, useCallback, useState, useRef } from 'react';
import SeaMetadata from '@/sea-metadata';
import ResourceDetailsDialog from '@/project/components/resource-details-dialog';
import { connectionsAPI } from '@/project/api';
import CreateTicketDialog from '../../components/create-ticket-dialog';
import RelatedIssuesDialog from '../../components/related-issues-dialog';
import { useConnectionsPage } from '../../hooks';
import { gettext } from '@/constants';
import { BAR_TYPE } from '@/project/constants';
import { useAIChatTools } from '@/project/main-panel/ask/hooks';
import {
  CONNECTION_TYPE, GITHUB_STATE_REASON_NAME_MAP, GITHUB_STATE_OPTION_NAME_MAP, CONNECTION_PREDEFINED_COLUMN_CONFIG,
  SUPPORT_OPEN_ORIGINAL_PAGE_CONNECTION_TYPES, SUPPORT_CREATE_RELATED_TICKET_CONNECTION_TYPES,
  SUPPORT_AI_CONNECTION_TYPES, SUPPORT_FIND_RELATED_ISSUES_CONNECTION_TYPES,
  CONNECTION_PREDEFINED_COLUMN_NAME,
} from '../../constants';
import { CenteredLoading, toaster } from '@/components';
import context from '@/sea-metadata/context';
import { useConnections } from '../../hooks';
import { getOriginalPageUrl, getTableName } from '../../utils';
import { AI_RESOLVE_TYPE } from '@/project/main-panel/ask/constants';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { AttachmentObject } from '@/project/main-panel/ask/models';
import { convertRowToNameValue, convertRowsToNameValue } from '@/sea-metadata/utils/row';
import { useData } from '@/project/hooks';

const Records = ({ projectUuid, permission, connectionID, toggleBar }) => {
  const seaMetaDataRef = useRef(null);
  const allColumns = useRef([]);

  const [currentRow, setCurrentRow] = useState({});
  const [typesData, setTypesData] = useState(null);
  const [isTicketDialogOpen, setTicketDialogOpen] = useState(false);
  const [ticketData, setTicketData] = useState(null);
  const [isTicketLoading, setTicketLoading] = useState(false);
  const [isShowRowDetailsDialog, setIsShowRowDetailsDialog] = useState(false);
  const [isShowRelatedIssuesDialog, setIsShowRelatedIssuesDialog] = useState(false);
  const [isDeletingRecords, setIsDeletingRecords] = useState(false);

  const { updateAttachments } = useAIChatTools();
  const { viewID, isLoading: isLoadingConnections, toggleView, toggleChildrenPageSlugId } = useConnectionsPage();
  const { connections } = useConnections();
  const {
    data,
    getTableViews, getTableView, insertView, deleteView, modifyView, moveView, duplicateView,
    getMetadata, modifyRow, modifyRows, deleteRows
  } = useData();

  const connection = useMemo(() => connections.find(c => c.id === connectionID), [connections, connectionID]);

  const getTableNameByConnectionID = useCallback((connectionID) => {
    const connection = connections.find(c => c.id === connectionID);
    const tableName = getTableName(connection);
    return tableName;
  }, [connections]);

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
    let _api = {
      getMetadata: (...params) => {
        const tableName = getTableNameByConnectionID(connectionID);
        return getMetadata(tableName, params[0], () => connectionsAPI.getConnectionDetails(projectUuid, connectionID, ...params)).then(res => {
          const { records } = res.data;
          const type = connection?.type;
          let rows = Array.isArray(records) ? records : [];
          let columns = res?.data?.columns || [];
          allColumns.current = columns;
          let notDisplayColumnNames = [
            CONNECTION_PREDEFINED_COLUMN_NAME._PK,
            CONNECTION_PREDEFINED_COLUMN_NAME.SLUG,
            CONNECTION_PREDEFINED_COLUMN_NAME.TOPIC_ID,
            CONNECTION_PREDEFINED_COLUMN_NAME.URL,
          ];
          let columnConfig = CONNECTION_PREDEFINED_COLUMN_CONFIG[type];
          if (type === CONNECTION_TYPE.GITHUB_ISSUE) {
            const typeColum = columns.find(c => c.name === CONNECTION_PREDEFINED_COLUMN_NAME.ISSUE_TYPE);
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

            const stateColumnIndex = columns.findIndex(c => c.name === CONNECTION_PREDEFINED_COLUMN_NAME.STATE);
            if (stateColumnIndex > -1) {
              const stateColumn = columns[stateColumnIndex];
              context.setSetting('stateColumnKey', stateColumn.key);
              let options = stateColumn.data?.options || [];
              options = options.map(o => ({ ...o, display_name: GITHUB_STATE_OPTION_NAME_MAP[o.name] || o.name }));
              columns[stateColumnIndex].data = { ...stateColumn.data, options };
            }

            const stateReasonColumnIndex = columns.findIndex(c => c.name === CONNECTION_PREDEFINED_COLUMN_NAME.STATE_REASON);
            if (stateReasonColumnIndex > -1) {
              const stateReasonColumn = columns[stateReasonColumnIndex];
              let options = stateReasonColumn.data?.options || [];
              options = options.map(o => ({ ...o, display_name: GITHUB_STATE_REASON_NAME_MAP[o.name] || o.name }));
              columns[stateReasonColumnIndex].data = { ...stateReasonColumn.data, options };
            }
          }
          if (SUPPORT_OPEN_ORIGINAL_PAGE_CONNECTION_TYPES.includes(type)) {
            columnConfig[CONNECTION_PREDEFINED_COLUMN_NAME.TITLE] = {
              ...columnConfig[CONNECTION_PREDEFINED_COLUMN_NAME.TITLE],
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
      },
      getViews: () => {
        const tableName = getTableNameByConnectionID(connectionID);
        return getTableViews(tableName, () => connectionsAPI.listViews(projectUuid, connectionID));
      },
      getView: (viewID) => {
        const tableName = getTableNameByConnectionID(connectionID);
        return getTableView(tableName, viewID, () => connectionsAPI.getView(projectUuid, viewID, connectionID));
      },
      insertView: (name, viewData) => {
        const tableName = getTableNameByConnectionID(connectionID);
        return insertView(tableName, () => connectionsAPI.insertView(projectUuid, connectionID, name, viewData));
      },
      deleteView: (viewID) => {
        const tableName = getTableNameByConnectionID(connectionID);
        return deleteView(tableName, viewID, () => connectionsAPI.deleteView(projectUuid, connectionID, viewID));
      },
      moveView: (sourceViewID, targetViewID) => {
        const tableName = getTableNameByConnectionID(connectionID);
        return modifyView(tableName, sourceViewID, targetViewID, () => connectionsAPI.moveView(projectUuid, connectionID, sourceViewID, targetViewID));
      },
      duplicateView: (viewID) => {
        const tableName = getTableNameByConnectionID(connectionID);
        return duplicateView(tableName, () => connectionsAPI.duplicateView(projectUuid, connectionID, viewID));
      },
      modifyView: (viewID, viewData) => {
        const tableName = getTableNameByConnectionID(connectionID);
        return modifyView(tableName, viewID, viewData, () => connectionsAPI.modifyView(projectUuid, connectionID, viewID, viewData));
      },
    };
    if (connection.type === CONNECTION_TYPE.EMAIL) {
      _api.modifyRow = (row_id, row_update, isCopyPaste, { data, typesData, tagsData } = {}) => {
        const rowData = convertRowToNameValue(row_update, { data, typesData, tagsData });
        const tableName = getTableNameByConnectionID(connectionID);
        return modifyRow(tableName, row_id, row_update, () => connectionsAPI.modifyConnectionRecord(projectUuid, connectionID, row_id, rowData));
      };
      _api.modifyRows = (rowsUpdate, isCopyPaste, { data, typesData, tagsData } = {}) => {
        const rowsData = convertRowsToNameValue(rowsUpdate, { data, typesData, tagsData });
        const tableName = getTableNameByConnectionID(connectionID);
        return modifyRows(tableName, rowsUpdate, () => connectionsAPI.modifyConnectionRecords(projectUuid, connectionID, rowsData));
      };
    }

    return _api;
  }, [
    projectUuid, connectionID, connection, connections, getTableNameByConnectionID,
    data, getTableViews, getTableView, insertView, deleteView, modifyView, moveView, duplicateView, getMetadata,
    modifyRows, modifyRow
  ]);

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

  const handleResolveIssueByAI = useCallback((issues = []) => {
    if (!Array.isArray(issues) || issues.length === 0 || !connectionID) return;
    updateAttachments(issues, AI_RESOLVE_TYPE.AGENT);
    toggleBar([BAR_TYPE.CHAT]);
  }, [connectionID, toggleBar, updateAttachments]);

  const handleFindRelatedIssues = useCallback((row) => {
    if (!row) return;
    setCurrentRow(row);
    setIsShowRelatedIssuesDialog(true);
  }, [projectUuid, connectionID]);

  const handleDeleteRecords = useCallback((rows, deleteLocalRows) => {
    if (!rows || rows.length === 0) return;

    const recordCount = rows.length;
    setIsDeletingRecords(true);
    const recordIDs = rows.map(row => row._id);
    const tableName = getTableName(connection);
    deleteRows(tableName, recordIDs, () => connectionsAPI.deleteConnectionRecords(projectUuid, connectionID, recordIDs))
      .then(() => {
        const successMessage = recordCount === 1
          ? gettext('Email deleted successfully')
          : gettext('Emails deleted successfully');
        toaster.success(successMessage);
        deleteLocalRows && deleteLocalRows(recordIDs);
      })
      .catch(() => {
        const dangerMessage = recordCount === 1
          ? gettext('Failed to delete email')
          : gettext('Failed to delete emails');
        toaster.danger(dangerMessage);
      })
      .finally(() => {
        setIsDeletingRecords(false);
      });
  }, [projectUuid, connectionID, connection, deleteRows]);

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

  const generateAIOptions = useCallback(({ rows }) => {
    const enableUseAI = SUPPORT_AI_CONNECTION_TYPES.includes(connection?.type);
    if (!enableUseAI) return null;

    const children = [
      connection?.type === CONNECTION_TYPE.GITHUB_ISSUE || connection?.type === CONNECTION_TYPE.DISCOURSE_FORUM || connection?.type === CONNECTION_TYPE.EMAIL ? {
        label: rows.length === 1 ? gettext('Chat issue') : gettext('Chat issues'),
        key: 'chat_issues',
        callback: () => {
          let newRows = [];
          const titleColumn = getColumnByName(allColumns.current, 'title');
          const stateColumn = getColumnByName(allColumns.current, 'state');
          const urlColumn = getColumnByName(allColumns.current, 'url');

          if (!titleColumn) return;
          rows.forEach(row => {
            const newRow = {
              _pk: row._id,
              title: getCellValueByColumn(row, titleColumn),
              state: getCellValueByColumn(row, stateColumn),
              url: getCellValueByColumn(row, urlColumn),
              connection_id: connectionID,
              type: connection?.type,
            };
            newRows.push(new AttachmentObject(newRow));
          });
          handleResolveIssueByAI(newRows);
        }
      } : null,
    ].filter(Boolean);

    if (children.length === 0) return null;

    return {
      key: 'AI',
      label: gettext('AI'),
      children
    };
  }, [connection, connectionID, handleResolveIssueByAI]);

  const generateOpenOriginalPageOption = useCallback(({ row }) => {
    const url = getOriginalPageUrl(connection, row, allColumns.current);
    if (!url) return null;
    return {
      label: gettext('Open original page'),
      key: 'open_original_page',
      callback: () => window.open(url, '_blank', 'noopener,noreferrer'),
    };
  }, [connection]);

  const createRowsTools = useCallback(({ rows, columns, deleteLocalRows }) => {
    let children = [];
    if (rows.length === 1) {
      const row = rows[0];
      const openOriginalPageOption = generateOpenOriginalPageOption({ row });
      const createRelatedTicketOption = generateCreateRelatedTicketOption({ row });
      const findRelatedIssuesOption = generateFindRelatedIssuesOption({ row });
      children = [
        openOriginalPageOption,
        createRelatedTicketOption,
        findRelatedIssuesOption,
      ].filter(Boolean);
    }

    const AIOption = generateAIOptions({ rows, columns });
    if (children.length > 0 && AIOption) {
      children.push({ key: 'divider' });
    }
    if (AIOption) {
      children.push(AIOption);
    }

    const tools = [];

    if (connection.type === CONNECTION_TYPE.EMAIL && rows.length > 0) {
      tools.push({
        key: 'delete',
        icon: 'delete',
        callback: () => handleDeleteRecords(rows, deleteLocalRows),
        disabled: isDeletingRecords,
      });
    }

    if (children.length > 0) {
      tools.push({
        key: 'more',
        icon: 'more',
        children,
      });
    }
    return tools;
  }, [connection, generateOpenOriginalPageOption, generateCreateRelatedTicketOption, generateFindRelatedIssuesOption, generateAIOptions, handleDeleteRecords, isDeletingRecords]);

  const createContextMenuOptions = useCallback(({
    isGroupView,
    selectedRange,
    selectedPosition,
    table,
    rowMetrics,
    rowGetterByIndex,
  }) => {
    let list = [];

    // handle selected multiple cells
    if (selectedRange) {
      const { topLeft, bottomRight } = selectedRange;
      let rows = [];
      let currentGroupRowIndex = topLeft.groupRowIndex;
      for (let i = topLeft.rowIdx; i <= bottomRight.rowIdx; i++) {
        const row = rowGetterByIndex({ isGroupView, groupRowIndex: currentGroupRowIndex, rowIndex: i });
        currentGroupRowIndex++;
        if (row) {
          rows.push(row);
        }
      }
      if (rows.length > 0) {
        const AIOptions = generateAIOptions({ rows, columns: table.columns });
        if (AIOptions) {
          list.push(AIOptions);
        }
      }
      return list;
    }

    // handle selected rows
    const selectedRowIds = rowMetrics ? Object.keys(rowMetrics.idSelectedRowMap) : [];
    if (selectedRowIds.length > 1) {
      let rows = [];
      selectedRowIds.forEach(id => {
        const row = table.id_row_map[id];
        if (row) {
          rows.push(row);
        }
      });
      if (rows.length > 0) {
        const AIOptions = generateAIOptions({ rows, columns: table.columns });
        if (AIOptions) {
          list.push(AIOptions);
        }
      }
      return list;
    }

    // handle selected cell
    if (!selectedPosition) return [];
    const { groupRowIndex, rowIdx: rowIndex } = selectedPosition;
    const row = rowGetterByIndex({ isGroupView, groupRowIndex, rowIndex }) || table.id_row_map[selectedRowIds[0]];
    if (!row) return [];

    const openOriginalPageOption = generateOpenOriginalPageOption({ row });
    list.push(openOriginalPageOption);

    const createRelatedTicketOption = generateCreateRelatedTicketOption({ row });
    list.push(createRelatedTicketOption);

    const findRelatedIssuesOption = generateFindRelatedIssuesOption({ row });
    list.push(findRelatedIssuesOption);

    list = list.filter(Boolean);

    const AIOptions = generateAIOptions({ rows: [row], columns: table.columns });
    if (list.length > 0 && AIOptions) {
      list.push('Divider');
    }
    list.push(AIOptions);
    return list.filter(Boolean);
  }, [connection, generateOpenOriginalPageOption, generateCreateRelatedTicketOption, generateFindRelatedIssuesOption, generateAIOptions]);

  const localStorageName = useMemo(() => `sea-qa-${projectUuid}-connection-${connectionID}`, [projectUuid, connectionID]);

  const handleExpandRow = useCallback((row) => {
    if (connection.type === CONNECTION_TYPE.EMAIL) {
      toggleChildrenPageSlugId(row._id);
      return;
    }
    setCurrentRow({ ...row, connection_id: connection.id, type: connection.type });
    setIsShowRowDetailsDialog(true);
  }, [projectUuid, connectionID, connection, toggleChildrenPageSlugId]);

  const switchResource = useCallback((step) => {
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
    const row = rowsData[newIndex];
    setCurrentRow({ ...row, connection_id: connection.id, type: connection.type });
  }, [currentRow, connection, seaMetaDataRef]);

  if (isLoadingConnections) return (<CenteredLoading />);

  return (
    <>
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
        toggleView={toggleView}
        expandRow={handleExpandRow}
        t={t}
      />
      {isShowRowDetailsDialog && (
        <ResourceDetailsDialog
          projectUuid={projectUuid}
          resource={currentRow}
          columns={allColumns.current}
          switchResource={switchResource}
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
      {isShowRelatedIssuesDialog && (
        <RelatedIssuesDialog
          projectUuid={projectUuid}
          row={currentRow}
          connectionId={connectionID}
          onClose={() => {setIsShowRelatedIssuesDialog(false); setCurrentRow({});}}
          onRowClick={handleCreateRelatedTicket}
        />
      )}
    </>
  );

};

export default Records;
