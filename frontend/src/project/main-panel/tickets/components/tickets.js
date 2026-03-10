import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ticketsAPI } from '../../../api';
import SeaMetadata from '@/sea-metadata';
import { useMetadata } from '../hooks';
import {
  TICKET_PAGE_SLUG_ID, TICKET_PREDEFINED_COLUMN_CONFIG,
  TICKET_NOT_DISPLAY_COLUMNS, PREDEFINED_TICKET_COLUMN_NAME,
  TICKET_COLUMNS_ORDER_CONFIG, TICKET_COLUMNS_WIDTH_CONFIG,
  TICKET_TABLE_NAME, TICKET_TYPE,
} from '../constants';
import { BAR_TYPE } from '@/project/constants';
import { gettext } from '@/constants';
import { CenteredLoading } from '@/components';
import context from '@/sea-metadata/context';
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

const Tickets = ({
  viewID, canFindRelatedIssues = true, isBuiltInView = false,
  projectUuid, workspaceID, projectName, permission,
  toggleBar = () => {},
  api, localStorageNamePrefix: customizeLocalStorageNamePrefix,
  createContextMenuOptions: customizeCreateContextMenuOptions,
  createRowsTools: customizeCreateRowsTools,
  togglePageSlugId = () => {},
  toggleView,
  isLoading = false,
  getTicket,
  ...props
}) => {
  const { updateAttachments } = useAIChatTools();
  const {
    typesData, createType,
    substatesData, createSubstate,
  } = useMetadata();
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
    setCurrentTicket({ ...ticket, type: TICKET_TYPE });
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
        const rowData = convertRowToNameValue(row_update, { data, typesData, tagsData });
        return modifyRow(TICKET_TABLE_NAME, row_id, row_update, () => api.modifyRow(row_id, rowData, isCopyPaste));
      };
    }
    if (isFunction(api.modifyRows)) {
      _api.modifyRows = (rowsUpdate, isCopyPaste, { data, typesData, tagsData } = {}) => {
        const rowsData = convertRowsToNameValue(rowsUpdate, { data, typesData, tagsData });
        return modifyRows(TICKET_TABLE_NAME, rowsUpdate, () => api.modifyRows(rowsData, isCopyPaste));
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
      deleteRow: (rowId) => metadataAPI.deleteRow(rowId),
      hideMenu: () => {},
      rowGetterByIndex: () => row,
      selectNone: () => {},
      context,
      chatTicketsByAI,
      togglePageSlugId,
      workspaceID,
      projectName,
      permission,
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
    setCurrentTicket({ ...ticket, type: TICKET_TYPE });
  }, [currentTicket, metadataRef]);

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

        { ...props }
      />
      {isShowRelatedIssuesDialog && currentTicket && (
        <RelatedIssuesDialog
          projectUuid={projectUuid}
          ticketId={currentTicket._id}
          workspaceID={workspaceID}
          projectName={projectName}
          onClose={() => { setIsShowRelatedIssuesDialog(false); setCurrentTicket(null); }}
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
