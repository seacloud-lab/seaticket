import React, { useMemo, useCallback, useState, useRef } from 'react';
import SeaMetadata from '@/sea-metadata';
import ResourceDetailsDialog from '@/project/components/resource-details-dialog';
import { connectionsAPI } from '@/project/api';
import CreateTicketDialog from '../../../components/create-ticket-dialog';
import RelatedIssuesDialog from '../../../components/related-issues-dialog';
import { useConnectionsPage, useConnections } from '../../../hooks';
import { gettext } from '@/constants';
import { BAR_TYPE } from '@/project/constants';
import { useAIChatTools } from '@/project/main-panel/ask/hooks';
import {
  CONNECTION_TYPE, GITHUB_STATE_REASON_NAME_MAP, GITHUB_STATE_OPTION_NAME_MAP, CONNECTION_PREDEFINED_COLUMN_CONFIG,
  CONNECTION_PREDEFINED_COLUMN_NAME, SUPPORT_MARK_OUTDATED_CONNECTION_TYPES, CONNECTION_COLUMNS_WIDTH_CONFIG,
} from '../../../constants';
import { toaster } from '@/components';
import context from '@/sea-metadata/context';
import {
  getTableName, generatorRowClassName, cascadeUpdate,
  generateAIOptions, generateMarkAsOutdatedOptions, generateFindRelatedIssuesOption,
  generateLinkAnExistingTicketOption, generateCreateRelatedTicketOption,
  generateOpenOriginalPageOption, generateCopyOriginalLinkOption,
} from '../../../utils';
import { getColumnByName, getColumnOptions, getOption } from '@/sea-metadata/utils/column';
import { AttachmentObject } from '@/project/main-panel/ask/models';
import { convertRowToNameValue, convertRowsToNameValue } from '@/sea-metadata/utils/row';
import { useData, useTags, useMetadata } from '@/project/hooks';
import TicketsDialog from '@/project/main-panel/tickets/components/tickets-dialog';
import { EVENT_BUS_TYPE as SEA_METADATA_EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import { Utils } from '@/utils/utils';
import { TICKET_TABLE_NAME } from '@/project/main-panel/tickets/constants';
import { normalizeContextMenuOptions } from '@/project/utils';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';

import './index.css';

const Records = ({ projectUuid, permission, connectionID, toggleBar }) => {
  const seaMetaDataRef = useRef(null);
  const allColumns = useRef([]);

  const [currentRow, setCurrentRow] = useState({});
  const [typesData, setTypesData] = useState(null);
  const [isTicketDialogOpen, setTicketDialogOpen] = useState(false);
  const [isShowRowDetailsDialog, setIsShowRowDetailsDialog] = useState(false);
  const [isShowRelatedIssuesDialog, setIsShowRelatedIssuesDialog] = useState(false);
  const [isDeletingRecords, setIsDeletingRecords] = useState(false);
  const [isShowTicketsDialog, setIsShowTicketsDialog] = useState(false);

  const { updateAttachments } = useAIChatTools();
  const { toggleChildrenPageSlugId } = useConnectionsPage();
  const { connections } = useConnections();
  const {
    data,
    getTableViews, getTableView, insertView, deleteView, modifyView, moveView, duplicateView,
    getMetadata, modifyRow, modifyRows, deleteRows, modifyRowLink, insertRowByLink,
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
            CONNECTION_PREDEFINED_COLUMN_NAME.PAGE_ID,
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
            let stateColumn;
            if (stateColumnIndex > -1) {
              stateColumn = columns[stateColumnIndex];
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
              const stateOptions = getColumnOptions(stateColumn);
              const openStateOption = getOption(stateOptions, 'open');
              const closeStateOption = getOption(stateOptions, 'closed');

              columns[stateReasonColumnIndex].data = {
                cascade_column_key: stateColumn.key,
                cascade_settings: {
                  [openStateOption?.id]: options.slice(3).map(o => o.id),
                  [closeStateOption?.id]: options.slice(0, 3).map(o => o.id),
                },
                ...stateReasonColumn.data,
                options,
              };
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
              ...res?.data,
              rows,
              columns: columns,
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
    // Add modifyRow/modifyRows for all connection types that support outdated editing
    if (SUPPORT_MARK_OUTDATED_CONNECTION_TYPES.includes(connection.type)) {
      if (connection.type === CONNECTION_TYPE.GENERAL_TASK) {
        _api.insertRow = (rowData = {}) => {
          return connectionsAPI.createConnectionRecord(projectUuid, connectionID, rowData).then(res => res.data.row);
        };
      }
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
            _api = () => connectionsAPI.modifyGithubIssue(projectUuid, connectionID, row_id, githubOwnerRowData);
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
    projectUuid, connectionID, connection, connections, getTableNameByConnectionID,
    data, getTableViews, getTableView, insertView, deleteView, modifyView, moveView, duplicateView, getMetadata,
    modifyRows, modifyRow, toggleChildrenPageSlugId,
  ]);

  const handleCreateRelatedTicket = useCallback((row) => {
    if (!row) return;
    setCurrentRow(row);
    setTicketDialogOpen(true);
  }, []);

  const handleLinkAnExistingTicket = useCallback((row) => {
    if (!row) return;
    setCurrentRow(row);
    setIsShowTicketsDialog(true);
  }, []);

  const handleResolveIssueByAI = useCallback((attachments = []) => {
    if (!Array.isArray(attachments) || attachments.length === 0 || !connectionID) return;
    const newAttachments = attachments.map(attachment => new AttachmentObject(attachment));
    updateAttachments(newAttachments);
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

  const createRowsTools = useCallback(({ rows, columns, modifyRows }) => {
    let children = [];
    if (rows.length === 1) {
      const row = rows[0];
      const markAsOutdatedOptions = generateMarkAsOutdatedOptions({ rows: [row], columns: allColumns.current, connection }, modifyRows);
      children = [
        generateAIOptions({ rows, columns, connection }, handleResolveIssueByAI),
        generateFindRelatedIssuesOption({ row, connection }, handleFindRelatedIssues),
        generateCreateRelatedTicketOption({ row, columns, connection }, handleCreateRelatedTicket),
        generateLinkAnExistingTicketOption({ row, columns, connection }, handleLinkAnExistingTicket),
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
    connection, handleCreateRelatedTicket, handleDeleteRecords, isDeletingRecords,
    handleResolveIssueByAI, handleLinkAnExistingTicket,
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
      }
      return list.filter(Boolean);
    }

    // handle selected cell
    if (!selectedPosition) return [];
    const { groupRowIndex, rowIdx: rowIndex } = selectedPosition;
    const row = rowGetterByIndex({ isGroupView, groupRowIndex, rowIndex }) || table.id_row_map[selectedRowIds[0]];
    if (!row) return [];
    list = [
      generateAIOptions({ rows: [row], columns: table.columns, connection }, handleResolveIssueByAI),
      generateFindRelatedIssuesOption({ row, connection }, handleFindRelatedIssues),
      generateCreateRelatedTicketOption({ row, columns: table.columns, connection }, handleCreateRelatedTicket),
      generateLinkAnExistingTicketOption({ row, columns: table.columns, connection }, handleLinkAnExistingTicket),
      'Divider',
      generateOpenOriginalPageOption({ row, columns: allColumns.current, connection }),
      generateCopyOriginalLinkOption({ row, columns: allColumns.current, connection }),
    ];
    const markAsOutdatedOptions = generateMarkAsOutdatedOptions({ rows: [row], columns: allColumns.current, connection }, modifyRows);
    if (markAsOutdatedOptions.length > 0) {
      list.push('Divider');
      list.push(...markAsOutdatedOptions);
    }

    return normalizeContextMenuOptions(list);
  }, [connection, handleResolveIssueByAI, handleCreateRelatedTicket, handleLinkAnExistingTicket]);

  const modifyRowsByDetailsMenu = useCallback((rowIds, idRowUpdates, idOldRowOldData, isCopyPaste = false) => {
    if (!api?.modifyRow) return;
    if (!Array.isArray(rowIds) || rowIds.length === 0) return;
    const modifyPromises = rowIds.map((rowId) => {
      const rowUpdate = idRowUpdates?.[rowId] || {};
      return api.modifyRow(rowId, rowUpdate, isCopyPaste, { data: { columns: allColumns.current }, typesData, tagsData });
    });
    return Promise.all(modifyPromises).then(() => {
      setIsShowRowDetailsDialog(false);
      const eventBus = context.eventBus;
      eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.LOCAL_ROWS_CHANGED, idRowUpdates);
    });
  }, [api, typesData, tagsData]);

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

  const localStorageName = useMemo(() => `seaqa-${projectUuid}-connection-${connectionID}`, [projectUuid, connectionID]);

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

  const linkAnExistingTicket = useCallback((ticket, linkedConnectionRecordsColumn, callback) => {
    const linkedTicketColumn = getColumnByName(allColumns.current, CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET);
    const rowUpdate = { [linkedTicketColumn.key]: ticket.id };
    const rowId = currentRow._id;
    const connectionLinkedUpdate = {
      [ticket.id]: ticket.title,
    };
    const titleColumn = getColumnByName(allColumns.current, CONNECTION_PREDEFINED_COLUMN_NAME.TITLE);
    modifyRowLink({
      tableName: TICKET_TABLE_NAME,
      rowId: String(ticket.id),
      rowUpdate: { [linkedConnectionRecordsColumn.key]: [`${connectionID}_${rowId}`] },
      linkedRecords: { [`${connectionID}_${rowId}`]: getCellValueByColumn(currentRow, titleColumn) }
    }, {
      tableName: getTableNameByConnectionID(connectionID),
      rowId: rowId,
      rowUpdate: rowUpdate,
      linkedRecords: connectionLinkedUpdate
    }, () => {
      return connectionsAPI.modifyConnectionRecord(projectUuid, connectionID, rowId, { [linkedTicketColumn.name]: ticket.id }).then(res => {
        const eventBus = context.eventBus;
        eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, rowId, rowUpdate);
        eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.UPDATE_DATA_ATTRIBUTE, { linked_records: connectionLinkedUpdate }, false);
        callback && callback();
      }).catch(error => {
        const errorMessage = Utils.getErrorMsg(error);
        toaster.danger(errorMessage);
        callback && callback(true);
      });
    });
  }, [currentRow, getTableNameByConnectionID, connectionID, modifyRowLink]);

  const createTicketCallback = useCallback((ticket, currentRow) => {
    const tableName = getTableNameByConnectionID(connectionID);
    const linkedUpdateRecord = {
      [ticket._pk]: ticket.title,
    };
    const linkColumn = getColumnByName(allColumns.current, CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET);
    const rowUpdateData = { [linkColumn.key]: [ticket._pk] };
    insertRowByLink(TICKET_TABLE_NAME, tableName, linkedUpdateRecord, currentRow._id, rowUpdateData, () => {
      const eventBus = context.eventBus;
      eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, currentRow._id, rowUpdateData);
      eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.UPDATE_DATA_ATTRIBUTE, { linked_records: linkedUpdateRecord }, false);
    });
  }, [getTableNameByConnectionID, connectionID]);

  const closeAll = useCallback(() => {
    setIsShowRowDetailsDialog(false);
    setTicketDialogOpen(false);
    setIsShowRelatedIssuesDialog(false);
    setIsShowTicketsDialog(false);
    setCurrentRow({});
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
        typesData={typesData}
        tagsData={tagsData}
        createTag={createTag}
        expandRow={handleExpandRow}
        cascadeUpdateCells={connection?.type === CONNECTION_TYPE.GITHUB_ISSUE ? cascadeUpdate : () => {}}
        t={t}
        notDisplayColumns={[CONNECTION_PREDEFINED_COLUMN_NAME.OUTDATED]}
        generatorRowClassName={(row) => generatorRowClassName(row, allColumns.current)}
        settings={{ canClearCells: false, canPasteCells: false, canDragFillCells: false }}
      />
      {isShowRowDetailsDialog && (
        <ResourceDetailsDialog
          projectUuid={projectUuid}
          resource={currentRow}
          columns={allColumns.current}
          permission={permission}
          switchResource={switchResource}
          onToggle={closeAll}
          createMoreOptions={createMoreOptions}
        />
      )}
      {isTicketDialogOpen && (
        <CreateTicketDialog
          projectUuid={projectUuid}
          row={currentRow}
          linkedRecordPrefix={connection.id}
          useMetadataContext={useMetadata}
          onClose={closeAll}
          convertToTicket={() => connectionsAPI.convertRecordToTicket(projectUuid, connection.id, currentRow._id)}
          onSubmitCallback={(ticket) => createTicketCallback(ticket, currentRow)}
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
      {isShowTicketsDialog && (
        <TicketsDialog
          projectUuid={projectUuid}
          onSubmit={linkAnExistingTicket}
          onToggle={closeAll}
        />
      )}
    </>
  );

};

export default Records;
