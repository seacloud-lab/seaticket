import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ticketsAPI } from '../../../api';
import SeaMetadata from '@/sea-metadata';
import { useMetadata } from '../hooks';
import {
  TICKET_PAGE_SLUG_ID, TICKET_PREDEFINED_COLUMN_CONFIG,
  TICKET_NOT_DISPLAY_COLUMNS, PREDEFINED_TICKET_COLUMN_NAME,
  TICKET_COLUMNS_ORDER_CONFIG, TICKET_COLUMNS_WIDTH_CONFIG,
  TICKET_TABLE_NAME, TICKET_TYPE, AUTO_UPDATE_PARTICIPANTS_KEY,
} from '../constants';
import { BAR_TYPE, EVENT_BUS_TYPE as GLOBAL_EVENT_BUS_TYPE } from '@/project/constants';
import { gettext } from '@/constants';
import { CenteredLoading } from '@/components';
import context from '@/sea-metadata/context';
import toaster from '@/components/toaster';
import {
  generatorTicketsRowsTools, isOpenLinkedGithubIssuesWarning,
  cascadeUpdate, generatorTicketsContextMenuOptions,
  convertTicketToTask, convertTicketToKb,
} from '../utils';
import { convertRowToNameValue, convertRowsToNameValue } from '@/sea-metadata/utils/row';
import { useAIChatTools } from '@/project/main-panel/ask/hooks';
import RelatedIssuesDialog from './related-issues-dialog';
import CreateKBRecordDialog from './create-kb-record-dialog';
import CreateTaskDialog from './create-task-dialog';
import { isFunction } from '@/utils/type-detection';
import { useData, useTags } from '@/project/hooks';
import ResourceDetailsDialog from '@/project/components/resource-details-dialog';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import { useConnections } from '@/project/main-panel/connections/hooks';
import { getTableName } from '@/project/main-panel/connections/utils';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import eventBus from '@/utils/event-bus';
import CloseLinkedGitHubIssuesWarningDialog from './close-linked-github-issues-warning-dialog';

const Tickets = ({
  canFindRelatedIssues = true, isBuiltInView = false,
  projectUuid, workspaceID, projectName, permission,
  toggleBar = () => {},
  api,
  localStorageNamePrefix: customizeLocalStorageNamePrefix,
  createContextMenuOptions: customizeCreateContextMenuOptions,
  createRowsTools: customizeCreateRowsTools,
  togglePageSlugId = () => {},
  isLoading = false,
  isShowViewInURL = true,
  settings = {},
  getTicket,
  onRefresh,
  ...props
}) => {
  const { updateAttachments } = useAIChatTools();
  const {
    typesData, createType,
    substatesData, createSubstate,
  } = useMetadata();
  const { connections } = useConnections();
  const { tagsData, createTag } = useTags();
  const {
    getTableViews, getTableView, insertView, deleteView, modifyView, moveView, duplicateView,
    getMetadata, modifyRow, modifyRows, deleteRow, deleteRows, insertRowByLink, modifyLocalGitHubIssuesClosed,
  } = useData();

  const metadataRef = useRef(null);
  const allColumns = useRef([]);
  const closeLinkedGitHubIssuesWarning = useRef(null);

  const [isShowRelatedIssuesDialog, setIsShowRelatedIssuesDialog] = useState(false);
  const [currentTicket, setCurrentTicket] = useState(null);
  const [isShowTicketDetailsDialog, setIsShowTicketDetailsDialog] = useState(false);
  const [isShowCreateKBRecordDialog, setIsShowCreateKBRecordDialog] = useState(false);
  const [isShowCreateTaskDialog, setIsShowCreateTaskDialog] = useState(false);
  const [isShowCloseGitHubIssuesWarningDialog, setIsShowCloseGitHubIssuesWarningDialog] = useState(false);

  const handleExpandRow = useCallback((ticket) => {
    setCurrentTicket(ticket);
    setIsShowTicketDetailsDialog(true);
  }, [projectUuid]);

  const metadataAPI = useMemo(() => {
    let _api = {};

    // metadata
    if (isFunction(api.getMetadata)) {
      _api.getMetadata = (...params) => {
        return getMetadata(TICKET_TABLE_NAME, params[0], () => api.getMetadata(...params).then(res => {
          return {
            data: {
              ...res.data,
              linked_records: res.data?.linked_record_titles || {},
            }
          };
        }), isBuiltInView).then(res => {
          const rows = Array.isArray(res.data.tickets) ? res.data.tickets : [];
          const linked_records = res?.data?.linked_records || {};
          let columns = res?.data?.columns || [];
          const othersConfig = {
            [PREDEFINED_TICKET_COLUMN_NAME.TITLE]: { click: (row) => togglePageSlugId(row._id) },
          };
          columns = columns.filter(c => !TICKET_NOT_DISPLAY_COLUMNS.includes(c.name)).map(c => {
            const { name } = c;
            const predefinedConfig = TICKET_PREDEFINED_COLUMN_CONFIG[name];
            const otherConfig = othersConfig[name];
            return {
              ...c,
              ...predefinedConfig,
              ...otherConfig,
            };
          });
          const typeColum = columns.find(c => c.name === PREDEFINED_TICKET_COLUMN_NAME.TYPE);
          if (typeColum) {
            context.setSetting('typeColumnKey', typeColum.key);
          }
          const stateColumn = columns.find(c => c.name === PREDEFINED_TICKET_COLUMN_NAME.STATE);
          if (stateColumn) {
            context.setSetting('stateColumnKey', stateColumn.key);
          }
          const tagsColumn = columns.find(c => c.name === PREDEFINED_TICKET_COLUMN_NAME.TAGS);
          if (tagsColumn) {
            context.setSetting('tagsColumnKey', tagsColumn.key);
          }

          allColumns.current = columns;
          return {
            data: {
              ...res?.data,
              rows,
              columns,
              linked_records,
            }
          };
        });
      };
    }

    // view
    if (isFunction(api.getViews)) {
      _api.getViews = () => getTableViews(TICKET_TABLE_NAME, () => api.getViews(), isBuiltInView);
    }
    if (isFunction(api.getView)) {
      _api.getView = (viewID) => getTableView(TICKET_TABLE_NAME, viewID, () => api.getView(viewID), isBuiltInView);
    }
    if (isFunction(api.insertView)) {
      _api.insertView = (name, viewData) => insertView(TICKET_TABLE_NAME, () => api.insertView(name, viewData));
    }
    if (isFunction(api.modifyView)) {
      _api.modifyView = (viewID, viewData) => modifyView(TICKET_TABLE_NAME, viewID, viewData, () => api.modifyView(viewID, viewData), isBuiltInView);
    }
    if (isFunction(api.deleteView)) {
      _api.deleteView = (viewID) => deleteView(TICKET_TABLE_NAME, viewID, () => api.deleteView(viewID));
    }
    if (isFunction(api.moveView)) {
      _api.moveView = (sourceViewID, targetViewID) => moveView(TICKET_TABLE_NAME, sourceViewID, targetViewID, () => api.moveView(sourceViewID, targetViewID));
    }
    if (isFunction(api.duplicateView)) {
      _api.duplicateView = (viewID) => duplicateView(TICKET_TABLE_NAME, () => api.duplicateView(viewID));
    }

    // row
    _api.insertRow = () => togglePageSlugId(TICKET_PAGE_SLUG_ID.NEW);
    if (isFunction(api.modifyRow)) {
      _api.modifyRow = (row_id, row_update, isCopyPaste, { data, typesData, tagsData } = {}) => {
        let rowData = convertRowToNameValue(row_update, { data, typesData, tagsData });
        if (row_update[AUTO_UPDATE_PARTICIPANTS_KEY]) {
          delete rowData[PREDEFINED_TICKET_COLUMN_NAME.PARTICIPANTS];
        }
        return modifyRow(TICKET_TABLE_NAME, row_id, row_update, () => api.modifyRow(row_id, rowData, isCopyPaste), { typesData }).catch(error => {
          if (isOpenLinkedGithubIssuesWarning(error)) {
            const data = error?.response?.data || {};
            closeLinkedGitHubIssuesWarning.current = {
              tickets: data.tickets || [],
              callback: () => {
                return modifyRow(TICKET_TABLE_NAME, row_id, row_update, () => api.modifyRow(row_id, { ...rowData, confirm_close_linked_github_issues: true }, isCopyPaste), { typesData }).then(res => {
                  const eventBus = context.eventBus;
                  eventBus.dispatch(EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, row_id, row_update);
                });
              },
            };
            setIsShowCloseGitHubIssuesWarningDialog(true);
          }
          throw error;
        });
      };
    }
    if (isFunction(api.modifyRows)) {
      _api.modifyRows = (rowsUpdate, isCopyPaste, { data, typesData, tagsData } = {}) => {
        const rowsData = convertRowsToNameValue(rowsUpdate, { data, typesData, tagsData });
        return modifyRows(TICKET_TABLE_NAME, rowsUpdate, () => api.modifyRows(rowsData, isCopyPaste)).catch(error => {
          if (isOpenLinkedGithubIssuesWarning(error)) {
            const data = error?.response?.data || {};
            closeLinkedGitHubIssuesWarning.current = {
              tickets: data.tickets || [],
              callback: () => {
                return modifyRows(TICKET_TABLE_NAME, rowsUpdate, () => api.modifyRows(rowsData, isCopyPaste, { confirm_close_linked_github_issues: true })).then(res => {
                  const eventBus = context.eventBus;
                  let idRowsUpdate = {};
                  rowsUpdate.forEach(rowUpdate => {
                    const { row_id, row } = rowUpdate;
                    idRowsUpdate[row_id] = row;
                  });
                  eventBus.dispatch(EVENT_BUS_TYPE.LOCAL_ROWS_CHANGED, idRowsUpdate);
                });
              },
            };
            setIsShowCloseGitHubIssuesWarningDialog(true);
          }
          throw error;
        });
      };
    }
    if (isFunction(api.deleteRow)) {
      _api.deleteRow = (ticketNumber) => deleteRow(TICKET_TABLE_NAME, ticketNumber, () => api.deleteRow(ticketNumber));
    }
    if (isFunction(api.deleteRows)) {
      _api.deleteRows = (ticketIds) => deleteRows(TICKET_TABLE_NAME, ticketIds, () => api.deleteRows(ticketIds));
    }

    // file
    _api.uploadFile = (...params) => ticketsAPI.uploadFile(projectUuid, ...params);

    return _api;
  }, [projectUuid, isBuiltInView, api, getTableViews, getTableView, insertView, deleteView, modifyView, moveView, duplicateView,
    getMetadata, modifyRow, modifyRows, deleteRow, deleteRows]);

  const localStorageName = useMemo(() => customizeLocalStorageNamePrefix || `seaqa-${projectUuid}-tickets`, [projectUuid, customizeLocalStorageNamePrefix]);

  const t = useMemo(() => {
    return {
      row: gettext('ticket'),
      rows: gettext('tickets'),
      Row: gettext('Ticket'),
      Rows: gettext('Tickets'),
    };
  }, []);

  const chatTicketsByAI = useCallback((tickets) => {
    updateAttachments(tickets);
    toggleBar([BAR_TYPE.CHAT]);
  }, [toggleBar, updateAttachments]);

  const findRelatedIssues = useCallback((ticket) => {
    if (!ticket) return;
    setCurrentTicket(ticket);
    setIsShowRelatedIssuesDialog(true);
  }, []);

  const createKnowledgeBaseRecord = useCallback((ticket) => {
    if (!ticket) return;

    setCurrentTicket(ticket);
    setIsShowCreateKBRecordDialog(true);
  }, []);

  const createTask = useCallback((ticket) => {
    if (!ticket) return;
    setCurrentTicket(ticket);
    setIsShowCreateTaskDialog(true);
  }, []);

  const handleTaskCreated = useCallback(({ task, connection }) => {
    if (!currentTicket) return;
    const linkedConnectionRecordsColumn = getColumnByName(allColumns.current, PREDEFINED_TICKET_COLUMN_NAME.LINKED_CONNECTION_RECORDS);
    if (!linkedConnectionRecordsColumn) return;

    const newValueKey = `${connection.id}_${task._pk}`;
    const oldValue = getCellValueByColumn(currentTicket, linkedConnectionRecordsColumn);
    const newValue = Array.isArray(oldValue) ? Array.from(new Set([...oldValue, newValueKey])) : [newValueKey];
    const update = { [linkedConnectionRecordsColumn.key]: newValue };

    // update cache
    const connectionTableName = getTableName(connection);
    const linked_records = { [newValueKey]: task.title };
    insertRowByLink(connectionTableName, TICKET_TABLE_NAME, linked_records, currentTicket._id, update, () => {
      // update current details dialog
      eventBus.dispatch(GLOBAL_EVENT_BUS_TYPE.MODIFY_LOCAL_RECORD_IN_DIALOG, { [linkedConnectionRecordsColumn.name]: newValue }, { [newValueKey]: { _pk: task._pk, title: task.title, connection_type: connection.type } } );

      // update current view display
      const metadataEventBus = context.eventBus;
      metadataEventBus.dispatch(EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, currentTicket._id, update);
      metadataEventBus.dispatch(EVENT_BUS_TYPE.UPDATE_DATA_ATTRIBUTE, { linked_records }, false);
    });
  }, [currentTicket, insertRowByLink]);

  const createRowsTools = useCallback((props) => {
    let params = {
      ...props,
      projectName,
      workspaceID,
      chatTicketsByAI,
      togglePageSlugId,
      createKnowledgeBaseRecord,
      connections,
      createTask,
    };
    if (canFindRelatedIssues) {
      params.findRelatedIssues = findRelatedIssues;
    }
    if (isFunction(customizeCreateRowsTools)) {
      return customizeCreateRowsTools(params);
    }
    return generatorTicketsRowsTools(params);
  }, [
    workspaceID, projectName, canFindRelatedIssues, connections,
    chatTicketsByAI, findRelatedIssues, customizeCreateRowsTools, togglePageSlugId, createKnowledgeBaseRecord, createTask
  ]);

  const createContextMenuOptions = useCallback((props) => {
    let params = {
      ...props,
      projectName,
      workspaceID,
      chatTicketsByAI,
      togglePageSlugId,
      createKnowledgeBaseRecord,
      connections,
      createTask,
    };
    if (canFindRelatedIssues) {
      params.findRelatedIssues = findRelatedIssues;
    }
    if (isFunction(customizeCreateContextMenuOptions)) {
      return customizeCreateContextMenuOptions(params);
    }
    return generatorTicketsContextMenuOptions(params);
  }, [
    projectName, workspaceID, canFindRelatedIssues, connections,
    chatTicketsByAI, findRelatedIssues, customizeCreateContextMenuOptions, togglePageSlugId, createKnowledgeBaseRecord, createTask,
  ]);

  const createMoreOptions = useCallback((resource) => {
    const row = resource;
    return generatorTicketsContextMenuOptions({
      isGroupView: false,
      selectedPosition: { groupRowIndex: 0, rowIdx: 0 },
      table: { id_row_map: { [row._id]: row }, columns: allColumns.current },
      rowMetrics: { idSelectedRowMap: {} },
      deleteRow: (rowId) => {
        metadataAPI.deleteRow(rowId);
        setIsShowTicketDetailsDialog(false);
        toaster.success(context.translate('{Row} deleted'));
        context.eventBus.dispatch(EVENT_BUS_TYPE.DELETE_ROWS, [row._id]);
      },
      rowGetterByIndex: () => row,
      context,
      chatTicketsByAI,
      togglePageSlugId,
      workspaceID,
      projectName,
      findRelatedIssues: canFindRelatedIssues ? findRelatedIssues : undefined,
      createKnowledgeBaseRecord,
      connections,
      createTask,
    });
  }, [
    workspaceID, projectName, canFindRelatedIssues, connections,
    chatTicketsByAI, findRelatedIssues, togglePageSlugId, createKnowledgeBaseRecord, metadataAPI, createTask,
  ]);

  const handleSwitchTicket = useCallback((step) => {
    const ticketsData = metadataRef.current.getOrderRows();
    const index = ticketsData.findIndex(r => r._id === currentTicket._id);
    if (index === -1) return;

    let newIndex = index + step;
    if (newIndex > ticketsData.length - 1) {
      newIndex = 0;
    }
    if (newIndex < 0) {
      newIndex = ticketsData.length - 1;
    }
    const ticket = ticketsData[newIndex];
    setCurrentTicket(ticket);
  }, [currentTicket, metadataRef]);

  const onCloseRelatedIssuesDialog = useCallback(() => {
    setIsShowRelatedIssuesDialog(false);
    if (isShowTicketDetailsDialog) return;
    setCurrentTicket(null);
  }, [isShowTicketDetailsDialog]);

  const onCloseWarningDialog = useCallback(() => {
    setIsShowCloseGitHubIssuesWarningDialog(false);
    closeLinkedGitHubIssuesWarning.current = null;
  }, []);

  const handleCloseLinkedGithubIssues = useCallback((callback) => {
    const { callback: modify, tickets } = closeLinkedGitHubIssuesWarning.current;
    modify && modify().then(res => {
      callback && callback();
      const issues = tickets.map(ticket => ticket.open_github_issues).flat();
      modifyLocalGitHubIssuesClosed(issues, connections);
      setIsShowCloseGitHubIssuesWarningDialog(false);
      closeLinkedGitHubIssuesWarning.current = null;
    }).catch(error => {
      callback && callback(error);
    });
  }, [connections, modifyLocalGitHubIssuesClosed]);

  if (isLoading) return (<CenteredLoading />);

  return (
    <>
      <SeaMetadata
        className="seaqa-tickets-metadata"
        ref={metadataRef}
        api={metadataAPI}
        t={t}
        isShowViewInURL={isShowViewInURL}
        fixedColumnCount={2}
        localStorageNamePrefix={localStorageName}
        permission={permission}
        createContextMenuOptions={createContextMenuOptions}
        createRowsTools={createRowsTools}
        expandRow={handleExpandRow}
        cascadeUpdateCells={cascadeUpdate}
        columnOrderRules={TICKET_COLUMNS_ORDER_CONFIG}
        columnWidthRules={TICKET_COLUMNS_WIDTH_CONFIG}
        tagsData={tagsData}
        createTag={createTag}
        typesData={typesData}
        createType={createType}
        toggleAllTypes={() => togglePageSlugId(TICKET_PAGE_SLUG_ID.TYPES)}
        substatesData={substatesData}
        createSubstate={createSubstate}
        toggleAllSubstates={() => togglePageSlugId(TICKET_PAGE_SLUG_ID.SUBSTATES)}
        settings={{ ...settings, canClearCells: false, canPasteCells: false, canDragFillCells: false }}
        { ...props }
      />
      {isShowRelatedIssuesDialog && currentTicket && (
        <RelatedIssuesDialog
          projectUuid={projectUuid}
          ticketId={currentTicket._id}
          workspaceID={workspaceID}
          projectName={projectName}
          onClose={onCloseRelatedIssuesDialog}
        />
      )}
      {isShowTicketDetailsDialog && (
        <ResourceDetailsDialog
          projectUuid={projectUuid}
          resource={{ ...currentTicket, type: TICKET_TYPE }}
          columns={allColumns.current}
          switchResource={handleSwitchTicket}
          onToggle={() => setIsShowTicketDetailsDialog(false)}
          getTicket={getTicket}
          createMoreOptions={createMoreOptions}
        />
      )}
      {isShowCreateKBRecordDialog && currentTicket && (
        <CreateKBRecordDialog
          projectUuid={projectUuid}
          ticket={convertTicketToKb(currentTicket, allColumns.current)}
          onClose={() => {
            setIsShowCreateKBRecordDialog(false);
            if (isShowTicketDetailsDialog) return;
            setCurrentTicket(null);
          }}
        />
      )}
      {isShowCreateTaskDialog && currentTicket && (
        <CreateTaskDialog
          projectUuid={projectUuid}
          workspaceID={workspaceID}
          projectName={projectName}
          ticket={convertTicketToTask(currentTicket, allColumns.current)}
          onClose={() => {
            setIsShowCreateTaskDialog(false);
            if (isShowTicketDetailsDialog) return;
            setCurrentTicket(null);
          }}
          onSubmitCallback={handleTaskCreated}
        />
      )}
      {isShowCloseGitHubIssuesWarningDialog && (
        <CloseLinkedGitHubIssuesWarningDialog
          tickets={closeLinkedGitHubIssuesWarning.current.tickets}
          onToggle={onCloseWarningDialog}
          onSubmit={handleCloseLinkedGithubIssues}
        />
      )}
    </>
  );
};

export default Tickets;
