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
import { BAR_TYPE } from '@/project/constants';
import { gettext } from '@/constants';
import { CenteredLoading } from '@/components';
import context from '@/sea-metadata/context';
import toaster from '@/components/toaster';
import {
  generatorTicketsRowsTools,
  cascadeUpdate, generatorTicketsContextMenuOptions,
} from '../utils';
import { convertRowToNameValue, convertRowsToNameValue } from '@/sea-metadata/utils/row';
import { useAIChatTools } from '@/project/main-panel/ask/hooks';
import RelatedIssuesDialog from './related-issues-dialog';
import CreateKBRecordDialog from './create-kb-record-dialog';
import { isFunction } from '@/utils/type-detection';
import { useData, useTags } from '@/project/hooks';
import ResourceDetailsDialog from '@/project/components/resource-details-dialog';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { EVENT_BUS_TYPE } from '@/sea-metadata/constants';

const Tickets = ({
  viewID, canFindRelatedIssues = true, isBuiltInView = false,
  projectUuid, workspaceID, projectName, permission,
  toggleBar = () => {},
  api,
  localStorageNamePrefix: customizeLocalStorageNamePrefix,
  createContextMenuOptions: customizeCreateContextMenuOptions,
  createRowsTools: customizeCreateRowsTools,
  togglePageSlugId = () => {},
  toggleView,
  isLoading = false,
  settings = {},
  getTicket,
  onRefresh,
  tableName = TICKET_TABLE_NAME,
  rowType = TICKET_TYPE,
  metadata: customMetadata,
  ...props
}) => {
  const { updateAttachments } = useAIChatTools();
  const defaultMetadata = useMetadata();
  const {
    typesData, createType,
    substatesData, createSubstate,
  } = customMetadata || defaultMetadata;
  const { tagsData, createTag } = useTags();
  const {
    getTableViews, getTableView, insertView, deleteView, modifyView, moveView, duplicateView,
    getMetadata, modifyRow, modifyRows, deleteRow, deleteRows,
  } = useData();

  const metadataRef = useRef(null);
  const allColumns = useRef([]);

  const [isShowRelatedIssuesDialog, setIsShowRelatedIssuesDialog] = useState(false);
  const [currentTicket, setCurrentTicket] = useState(null);
  const [isShowTicketDetailsDialog, setIsShowTicketDetailsDialog] = useState(false);

  const [isShowCreateKBRecordDialog, setIsShowCreateKBRecordDialog] = useState(false);
  const [kbSourceTicket, setKbSourceTicket] = useState(null);

  const handleExpandRow = useCallback((ticket) => {
    setCurrentTicket({ ...ticket, type: rowType });
    setIsShowTicketDetailsDialog(true);
  }, [projectUuid, rowType]);

  const metadataAPI = useMemo(() => {
    let _api = {};

    // metadata
    if (isFunction(api.getMetadata)) {
      _api.getMetadata = (...params) => {
        return getMetadata(tableName, params[0], () => api.getMetadata(...params).then(res => {
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
      _api.getViews = () => getTableViews(tableName, () => api.getViews(), isBuiltInView);
    }
    if (isFunction(api.getView)) {
      _api.getView = (viewID) => getTableView(tableName, viewID, () => api.getView(viewID), isBuiltInView);
    }
    if (isFunction(api.insertView)) {
      _api.insertView = (name, viewData) => insertView(tableName, () => api.insertView(name, viewData));
    }
    if (isFunction(api.modifyView)) {
      _api.modifyView = (viewID, viewData) => modifyView(tableName, viewID, viewData, () => api.modifyView(viewID, viewData), isBuiltInView);
    }
    if (isFunction(api.deleteView)) {
      _api.deleteView = (viewID) => deleteView(tableName, viewID, () => api.deleteView(viewID));
    }
    if (isFunction(api.moveView)) {
      _api.moveView = (sourceViewID, targetViewID) => moveView(tableName, sourceViewID, targetViewID, () => api.moveView(sourceViewID, targetViewID));
    }
    if (isFunction(api.duplicateView)) {
      _api.duplicateView = (viewID) => duplicateView(tableName, () => api.duplicateView(viewID));
    }

    // row
    _api.insertRow = () => togglePageSlugId(TICKET_PAGE_SLUG_ID.NEW);
    if (isFunction(api.modifyRow)) {
      _api.modifyRow = (row_id, row_update, isCopyPaste, { data, typesData, tagsData } = {}) => {
        let rowData = convertRowToNameValue(row_update, { data, typesData, tagsData });
        if (row_update[AUTO_UPDATE_PARTICIPANTS_KEY]) {
          delete rowData[PREDEFINED_TICKET_COLUMN_NAME.PARTICIPANTS];
        }
        return modifyRow(tableName, row_id, row_update, () => api.modifyRow(row_id, rowData, isCopyPaste));
      };
    }
    if (isFunction(api.modifyRows)) {
      _api.modifyRows = (rowsUpdate, isCopyPaste, { data, typesData, tagsData } = {}) => {
        const rowsData = convertRowsToNameValue(rowsUpdate, { data, typesData, tagsData });
        return modifyRows(tableName, rowsUpdate, () => api.modifyRows(rowsData, isCopyPaste));
      };
    }
    if (isFunction(api.deleteRow)) {
      _api.deleteRow = (ticketNumber) => deleteRow(tableName, ticketNumber, () => api.deleteRow(ticketNumber));
    }
    if (isFunction(api.deleteRows)) {
      _api.deleteRows = (ticketIds) => deleteRows(tableName, ticketIds, () => api.deleteRows(ticketIds));
    }

    // file
    _api.uploadFile = (...params) => ticketsAPI.uploadFile(projectUuid, ...params);

    return _api;
  }, [projectUuid, isBuiltInView, api, tableName, getTableViews, getTableView, insertView, deleteView, modifyView, moveView, duplicateView,
    getMetadata, modifyRow, modifyRows, deleteRow, deleteRows]);

  const localStorageName = useMemo(() => customizeLocalStorageNamePrefix || `sea-qa-${projectUuid}-tickets`, [projectUuid, customizeLocalStorageNamePrefix]);

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

    const titleColumn = getColumnByName(allColumns.current, PREDEFINED_TICKET_COLUMN_NAME.TITLE);
    const contentColumn = getColumnByName(allColumns.current, PREDEFINED_TICKET_COLUMN_NAME.CONTENT);

    const title = titleColumn ? (getCellValueByColumn(ticket, titleColumn) || '') : (ticket?.title || '');

    const rawContent = contentColumn ? getCellValueByColumn(ticket, contentColumn) : ticket?.content;
    let content = '';
    if (rawContent && typeof rawContent === 'object') {
      content = rawContent.text || rawContent.preview || '';
    } else {
      content = rawContent || '';
    }

    setKbSourceTicket({
      _id: ticket._id,
      title,
      content,
    });
    setIsShowCreateKBRecordDialog(true);
  }, []);

  const createRowsTools = useCallback((props) => {
    let params = { ...props, projectName, workspaceID, chatTicketsByAI, togglePageSlugId, createKnowledgeBaseRecord };
    if (canFindRelatedIssues) {
      params.findRelatedIssues = findRelatedIssues;
    }
    if (isFunction(customizeCreateRowsTools)) {
      return customizeCreateRowsTools(params);
    }
    return generatorTicketsRowsTools(params);
  }, [workspaceID, projectName, canFindRelatedIssues, chatTicketsByAI, findRelatedIssues, customizeCreateRowsTools, togglePageSlugId, createKnowledgeBaseRecord]);

  const createContextMenuOptions = useCallback((props) => {
    let params = { ...props, projectName, workspaceID, chatTicketsByAI, togglePageSlugId, createKnowledgeBaseRecord };
    if (canFindRelatedIssues) {
      params.findRelatedIssues = findRelatedIssues;
    }
    if (isFunction(customizeCreateContextMenuOptions)) {
      return customizeCreateContextMenuOptions(params);
    }
    return generatorTicketsContextMenuOptions(params);
  }, [projectName, workspaceID, canFindRelatedIssues, chatTicketsByAI, findRelatedIssues, customizeCreateContextMenuOptions, togglePageSlugId, createKnowledgeBaseRecord]);

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
    });
  }, [workspaceID, projectName, canFindRelatedIssues, chatTicketsByAI, findRelatedIssues, togglePageSlugId, createKnowledgeBaseRecord, metadataAPI]);

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
    setCurrentTicket({ ...ticket, type: rowType });
  }, [currentTicket, metadataRef, rowType]);

  const onCloseRelatedIssuesDialog = useCallback(() => {
    setIsShowRelatedIssuesDialog(false);
    if (isShowTicketDetailsDialog) return;
    setCurrentTicket(null);
  }, [isShowTicketDetailsDialog]);

  if (isLoading) return (<CenteredLoading />);

  return (
    <>
      <SeaMetadata
        className="sea-tickets-metadata"
        ref={metadataRef}
        viewID={viewID}
        api={metadataAPI}
        t={t}
        fixedColumnCount={2}
        localStorageNamePrefix={localStorageName}
        permission={permission}
        createContextMenuOptions={createContextMenuOptions}
        createRowsTools={createRowsTools}
        expandRow={handleExpandRow}
        toggleView={toggleView}
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
          resource={currentTicket}
          columns={allColumns.current}
          switchResource={handleSwitchTicket}
          onToggle={() => setIsShowTicketDetailsDialog(false)}
          getTicket={getTicket}
          createMoreOptions={createMoreOptions}
        />
      )}
      {isShowCreateKBRecordDialog && kbSourceTicket && (
        <CreateKBRecordDialog
          projectUuid={projectUuid}
          ticket={kbSourceTicket}
          onClose={() => {
            setIsShowCreateKBRecordDialog(false);
            setKbSourceTicket(null);
          }}
        />
      )}
    </>
  );
};

export default Tickets;
