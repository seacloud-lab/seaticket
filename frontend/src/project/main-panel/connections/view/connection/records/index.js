import React, { useMemo, useCallback, useState, useRef } from 'react';
import copy from 'copy-to-clipboard';
import SeaMetadata from '@/sea-metadata';
import ResourceDetailsDialog from '@/project/components/resource-details-dialog';
import { connectionsAPI } from '@/project/api';
import CreateTicketDialog from '../../../components/create-ticket-dialog';
import RelatedIssuesDialog from '../../../components/related-issues-dialog';
import { useConnectionsPage } from '../../../hooks';
import { gettext } from '@/constants';
import { BAR_TYPE } from '@/project/constants';
import { useAIChatTools } from '@/project/main-panel/ask/hooks';
import {
  CONNECTION_TYPE, GITHUB_STATE_REASON_NAME_MAP, GITHUB_STATE_OPTION_NAME_MAP, CONNECTION_PREDEFINED_COLUMN_CONFIG,
  SUPPORT_CREATE_RELATED_TICKET_CONNECTION_TYPES, CONNECTION_PREDEFINED_COLUMN_NAME,
  SUPPORT_AI_CONNECTION_TYPES, SUPPORT_FIND_RELATED_ISSUES_CONNECTION_TYPES,
  SUPPORT_MARK_OUTDATED_CONNECTION_TYPES,
  GENERAL_TASK_STATUS_NAME_MAP,
  GENERAL_TASK_PRIORITY_NAME_MAP,
  GENERAL_TASK_SIZE_NAME_MAP,
} from '../../../constants';
import { toaster } from '@/components';
import context from '@/sea-metadata/context';
import { useConnections } from '../../../hooks';
import { getOriginalPageUrl, getTableName, generatorRowClassName } from '../../../utils';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { AttachmentObject } from '@/project/main-panel/ask/models';
import { convertRowToNameValue, convertRowsToNameValue } from '@/sea-metadata/utils/row';
import { useData, useTags } from '@/project/hooks';

import './index.css';

const Records = ({ projectUuid, permission, connectionID, toggleBar, onRefresh }) => {
  const seaMetaDataRef = useRef(null);
  const allColumns = useRef([]);

  const [currentRow, setCurrentRow] = useState({});
  const [typesData, setTypesData] = useState(null);
  const [isTicketDialogOpen, setTicketDialogOpen] = useState(false);
  const [isShowRowDetailsDialog, setIsShowRowDetailsDialog] = useState(false);
  const [isShowRelatedIssuesDialog, setIsShowRelatedIssuesDialog] = useState(false);
  const [isDeletingRecords, setIsDeletingRecords] = useState(false);

  const { updateAttachments } = useAIChatTools();
  const { viewID, toggleView, toggleChildrenPageSlugId } = useConnectionsPage();
  const { connections } = useConnections();
  const {
    data,
    getTableViews, getTableView, insertView, deleteView, modifyView, moveView, duplicateView,
    getMetadata, modifyRow, modifyRows, deleteRows
  } = useData();
  const { tagsData, createTag } = useTags();

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
          if (type === CONNECTION_TYPE.GENERAL_TASK) {
            const statusColumnIndex = columns.findIndex(c => c.name === CONNECTION_PREDEFINED_COLUMN_NAME.STATUS);
            if (statusColumnIndex > -1) {
              const statusColumn = columns[statusColumnIndex];
              let options = statusColumn.data?.options || [];
              options = options.map(o => ({ ...o, display_name: GENERAL_TASK_STATUS_NAME_MAP[o.name] || o.name }));
              columns[statusColumnIndex].data = { ...statusColumn.data, options };
            }

            const priorityColumnIndex = columns.findIndex(c => c.name === CONNECTION_PREDEFINED_COLUMN_NAME.PRIORITY);
            if (priorityColumnIndex > -1) {
              const priorityColumn = columns[priorityColumnIndex];
              let options = priorityColumn.data?.options || [];
              options = options.map(o => ({ ...o, display_name: GENERAL_TASK_PRIORITY_NAME_MAP[o.name] || o.name }));
              columns[priorityColumnIndex].data = { ...priorityColumn.data, options };
            }

            const sizeColumnIndex = columns.findIndex(c => c.name === CONNECTION_PREDEFINED_COLUMN_NAME.SIZE);
            if (sizeColumnIndex > -1) {
              const sizeColumn = columns[sizeColumnIndex];
              let options = sizeColumn.data?.options || [];
              options = options.map(o => ({ ...o, display_name: GENERAL_TASK_SIZE_NAME_MAP[o.name] || o.name }));
              columns[sizeColumnIndex].data = { ...sizeColumn.data, options };
            }
          }
          columnConfig[CONNECTION_PREDEFINED_COLUMN_NAME.TITLE] = {
            ...columnConfig[CONNECTION_PREDEFINED_COLUMN_NAME.TITLE],
            click: (row) => toggleChildrenPageSlugId(row._id),
          };
          columns = columns.filter(c => !notDisplayColumnNames.includes(c.name)).map(c => ({ ...c, ...columnConfig[c.name] }));
          const tagsColumn = columns.find(c => c.name === CONNECTION_PREDEFINED_COLUMN_NAME.TAGS);
          if (tagsColumn) {
            context.setSetting('tagsColumnKey', tagsColumn.key);
          }
          return {
            data: {
              rows,
              columns: columns,
              linked_records,
              error_msg: res?.data?.error_msg,
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
    // Add modifyRow/modifyRows for all connection types that support outdated editing
    if (SUPPORT_MARK_OUTDATED_CONNECTION_TYPES.includes(connection.type)) {
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
    modifyRows, modifyRow, toggleChildrenPageSlugId,
  ]);

  const handleCreateRelatedTicket = useCallback((row) => {
    if (!row) return;
    setCurrentRow(row);
    setTicketDialogOpen(true);
  }, []);

  const handleResolveIssueByAI = useCallback((issues = []) => {
    if (!Array.isArray(issues) || issues.length === 0 || !connectionID) return;
    updateAttachments(issues);
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

  const generateMarkAsOutdatedOptions = useCallback(({ rows, modifyRows }) => {
    const enableMarkAsOutdated = SUPPORT_MARK_OUTDATED_CONNECTION_TYPES.includes(connection?.type);
    if (!enableMarkAsOutdated) return [];
    const rowList = Array.isArray(rows) ? rows : [rows];
    if (rowList.length === 0) return [];
    const outdatedColumn = getColumnByName(allColumns.current, CONNECTION_PREDEFINED_COLUMN_NAME.OUTDATED);
    if (!outdatedColumn) return [];
    let activeRows = [];
    let outdatedRows = [];
    rows.forEach(row => {
      const oldValue = row[outdatedColumn.key];
      if (oldValue) {
        outdatedRows.push(row);
      } else {
        activeRows.push(row);
      }
    });
    let options = [];
    if (outdatedRows.length > 0) {
      options.push({
        key: 'mark_as_active',
        label: gettext('Mark as active'),
        callback: () => {
          let rowIds = [];
          let idRowUpdates = {};
          let idOldRowOldData = {};
          outdatedRows.forEach(row => {
            const { _id } = row;
            rowIds.push(_id);
            idRowUpdates[_id] = { [outdatedColumn.key]: false };
            idOldRowOldData[_id] = { [outdatedColumn.key]: true };
          });
          modifyRows && modifyRows(rowIds, idRowUpdates, idOldRowOldData, false);
        },
      });
    }
    if (activeRows.length > 0) {
      options.push({
        key: 'mark_as_outdated',
        label: gettext('Mark as outdated'),
        callback: () => {
          let rowIds = [];
          let idRowUpdates = {};
          let idOldRowOldData = {};
          activeRows.forEach(row => {
            const { _id } = row;
            const oldValue = row[outdatedColumn.key];
            rowIds.push(_id);
            idRowUpdates[_id] = { [outdatedColumn.key]: true };
            idOldRowOldData[_id] = { [outdatedColumn.key]: oldValue };
          });
          modifyRows && modifyRows(rowIds, idRowUpdates, idOldRowOldData, false);
        },
      });
    }
    return options.length > 0 ? options : [];
  }, [connection]);

  const generateAIOptions = useCallback(({ rows }) => {
    const enableUseAI = SUPPORT_AI_CONNECTION_TYPES.includes(connection?.type);
    if (!enableUseAI) return null;

    if (connection?.type === CONNECTION_TYPE.GITHUB_ISSUE || connection?.type === CONNECTION_TYPE.DISCOURSE_FORUM || connection?.type === CONNECTION_TYPE.EMAIL) {
      return {
        key: 'chat_issues',
        label: rows.length === 1 ? gettext('Chat issue') : gettext('Chat issues'),
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
      };
    }

    return null;
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

  const generateCopyOriginalLinkOption = useCallback(({ row }) => {
    const url = getOriginalPageUrl(connection, row, allColumns.current);
    if (!url) return null;
    return {
      label: gettext('Copy original link'),
      key: 'copy_original_link',
      callback: () => {
        copy(url);
        toaster.success(gettext('The original link has been copied'));
      },
    };
  }, [connection]);

  const createRowsTools = useCallback(({ rows, columns, modifyRows }) => {
    let children = [];
    if (rows.length === 1) {
      const row = rows[0];
      const markAsOutdatedOptions = generateMarkAsOutdatedOptions({ rows: [row], modifyRows });
      children = [
        generateAIOptions({ rows, columns }),
        generateFindRelatedIssuesOption({ row }),
        generateCreateRelatedTicketOption({ row }),
        { key: 'divider' },
        generateOpenOriginalPageOption({ row }),
        generateCopyOriginalLinkOption({ row }),
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
        generateAIOptions({ rows, columns }),
      ];
      const markAsOutdatedOptions = generateMarkAsOutdatedOptions({ rows, modifyRows });
      if (markAsOutdatedOptions.length > 0) {
        children.push(...markAsOutdatedOptions);
      }
    }
    children = children.filter(Boolean);
    const tools = [];

    // if (connection.type === CONNECTION_TYPE.EMAIL && rows.length > 0) {
    //   tools.push({
    //     key: 'delete',
    //     icon: 'delete',
    //     callback: () => handleDeleteRecords(rows, deleteLocalRows),
    //     disabled: isDeletingRecords,
    //   });
    // }

    if (children.length > 0) {
      tools.push({
        key: 'more',
        icon: 'more',
        children,
      });
    }
    return tools;
  }, [
    connection, generateOpenOriginalPageOption, generateCreateRelatedTicketOption, generateFindRelatedIssuesOption,
    generateAIOptions, handleDeleteRecords, isDeletingRecords, generateMarkAsOutdatedOptions, generateCopyOriginalLinkOption,
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
        list.push(generateAIOptions({ rows, columns: table.columns }));
        const markAsOutdatedOptions = generateMarkAsOutdatedOptions({ rows, modifyRows });
        if (markAsOutdatedOptions.length > 0) {
          list.push(...markAsOutdatedOptions);
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
        list.push(generateAIOptions({ rows, columns: table.columns }));
        const markAsOutdatedOptions = generateMarkAsOutdatedOptions({ rows, modifyRows });
        if (markAsOutdatedOptions.length > 0) {
          list.push(...markAsOutdatedOptions);
        }
      }
      return list.filter(Boolean);
    }

    // handle selected cell
    if (!selectedPosition) return [];
    const { groupRowIndex, rowIdx: rowIndex } = selectedPosition;
    const row = rowGetterByIndex({ isGroupView, groupRowIndex, rowIndex }) || table.id_row_map[selectedRowIds[0]];
    if (!row) return [];
    list = [
      generateAIOptions({ rows: [row], columns: table.columns }),
      generateFindRelatedIssuesOption({ row }),
      generateCreateRelatedTicketOption({ row }),
      'Divider',
      generateOpenOriginalPageOption({ row }),
      generateCopyOriginalLinkOption({ row }),
    ].filter(Boolean);
    list = list.reduce((acc, item, index, array) => {
      if (item === 'Divider' && index > 0 && array[index - 1] === 'Divider') {
        return acc;
      }
      acc.push(item);
      return acc;
    }, []);
    if (list.length > 0) {
      if (list[0] === 'Divider') {
        list.shift();
      }
      if (list.length > 0 && list[list.length - 1] === 'Divider') {
        list.pop();
      }
    }

    const markAsOutdatedOptions = generateMarkAsOutdatedOptions({ rows: [row], modifyRows });
    if (markAsOutdatedOptions.length > 0) {
      list.push('Divider');
      list.push(...markAsOutdatedOptions);
    }

    return list.filter(Boolean);
  }, [
    connection, generateOpenOriginalPageOption, generateCreateRelatedTicketOption, generateFindRelatedIssuesOption,
    generateMarkAsOutdatedOptions, generateAIOptions, generateCopyOriginalLinkOption,
  ]);

  const modifyRowsByDetailsMenu = useCallback((rowIds, idRowUpdates, idOldRowOldData, isCopyPaste = false) => {
    if (!api?.modifyRow) return;
    if (!Array.isArray(rowIds) || rowIds.length === 0) return;
    const modifyPromises = rowIds.map((rowId) => {
      const rowUpdate = idRowUpdates?.[rowId] || {};
      return api.modifyRow(rowId, rowUpdate, isCopyPaste, { data: { columns: allColumns.current }, typesData, tagsData });
    });
    return Promise.all(modifyPromises).then(() => {
      setIsShowRowDetailsDialog(false);
      onRefresh();
    });
  }, [api, data, onRefresh]);

  const createMoreOptions = useCallback((row) => {
    if (!row?._id) return [];
    return createContextMenuOptions({
      isGroupView: false,
      selectedPosition: { groupRowIndex: 0, rowIdx: 0 },
      table: { id_row_map: { [row._id]: row }, columns: allColumns.current },
      rowMetrics: { idSelectedRowMap: {} },
      rowGetterByIndex: () => row,
      modifyRows: modifyRowsByDetailsMenu,
    });
  }, [createContextMenuOptions, modifyRowsByDetailsMenu]);

  const localStorageName = useMemo(() => `sea-qa-${projectUuid}-connection-${connectionID}`, [projectUuid, connectionID]);

  const handleExpandRow = useCallback((row) => {
    setCurrentRow({ ...row, connection_id: connection.id, type: connection.type });
    setIsShowRowDetailsDialog(true);
  }, [connection]);

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
    setTicketDialogOpen(false);
    setIsShowRelatedIssuesDialog(false);
    setCurrentRow({});
  }, []);

  return (
    <>
      <SeaMetadata
        metadataID={connectionID}
        viewID={viewID}
        api={api}
        ref={seaMetaDataRef}
        className="sea-qa-connection-details-metadata"
        localStorageNamePrefix={localStorageName}
        createRowsTools={createRowsTools}
        createContextMenuOptions={createContextMenuOptions}
        permission={permission}
        typesData={typesData}
        tagsData={tagsData}
        createTag={createTag}
        toggleView={toggleView}
        expandRow={handleExpandRow}
        t={t}
        notDisplayColumns={[CONNECTION_PREDEFINED_COLUMN_NAME.OUTDATED]}
        generatorRowClassName={(row) => generatorRowClassName(row, allColumns.current)}
      />
      {isShowRowDetailsDialog && (
        <ResourceDetailsDialog
          projectUuid={projectUuid}
          resource={currentRow}
          columns={allColumns.current}
          switchResource={switchResource}
          onToggle={closeAll}
          createMoreOptions={createMoreOptions}
        />
      )}
      {isTicketDialogOpen && (
        <CreateTicketDialog
          projectUuid={projectUuid}
          row={currentRow}
          connection={connection}
          columns={allColumns.current}
          onClose={closeAll}
        />
      )}
      {isShowRelatedIssuesDialog && (
        <RelatedIssuesDialog
          projectUuid={projectUuid}
          row={currentRow}
          connectionId={connectionID}
          onClose={closeAll}
          onRowClick={handleCreateRelatedTicket}
        />
      )}
    </>
  );

};

export default Records;
