import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { toaster } from '@/components';
import { gettext } from '@/constants';
import User from '@/models/user';
import { connectionsAPI } from '@/project/api';
import ResourceDetailsDialog from '@/project/components/resource-details-dialog';
import { EVENT_BUS_TYPE } from '@/project/constants';
import { useData, useTags, useMetadata } from '@/project/hooks';
import { useLinkedTicketUpdate, useLinkTicket } from '@/project/hooks/link-ticket';
import { useRelatedIssues } from '@/project/hooks/related-issues';
import { useResourceUpdate } from '@/project/hooks/resource-dialog';
import { useAIChatTools } from '@/project/main-panel/ask/hooks';
import { normalizeContextMenuOptions } from '@/project/utils';
import SeaMetadata from '@/sea-metadata';
import { EVENT_BUS_TYPE as SEA_METADATA_EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import context from '@/sea-metadata/context';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { convertRowToNameValue, convertRowsToNameValue, convertRowToKeyValue } from '@/sea-metadata/utils/row';
import eventBus from '@/utils/event-bus';
import { Utils } from '@/utils/utils';
import {
  CONNECTION_TYPE, CONNECTION_PREDEFINED_COLUMN_NAME, SUPPORT_MODIFY_CONNECTION_RECORDS_TYPES,
  CONNECTION_COLUMNS_WIDTH_CONFIG, CONNECTION_COLUMNS_ORDER_CONFIG,
} from '../../../constants';
import { useConnectionsPage, useConnections } from '../../../hooks';
import {
  getTableName, generatorRowClassName, cascadeUpdate,
  generateAIOptions, generateMarkAsOutdatedOptions, generateFindRelatedIssuesOption,
  generateOpenOriginalPageOption, generateCopyOriginalLinkOption,
  formatColumns,
} from '../../../utils';

import './index.css';

const Records = ({ projectUuid, permission, connectionID, toggleBar }) => {
  const seaMetaDataRef = useRef(null);
  const allColumns = useRef([]);

  const [currentRow, setCurrentRow] = useState({});
  const [typesData, setTypesData] = useState(null);
  const [isShowRowDetailsDialog, setIsShowRowDetailsDialog] = useState(false);

  const { handleResolveAttachmentsByAI } = useAIChatTools();
  const { toggleChildrenPageSlugId } = useConnectionsPage();
  const { connections } = useConnections();
  const {
    getTableViews, getTableView, insertView, deleteView, modifyView, duplicateView,
    getMetadata, modifyRow, modifyRows, deleteRows,
  } = useData();
  const { tagsData, createTag } = useTags();
  const { customersData } = useMetadata();
  const { generateConnectionLinkTicketOptions } = useLinkTicket();
  const { openRelatedIssues } = useRelatedIssues();

  const connection = useMemo(() => connections.find(c => c.id === connectionID), [connections, connectionID]);

  useLinkedTicketUpdate({
    projectUuid,
    tableName: getTableName(connection),
    onUpdate: ({ rowId, rowUpdateData, linkedRecords }) => {
      context.eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, rowId, rowUpdateData);
      context.eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.UPDATE_DATA_ATTRIBUTE, { linked_records: linkedRecords }, false);
    },
  });

  useResourceUpdate({ projectUuid, tableName: getTableName(connection), onUpdate: ({ rowId, rowUpdateData, deleted, updateList = true }) => {
    if (!updateList) return;
    if (deleted) {
      context.eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.DELETE_ROWS, [rowId]);
    } else if (rowUpdateData) {
      context.eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, rowId, rowUpdateData);
    }
  } });

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
    if (connectionType === CONNECTION_TYPE.GENERAL_TASK) {
      return {
        row: gettext('general task'),
        rows: gettext('general tasks'),
        Row: gettext('General task'),
        Rows: gettext('General tasks'),
      };
    }
    return {};
  }, [connection]);

  const api = useMemo(() => {
    let _api = {
      getMetadata: (...params) => {
        const tableName = getTableNameByConnectionID(connectionID);
        return getMetadata(tableName, params[0], () => connectionsAPI.getConnectionDetails(projectUuid, connectionID, ...params).then(res => {
          return {
            data: {
              ...res.data,
              linked_records: res.data?.ticket_pk_to_ticket_title || {},
            }
          };
        })).then(res => {
          const { records } = res.data;
          const linked_records = res?.data?.linked_records || {};
          let rows = Array.isArray(records) ? records : [];
          let columns = res?.data?.columns || [];
          allColumns.current = columns;
          const relatedUsers = Array.isArray(res?.data?.related_users) ? res.data.related_users : [];
          const collaborators = relatedUsers.map(user => new User(user));
          // Resolve Confluence account IDs → display names in-place
          if (connection.type === CONNECTION_TYPE.CONFLUENCE && relatedUsers.length > 0) {
            const userMap = {};
            relatedUsers.forEach(u => { if (u.user_id) userMap[u.user_id] = u.name; });
            const creatorCol = columns.find(c => c.name === 'creator_id');
            const modifierCol = columns.find(c => c.name === 'last_modifier_id');
            rows.forEach(row => {
              if (creatorCol) {
                const val = row[creatorCol.key] || row[creatorCol.name];
                if (val && userMap[val]) {
                  row[creatorCol.key] = userMap[val];
                  row[creatorCol.name] = userMap[val];
                }
              }
              if (modifierCol) {
                const val = row[modifierCol.key] || row[modifierCol.name];
                if (val && userMap[val]) {
                  row[modifierCol.key] = userMap[val];
                  row[modifierCol.name] = userMap[val];
                }
              }
            });
          }
          // Resolve Jira account IDs → display names in-place
          if (connection.type === CONNECTION_TYPE.JIRA_ISSUE && relatedUsers.length > 0) {
            const jiraUserMap = {};
            relatedUsers.forEach(u => { if (u.user_id) jiraUserMap[u.user_id] = u.name; });
            const authorCol = columns.find(c => c.name === 'author');
            const assigneesCol = columns.find(c => c.name === 'assignees');
            rows.forEach(row => {
              if (authorCol) {
                const val = row[authorCol.key] || row[authorCol.name];
                if (val && jiraUserMap[val]) {
                  row[authorCol.key] = jiraUserMap[val];
                  row[authorCol.name] = jiraUserMap[val];
                }
              }
              if (assigneesCol) {
                const val = row[assigneesCol.key] || row[assigneesCol.name];
                if (Array.isArray(val)) {
                  const names = val.map(id => jiraUserMap[id] || id).filter(Boolean);
                  const nameStr = names.join(', ');
                  row[assigneesCol.key] = nameStr;
                  row[assigneesCol.name] = nameStr;
                }
              }
            });
          }

          const targetColumns = formatColumns(connection, columns, { collaborators });
          const tagsColumn = targetColumns.find(c => c.name === CONNECTION_PREDEFINED_COLUMN_NAME.TAGS);
          if (tagsColumn) {
            context.setSetting('tagsColumnKey', tagsColumn.key);
          }
          const stateColumn = targetColumns.find(c => c.name === CONNECTION_PREDEFINED_COLUMN_NAME.STATE);
          if (stateColumn) {
            context.setSetting('stateColumnKey', stateColumn.key);
          }
          const typeColumn = targetColumns.find(c => c.name === CONNECTION_PREDEFINED_COLUMN_NAME.ISSUE_TYPE);
          if (typeColumn) {
            const options = typeColumn.data?.options || [];
            const _typesData = options.map(o => ({ ...o, _id: o.id }));
            setTypesData({
              rows: _typesData,
              id_row_map: _typesData.reduce((pre, cur) => {
                pre[cur._id] = cur;
                return pre;
              }, {})
            });
            context.setSetting('typeColumnKey', typeColumn.key);
          }
          const titleColumnIndex = targetColumns.findIndex(c => c.name === CONNECTION_PREDEFINED_COLUMN_NAME.TITLE);
          if (titleColumnIndex > -1) {
            targetColumns[titleColumnIndex].click = (row) => toggleChildrenPageSlugId(row._id);
          }

          return {
            data: {
              ...res?.data,
              rows,
              columns: targetColumns,
              linked_records,
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
    // Add modifyRow/modifyRows for all connection types that support editing
    if (SUPPORT_MODIFY_CONNECTION_RECORDS_TYPES.includes(connection.type)) {
      _api.modifyRow = (row_id, row_update, isCopyPaste, { data, typesData, tagsData } = {}) => {
        const rowData = convertRowToNameValue(row_update, { data, typesData, tagsData });
        const tableName = getTableNameByConnectionID(connectionID);
        let api = () => connectionsAPI.modifyConnectionRecord(projectUuid, connectionID, row_id, rowData);
        if (connection.type === CONNECTION_TYPE.GITHUB_ISSUE) {
          const githubOwnerAPIColumns = [
            CONNECTION_PREDEFINED_COLUMN_NAME.TITLE,
            CONNECTION_PREDEFINED_COLUMN_NAME.ISSUE_TYPE,
            CONNECTION_PREDEFINED_COLUMN_NAME.LABELS,
            CONNECTION_PREDEFINED_COLUMN_NAME.STATE,
            CONNECTION_PREDEFINED_COLUMN_NAME.STATE_REASON,
          ];
          let githubOwnerRowData = {};
          let otherRowData = {};
          let _api = () => new Promise((resolve, reject) => {
            resolve({ data: {} });
          });
          Object.keys(rowData).forEach(columnName => {
            if (githubOwnerAPIColumns.includes(columnName)) {
              githubOwnerRowData[columnName] = rowData[columnName];
            } else {
              otherRowData[columnName] = rowData[columnName];
            }
          });
          if (Object.keys(otherRowData).length > 0) {
            _api = () => connectionsAPI.modifyConnectionRecord(projectUuid, connectionID, row_id, otherRowData);
          }
          if (Object.keys(githubOwnerRowData).length > 0) {
            _api = () => connectionsAPI.modifyGithubIssue(projectUuid, connectionID, row_id, githubOwnerRowData).catch(error => {
              if (error?.response?.status === 404 && error?.response?.data?.error_msg === 'Installation_id is incorrect') {
                error.response.data.error_msg = 'The GitHub app is missing or has been uninstalled. Please reinstall it.';
              }
              throw error;
            });
          }
          api = _api;
        }

        return modifyRow(tableName, row_id, row_update, api);
      };
      _api.modifyRows = (rowsUpdate, isCopyPaste, { data, typesData, tagsData } = {}) => {
        const rowsData = convertRowsToNameValue(rowsUpdate, { data, typesData, tagsData });
        const tableName = getTableNameByConnectionID(connectionID);
        return modifyRows(tableName, rowsUpdate, () => connectionsAPI.modifyConnectionRecords(projectUuid, connectionID, rowsData));
      };
    }

    return _api;
  }, [
    projectUuid, connectionID, connection, getTableNameByConnectionID,
    getTableViews, getTableView, insertView, deleteView, modifyView, duplicateView, getMetadata,
    modifyRows, modifyRow, toggleChildrenPageSlugId,
  ]);

  const localStorageName = useMemo(() => `seaqa-${projectUuid}-connection-${connectionID}`, [projectUuid, connectionID]);

  const handleResolveIssueByAI = useCallback((attachments = []) => {
    if (!connectionID) return;
    handleResolveAttachmentsByAI(attachments);
  }, [connectionID, handleResolveAttachmentsByAI]);

  const handleFindRelatedIssues = useCallback((row) => {
    openRelatedIssues({ row, connection });
  }, [openRelatedIssues, connection]);

  const deleteEmailRows = useCallback((rows) => {
    if (!rows || rows.length === 0) return;
    const threadIds = rows.map(row => row._id);
    toaster.notify(gettext('It may take some time, please wait.'));
    return deleteRows(getTableName(connection), threadIds, () =>
      connectionsAPI.deleteConnectionEmail(projectUuid, connectionID, { thread_ids: threadIds })
    ).then(() => {
      context.eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.DELETE_ROWS, threadIds);
      context.eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.SELECT_NONE);
      const successMessage = rows.length === 1
        ? gettext('Email thread has been moved to trash.')
        : gettext('Email threads have been moved to trash.');
      toaster.closeAll();
      toaster.success(successMessage);
    }).catch(error => {
      toaster.danger(Utils.getErrorMsg(error));
    });
  }, [projectUuid, connectionID, connection, deleteRows]);

  const getMarkAsReadOption = useCallback((rows, modifyRows) => {
    if (connection?.type !== CONNECTION_TYPE.EMAIL) return null;
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const unreadColumn = getColumnByName(allColumns.current, CONNECTION_PREDEFINED_COLUMN_NAME.UNREAD);
    if (!unreadColumn) return null;
    const unreadRows = rows.filter(row => getCellValueByColumn(row, unreadColumn));
    return {
      key: 'mark_as_read',
      label: gettext('Mark as read'),
      callback: () => {
        if (!modifyRows) return;
        if (unreadRows.length === 0) {
          return;
        }
        const rowIds = [];
        const idRowUpdates = {};
        const idOldRowOldData = {};
        unreadRows.forEach(row => {
          const { _id } = row;
          rowIds.push(_id);
          idRowUpdates[_id] = { [unreadColumn.key]: false };
          idOldRowOldData[_id] = { [unreadColumn.key]: true };
        });
        modifyRows(rowIds, idRowUpdates, idOldRowOldData, false);
      },
    };
  }, [connection]);

  const createRowsTools = useCallback(({ rows, columns, modifyRows }) => {
    let children = [];
    if (rows.length === 1) {
      const row = rows[0];
      const markAsOutdatedOptions = generateMarkAsOutdatedOptions({ rows: [row], columns: allColumns.current, connection }, modifyRows);
      const linkTicketOptions = generateConnectionLinkTicketOptions({ row, columns, connection, permission });
      children = [
        generateAIOptions({ rows, columns, connection }, handleResolveIssueByAI),
        generateFindRelatedIssuesOption({ row, connection }, handleFindRelatedIssues),
        ...linkTicketOptions,
        { key: 'divider' },
        generateOpenOriginalPageOption({ row, columns: allColumns.current, connection }),
        generateCopyOriginalLinkOption({ row, columns: allColumns.current, connection }),
      ].filter(Boolean);
      children = children.reduce((acc, item, index, array) => {
        if (item && item.key === 'divider' && index > 0 && array[index - 1] && array[index - 1].key === 'divider') {
          return acc;
        }
        acc.push(item);
        return acc;
      }, []);
      if (children.length > 0) {
        if (children[0] && children[0].key === 'divider') {
          children.shift();
        }
        if (children.length > 0 && children[children.length - 1] && children[children.length - 1].key === 'divider') {
          children.pop();
        }
      }
      if (markAsOutdatedOptions.length > 0) {
        children.push({ key: 'divider' });
        children.push(...markAsOutdatedOptions);
      }
    } else if (rows.length > 1) {
      children = [
        generateAIOptions({ rows, columns, connection }, handleResolveIssueByAI),
      ];
      const markAsOutdatedOptions = generateMarkAsOutdatedOptions({ rows, columns: allColumns.current, connection }, modifyRows);
      if (markAsOutdatedOptions.length > 0) {
        children.push(...markAsOutdatedOptions);
      }
      const markAsReadOption = getMarkAsReadOption(rows, modifyRows);
      if (markAsReadOption) {
        children.push({ key: 'divider' });
        children.push(markAsReadOption);
      }
    }
    children = children.filter(Boolean);
    const tools = [];

    if (children.length > 0) {
      tools.push({
        key: 'more',
        icon: 'more',
        children,
      });
    }
    return tools;
  }, [
    connection, permission, handleResolveIssueByAI,
    handleFindRelatedIssues, getMarkAsReadOption, generateConnectionLinkTicketOptions
  ]);

  const createContextMenuOptions = useCallback(({
    isGroupView,
    selectedRange,
    selectedPosition,
    table,
    rowMetrics,
    rowGetterByIndex,
    updateLocalRow,
    modifyRows,
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
        const option = generateAIOptions({ rows, columns: table.columns, connection }, handleResolveIssueByAI);
        list.push(option);
        const markAsOutdatedOptions = generateMarkAsOutdatedOptions({ rows, columns: allColumns.current, connection }, modifyRows);
        if (markAsOutdatedOptions.length > 0) {
          list.push(...markAsOutdatedOptions);
        }
        if (connection?.type === CONNECTION_TYPE.EMAIL) {
          const markAsReadOption = getMarkAsReadOption(rows, modifyRows);
          if (markAsReadOption) {
            list.push('Divider');
            list.push(markAsReadOption);
          }
        }
      }
      return list.filter(Boolean);
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
        const option = generateAIOptions({ rows, columns: table.columns, connection }, handleResolveIssueByAI);
        list.push(option);
        const markAsOutdatedOptions = generateMarkAsOutdatedOptions({ rows, columns: allColumns.current, connection }, modifyRows);
        if (markAsOutdatedOptions.length > 0) {
          list.push(...markAsOutdatedOptions);
        }
        if (connection?.type === CONNECTION_TYPE.EMAIL) {
          const markAsReadOption = getMarkAsReadOption(rows, modifyRows);
          if (markAsReadOption) {
            list.push('Divider');
            list.push(markAsReadOption);
          }
          list.push('Divider');
          list.push({
            key: 'delete_emails',
            label: gettext('Delete emails'),
            callback: () => deleteEmailRows(rows),
          });
        }
      }
      return list.filter(Boolean);
    }

    // handle selected cell
    if (!selectedPosition) return [];
    const { groupRowIndex, rowIdx: rowIndex } = selectedPosition;
    const row = rowGetterByIndex({ isGroupView, groupRowIndex, rowIndex }) || table.id_row_map[selectedRowIds[0]];
    if (!row) return [];
    const linkTicketOptions = generateConnectionLinkTicketOptions({ row, columns: table.columns, connection, permission });
    list = [
      generateAIOptions({ rows: [row], columns: table.columns, connection }, handleResolveIssueByAI),
      generateFindRelatedIssuesOption({ row, connection }, handleFindRelatedIssues),
      ...linkTicketOptions,
      'Divider',
      generateOpenOriginalPageOption({ row, columns: allColumns.current, connection }),
      generateCopyOriginalLinkOption({ row, columns: allColumns.current, connection }),
    ];
    if (connection?.type === CONNECTION_TYPE.EMAIL) {
      const markAsReadOption = getMarkAsReadOption([row], modifyRows);
      if (markAsReadOption) {
        list.push('Divider');
        list.push(markAsReadOption);
      }
      list.push('Divider');
      list.push({
        key: 'delete_email',
        label: gettext('Delete email'),
        callback: () => deleteEmailRows([row]),
      });
    }
    const markAsOutdatedOptions = generateMarkAsOutdatedOptions({ rows: [row], columns: allColumns.current, connection }, modifyRows);
    if (markAsOutdatedOptions.length > 0) {
      list.push('Divider');
      list.push(...markAsOutdatedOptions);
    }

    return normalizeContextMenuOptions(list);
  }, [
    connection, handleResolveIssueByAI, deleteEmailRows, permission,
    handleFindRelatedIssues, getMarkAsReadOption, generateConnectionLinkTicketOptions,
  ]);

  const handleExpandRow = useCallback((row) => {
    setCurrentRow({ ...row, connection_id: connection.id, type: connection.type });
    setIsShowRowDetailsDialog(true);
  }, [connection]);

  const createMoreOptions = useCallback((row, _details, options) => {
    return seaMetaDataRef.current?.createMoreOptions(row, options) || [];
  }, []);

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

  const closeAll = useCallback(() => {
    setIsShowRowDetailsDialog(false);
    setCurrentRow({});
  }, []);

  useEffect(() => {
    const applyRecordsModify = (_updates, isNeedConvertKeyValue = true) => {
      let idRecordUpdates = isNeedConvertKeyValue ? {} : _updates;
      isNeedConvertKeyValue && Object.keys(_updates).forEach(recordId => {
        const record = _updates[recordId];
        idRecordUpdates[recordId] = convertRowToKeyValue(record, { data: { columns: allColumns.current } });
      });
      context.eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.LOCAL_ROWS_CHANGED, idRecordUpdates);
    };
    const unsubscribe = eventBus.subscribe(EVENT_BUS_TYPE.MODIFY_LOCAL_RECORDS, applyRecordsModify);
    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <>
      <SeaMetadata
        metadataID={connectionID}
        api={api}
        ref={seaMetaDataRef}
        className="seaqa-connection-details-metadata"
        localStorageNamePrefix={localStorageName}
        createRowsTools={createRowsTools}
        createContextMenuOptions={createContextMenuOptions}
        permission={permission}
        columnWidthRules={CONNECTION_COLUMNS_WIDTH_CONFIG}
        columnOrderRules={CONNECTION_COLUMNS_ORDER_CONFIG[connection?.type]}
        typesData={typesData}
        tagsData={tagsData}
        customersData={customersData}
        createTag={createTag}
        expandRow={handleExpandRow}
        cascadeUpdateCells={connection?.type === CONNECTION_TYPE.GITHUB_ISSUE ? cascadeUpdate : () => {}}
        t={t}
        notDisplayColumns={[
          CONNECTION_PREDEFINED_COLUMN_NAME.OUTDATED,
          CONNECTION_PREDEFINED_COLUMN_NAME.IDENTIFIER,
        ]}
        generatorRowClassName={(row) => generatorRowClassName(row, allColumns.current)}
        settings={{ canClearCells: false, canPasteCells: false, canDragFillCells: false }}
        fixedColumnCount={connection?.type === CONNECTION_TYPE.EMAIL ? 3 : 1}
      />
      {isShowRowDetailsDialog && (
        <ResourceDetailsDialog
          projectUuid={projectUuid}
          permission={permission}
          resource={currentRow}
          columns={allColumns.current}
          switchResource={switchResource}
          onToggle={closeAll}
          createMoreOptions={createMoreOptions}
        />
      )}
    </>
  );

};

export default Records;
