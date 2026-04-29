import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ticketsAPI } from '../../../api';
import { portalAPI } from '@/portal/api';
import SeaMetadata from '@/sea-metadata';
import { usePortalIssuesMetadata } from '../hooks';
import {
  PORTAL_ISSUE_PAGE_SLUG_ID, PORTAL_ISSUE_PREDEFINED_COLUMN_CONFIG,
  PORTAL_ISSUE_NOT_DISPLAY_COLUMNS, PREDEFINED_PORTAL_ISSUE_COLUMN_NAME,
  PORTAL_ISSUE_COLUMNS_ORDER_CONFIG, PORTAL_ISSUE_COLUMNS_WIDTH_CONFIG,
  PORTAL_ISSUE_TABLE_NAME, PORTAL_ISSUE_TYPE,
} from '../constants';
import { BAR_TYPE } from '@/project/constants';
import { gettext, server, siteRoot } from '@/constants';
import { CenteredLoading } from '@/components';
import context from '@/sea-metadata/context';
import toaster from '@/components/toaster';
import {
  generatorIssuesRowsTools,
  cascadeUpdate, generatorIssuesContextMenuOptions,
} from '../utils';
import { convertRowToNameValue, convertRowsToNameValue } from '@/sea-metadata/utils/row';
import { useAIChatTools } from '@/project/main-panel/ask/hooks';
import CreateTicketDialog from '@/project/main-panel/connections/components/create-ticket-dialog';
import { isFunction, isObject } from '@/utils/type-detection';
import { useData, useTags } from '@/project/hooks';
import ResourceDetailsDialog from '@/project/components/resource-details-dialog';
import { EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { TICKET_TABLE_NAME } from '../../tickets/constants';
import { normalizeContextMenuOptions } from '@/project/utils';
import TicketsDialog from '@/project/main-panel/tickets/components/tickets-dialog';
import { Utils } from '@/utils/utils';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';

const Issues = ({
  canCreateRelatedTickets = true, isBuiltInView = false, canOpenIssue = true, canChatWithAI = false, isShowViewInURL = true,
  projectUuid, workspaceID, projectName, permission,
  toggleBar = () => {},
  api,
  localStorageNamePrefix: customizeLocalStorageNamePrefix,
  createContextMenuOptions: customizeCreateContextMenuOptions,
  createRowsTools: customizeCreateRowsTools,
  togglePageSlugId = () => {},
  isLoading = false,
  settings = {},
  getIssue = (uuid, issueNumber) => portalAPI.getPortalIssue(uuid, issueNumber),
  onRefresh,
  ...props
}) => {
  const { updateAttachments } = useAIChatTools();
  const {
    typesData, createType,
    substatesData, createSubstate,
  } = usePortalIssuesMetadata();
  const { tagsData, createTag } = useTags();
  const {
    getTableViews, getTableView, insertView, deleteView, modifyView, moveView, duplicateView,
    getMetadata, modifyRow, modifyRows, deleteRow, deleteRows, insertRowByLink, modifyRowLink,
  } = useData();

  const metadataRef = useRef(null);
  const allColumns = useRef([]);

  const [currentIssue, setCurrentIssue] = useState(null);
  const [isShowIssueDetailsDialog, setIsShowIssueDetailsDialog] = useState(false);
  const [isShowCreateTicketDialog, setIsShowCreateTicketDialog] = useState(false);
  const [isShowTicketsDialog, setIsShowTicketsDialog] = useState(false);

  const handleExpandRow = useCallback((issue) => {
    setCurrentIssue({ ...issue, type: PORTAL_ISSUE_TYPE });
    setIsShowIssueDetailsDialog(true);
  }, [projectUuid]);

  const metadataAPI = useMemo(() => {
    let _api = {};

    // metadata
    if (isFunction(api.getMetadata)) {
      _api.getMetadata = (...params) => {
        return getMetadata(PORTAL_ISSUE_TABLE_NAME, params[0], () => api.getMetadata(...params).then(res => {
          return {
            data: {
              ...res.data,
              linked_records: res.data?.ticket_pk_to_ticket_title || {},
            }
          };
        }), isBuiltInView).then(res => {
          const rows = Array.isArray(res.data.records) ? res.data.records : [];
          const linked_records = res?.data?.linked_records || {};
          let columns = res?.data?.columns || [];
          const othersConfig = {
            [PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.TITLE]: { click: (row) => togglePageSlugId(row._id) },
          };
          columns = columns.filter(c => !PORTAL_ISSUE_NOT_DISPLAY_COLUMNS.includes(c.name)).map(c => {
            const { name } = c;
            const predefinedConfig = PORTAL_ISSUE_PREDEFINED_COLUMN_CONFIG[name];
            const otherConfig = othersConfig[name];
            return {
              ...c,
              ...predefinedConfig,
              ...otherConfig,
            };
          });
          const typeColum = columns.find(c => c.name === PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.TYPE);
          if (typeColum) {
            context.setSetting('typeColumnKey', typeColum.key);
          }
          const stateColumn = columns.find(c => c.name === PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.STATE);
          if (stateColumn) {
            context.setSetting('stateColumnKey', stateColumn.key);
          }
          const tagsColumn = columns.find(c => c.name === PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.TAGS);
          if (tagsColumn) {
            context.setSetting('tagsColumnKey', tagsColumn.key);
          }

          allColumns.current = columns;
          return {
            data: {
              rows,
              columns,
              linked_records,
              error_msg: res?.data?.error_msg,
            }
          };
        });
      };
    }

    // view
    if (isFunction(api.getViews)) {
      _api.getViews = () => getTableViews(PORTAL_ISSUE_TABLE_NAME, () => api.getViews(), isBuiltInView);
    }
    if (isFunction(api.getView)) {
      _api.getView = (viewID) => getTableView(PORTAL_ISSUE_TABLE_NAME, viewID, () => api.getView(viewID), isBuiltInView);
    }
    if (isFunction(api.insertView)) {
      _api.insertView = (name, viewData) => insertView(PORTAL_ISSUE_TABLE_NAME, () => api.insertView(name, viewData));
    }
    if (isFunction(api.modifyView)) {
      _api.modifyView = (viewID, viewData) => modifyView(PORTAL_ISSUE_TABLE_NAME, viewID, viewData, () => api.modifyView(viewID, viewData), isBuiltInView);
    }
    if (isFunction(api.deleteView)) {
      _api.deleteView = (viewID) => deleteView(PORTAL_ISSUE_TABLE_NAME, viewID, () => api.deleteView(viewID));
    }
    if (isFunction(api.moveView)) {
      _api.moveView = (sourceViewID, targetViewID) => moveView(PORTAL_ISSUE_TABLE_NAME, sourceViewID, targetViewID, () => api.moveView(sourceViewID, targetViewID));
    }
    if (isFunction(api.duplicateView)) {
      _api.duplicateView = (viewID) => duplicateView(PORTAL_ISSUE_TABLE_NAME, () => api.duplicateView(viewID));
    }

    // row
    if (isFunction(api.modifyRow)) {
      _api.modifyRow = (row_id, row_update, isCopyPaste, { data, typesData, tagsData } = {}) => {
        let rowData = convertRowToNameValue(row_update, { data, typesData, tagsData });
        return modifyRow(PORTAL_ISSUE_TABLE_NAME, row_id, row_update, () => api.modifyRow(row_id, rowData, isCopyPaste));
      };
    }
    if (isFunction(api.modifyRows)) {
      _api.modifyRows = (rowsUpdate, isCopyPaste, { data, typesData, tagsData } = {}) => {
        const rowsData = convertRowsToNameValue(rowsUpdate, { data, typesData, tagsData });
        return modifyRows(PORTAL_ISSUE_TABLE_NAME, rowsUpdate, () => api.modifyRows(rowsData, isCopyPaste));
      };
    }
    if (isFunction(api.deleteRow)) {
      _api.deleteRow = (ticketNumber) => deleteRow(PORTAL_ISSUE_TABLE_NAME, ticketNumber, () => api.deleteRow(ticketNumber));
    }
    if (isFunction(api.deleteRows)) {
      _api.deleteRows = (ticketIds) => deleteRows(PORTAL_ISSUE_TABLE_NAME, ticketIds, () => api.deleteRows(ticketIds));
    }

    // file
    _api.uploadFile = (...params) => ticketsAPI.uploadFile(projectUuid, ...params);

    return _api;
  }, [projectUuid, isBuiltInView, api, getTableViews, getTableView, insertView, deleteView, modifyView, moveView, duplicateView,
    getMetadata, modifyRow, modifyRows, deleteRow, deleteRows]);

  const localStorageName = useMemo(() => customizeLocalStorageNamePrefix || `sea-ticket-${projectUuid}-issues`, [projectUuid, customizeLocalStorageNamePrefix]);

  const t = useMemo(() => {
    return {
      row: gettext('issue'),
      rows: gettext('issues'),
      Row: gettext('Issue'),
      Rows: gettext('Issues'),
    };
  }, []);

  const chatIssuesByAI = useCallback((issues) => {
    updateAttachments(issues);
    toggleBar([BAR_TYPE.CHAT]);
  }, [toggleBar, updateAttachments]);

  const createTicket = useCallback((issue) => {
    if (!issue) return;
    setCurrentIssue(issue);
    setIsShowCreateTicketDialog(true);
  }, []);

  const handleLinkAnExistingTicket = useCallback((issue) => {
    if (!issue) return;
    setCurrentIssue(issue);
    setIsShowTicketsDialog(true);
  }, []);

  const linkAnExistingTicket = useCallback((ticket, linkedConnectionRecordsColumn, callback) => {
    const linkedTicketColumn = getColumnByName(allColumns.current, PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.LINKED_TICKET);
    const rowUpdate = { [linkedTicketColumn.key]: ticket.id };
    const rowId = currentIssue._id;
    const issueLinkedUpdate = { [ticket.id]: ticket.title };
    const titleColumn = getColumnByName(allColumns.current, PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.TITLE);
    modifyRowLink({
      tableName: TICKET_TABLE_NAME,
      rowId: String(ticket.id),
      rowUpdate: { [linkedConnectionRecordsColumn.key]: [`portal_${rowId}`] },
      linkedRecords: { [`portal_${rowId}`]: getCellValueByColumn(currentIssue, titleColumn) }
    }, {
      tableName: PORTAL_ISSUE_TABLE_NAME,
      rowId: rowId,
      rowUpdate: rowUpdate,
      linkedRecords: issueLinkedUpdate
    }, () => {
      return portalAPI.modifyPortalIssue(projectUuid, rowId, { [linkedTicketColumn.name]: ticket.id }).then(res => {
        const eventBus = context.eventBus;
        eventBus.dispatch(EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, rowId, rowUpdate);
        eventBus.dispatch(EVENT_BUS_TYPE.UPDATE_DATA_ATTRIBUTE, { linked_records: issueLinkedUpdate }, false);
        callback && callback();
      }).catch(error => {
        const errorMessage = Utils.getErrorMsg(error);
        toaster.danger(errorMessage);
        callback && callback(true);
      });
    });
  }, [currentIssue, modifyRowLink]);

  const createRowsTools = useCallback((props) => {
    let params = { ...props, projectName, workspaceID, togglePageSlugId };
    if (canCreateRelatedTickets) {
      params.createTicket = createTicket;
      params.linkAnExistingTicket = handleLinkAnExistingTicket;
    }
    if (canChatWithAI) {
      params.chatIssuesByAI = chatIssuesByAI;
    }
    if (isFunction(customizeCreateRowsTools)) {
      return customizeCreateRowsTools(params);
    }
    return generatorIssuesRowsTools(params);
  }, [
    workspaceID, projectName, canCreateRelatedTickets, canChatWithAI,
    chatIssuesByAI, createTicket, customizeCreateRowsTools, togglePageSlugId,
    handleLinkAnExistingTicket,
  ]);

  const createContextMenuOptions = useCallback((props) => {
    let params = { ...props, projectName, workspaceID, togglePageSlugId };
    if (canCreateRelatedTickets) {
      params.createTicket = createTicket;
      params.linkAnExistingTicket = handleLinkAnExistingTicket;
    }
    if (canChatWithAI) {
      params.chatIssuesByAI = chatIssuesByAI;
    }

    if (isFunction(customizeCreateContextMenuOptions)) {
      return customizeCreateContextMenuOptions(params);
    }
    return generatorIssuesContextMenuOptions(params);
  }, [
    projectName, workspaceID, canCreateRelatedTickets, canChatWithAI,
    chatIssuesByAI, createTicket, customizeCreateContextMenuOptions, togglePageSlugId,
    handleLinkAnExistingTicket,
  ]);

  const createMoreOptions = useCallback((resource) => {
    const row = resource;
    let options = generatorIssuesContextMenuOptions({
      isGroupView: false,
      selectedPosition: { groupRowIndex: 0, rowIdx: 0 },
      table: { id_row_map: { [row._id]: row }, columns: allColumns.current },
      rowMetrics: { idSelectedRowMap: {} },
      deleteRow: (rowId) => {
        metadataAPI.deleteRow(rowId);
        setIsShowIssueDetailsDialog(false);
        toaster.success(context.translate('{Row} deleted'));
        context.eventBus.dispatch(EVENT_BUS_TYPE.DELETE_ROWS, [row._id]);
      },
      rowGetterByIndex: () => row,
      context,
      chatIssuesByAI: canChatWithAI ? chatIssuesByAI : undefined,
      togglePageSlugId,
      workspaceID,
      projectName,
      createTicket: canCreateRelatedTickets ? createTicket : undefined,
      linkAnExistingTicket: canCreateRelatedTickets ? handleLinkAnExistingTicket : undefined,
    });
    if (!canOpenIssue) {
      options = options.filter(item => (isObject(item) && item?.key !== 'open_issue') || !isObject(item));
    }
    return normalizeContextMenuOptions(options);
  }, [
    workspaceID, projectName, canOpenIssue, canCreateRelatedTickets, canChatWithAI,
    chatIssuesByAI, createTicket, togglePageSlugId, metadataAPI, handleLinkAnExistingTicket
  ]);

  const handleSwitchIssue = useCallback((step) => {
    const issuesData = metadataRef.current.getOrderRows();
    const index = issuesData.findIndex(r => r._id === currentIssue._id);
    if (index === -1) return;

    let newIndex = index + step;
    if (newIndex > issuesData.length - 1) {
      newIndex = 0;
    }
    if (newIndex < 0) {
      newIndex = issuesData.length - 1;
    }
    const issue = issuesData[newIndex];
    setCurrentIssue({ ...issue, type: PORTAL_ISSUE_TYPE });
  }, [currentIssue, metadataRef]);

  const onCloseCreateTicketDialog = useCallback(() => {
    setIsShowCreateTicketDialog(false);
    if (isShowIssueDetailsDialog) return;
    setCurrentIssue(null);
  }, [isShowIssueDetailsDialog]);

  const createTicketCallback = useCallback((ticket, currentRow) => {
    const linkedUpdateRecord = {
      [ticket._pk]: ticket.title,
    };
    const linkColumn = getColumnByName(allColumns.current, PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.LINKED_TICKET);
    const rowUpdateData = { [linkColumn.key]: [ticket._pk] };
    insertRowByLink(TICKET_TABLE_NAME, PORTAL_ISSUE_TABLE_NAME, linkedUpdateRecord, currentRow._id, rowUpdateData, () => {
      const eventBus = context.eventBus;
      eventBus.dispatch(EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, currentRow._id, rowUpdateData);
      eventBus.dispatch(EVENT_BUS_TYPE.UPDATE_DATA_ATTRIBUTE, { linked_records: linkedUpdateRecord }, false);
    });
  }, []);

  if (isLoading) return (<CenteredLoading />);

  return (
    <>
      <SeaMetadata
        className="sea-ticket-issues-metadata"
        ref={metadataRef}
        isShowViewInURL={isShowViewInURL}
        api={metadataAPI}
        t={t}
        fixedColumnCount={2}
        localStorageNamePrefix={localStorageName}
        permission={permission}
        createContextMenuOptions={createContextMenuOptions}
        createRowsTools={createRowsTools}
        expandRow={handleExpandRow}
        cascadeUpdateCells={cascadeUpdate}
        columnOrderRules={PORTAL_ISSUE_COLUMNS_ORDER_CONFIG}
        columnWidthRules={PORTAL_ISSUE_COLUMNS_WIDTH_CONFIG}
        tagsData={tagsData}
        createTag={createTag}
        typesData={typesData}
        createType={createType}
        toggleAllTypes={() => togglePageSlugId(PORTAL_ISSUE_PAGE_SLUG_ID.TYPES)}
        substatesData={substatesData}
        createSubstate={createSubstate}
        toggleAllSubstates={() => togglePageSlugId(PORTAL_ISSUE_PAGE_SLUG_ID.SUBSTATES)}
        settings={{ ...settings, canClearCells: false, canPasteCells: false, canDragFillCells: false }}
        { ...props }
      />
      {isShowCreateTicketDialog && currentIssue && (
        <CreateTicketDialog
          projectUuid={projectUuid}
          row={currentIssue}
          linkedRecordPrefix="portal"
          useMetadataContext={usePortalIssuesMetadata}
          onClose={onCloseCreateTicketDialog}
          convertToTicket={() => {
            return portalAPI.convertPortalIssueToTicket(projectUuid, currentIssue._id).then(res => {
              const relatedUrl = `${server}${siteRoot}`;
              return {
                data: {
                  ...res?.data,
                  related_url: relatedUrl + (res?.data?.related_url || '').slice(1)
                }
              };
            });
          }}
          onSubmitCallback={(ticket) => createTicketCallback(ticket, currentIssue)}
        />
      )}
      {isShowIssueDetailsDialog && (
        <ResourceDetailsDialog
          projectUuid={projectUuid}
          resource={currentIssue}
          columns={allColumns.current}
          switchResource={handleSwitchIssue}
          onToggle={() => setIsShowIssueDetailsDialog(false)}
          getIssue={getIssue}
          createMoreOptions={createMoreOptions}
        />
      )}
      {isShowTicketsDialog && (
        <TicketsDialog
          projectUuid={projectUuid}
          onSubmit={linkAnExistingTicket}
          onToggle={() => {
            setIsShowTicketsDialog(false);
            if (!isShowIssueDetailsDialog) {
              setCurrentIssue(null);
            }
          }}
        />
      )}
    </>
  );
};

export default Issues;
