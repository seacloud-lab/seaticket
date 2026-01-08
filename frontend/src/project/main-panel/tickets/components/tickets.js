import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ticketsAPI } from '../../../api';
import SeaMetadata from '@/sea-metadata';
import { useTicketsPage, useMetadata } from '../hooks';
import {
  TICKET_PAGE_SLUG_ID, TICKET_PREDEFINED_COLUMN_CONFIG,
  TICKET_NOT_DISPLAY_COLUMNS, PREDEFINED_TICKET_COLUMN_NAME,
  TICKET_COLUMNS_ORDER_CONFIG, TICKET_COLUMNS_WIDTH_CONFIG,
  TICKET_TABLE_NAME,
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
import { AI_RESOLVE_TYPE } from '@/project/main-panel/ask/constants';
import RelatedIssuesDialog from './related-issues-dialog';
import { isFunction } from '@/utils/type-detection';
import { useData } from '@/project/hooks';

const Tickets = ({
  viewID, canFindRelatedIssues = true, isBuiltInView = false,
  projectUuid, workspaceID, projectName, permission,
  toggleBar, api, localStorageNamePrefix: customizeLocalStorageNamePrefix,
  createContextMenuOptions: customizeCreateContextMenuOptions,
  createRowsTools: customizeCreateRowsTools,
  ...props
}) => {
  const { togglePageSlugId, toggleView, isLoading } = useTicketsPage();
  const { updateAttachments } = useAIChatTools();
  const {
    tagsData, createTag,
    typesData, createType,
    substatesData, createSubstate,
  } = useMetadata();
  const {
    getTableViews, getTableView, insertView, deleteView, modifyView, moveView, duplicateView,
    getMetadata, modifyRow, modifyRows, deleteRow, deleteRows,
  } = useData();

  const metadataRef = useRef(null);

  const [isShowRelatedIssuesDialog, setIsShowRelatedIssuesDialog] = useState(false);
  const [currentTicket, setCurrentTicket] = useState(null);

  const expandRow = useCallback((row) => {
    togglePageSlugId(row._id);
  }, [togglePageSlugId]);

  const metadataAPI = useMemo(() => {
    let _api = {};

    // metadata
    if (isFunction(api.getMetadata)) {
      _api.getMetadata = (...params) => {
        return getMetadata(TICKET_TABLE_NAME, params[0], () => api.getMetadata(...params), isBuiltInView).then(res => {
          const rows = Array.isArray(res.data.tickets) ? res.data.tickets : [];
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
          return {
            data: {
              rows,
              columns,
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
      _api.deleteRows = (ticketIds) => deleteRows(TICKET_TABLE_NAME, ticketIds, () => api.deleteRows(projectUuid, ticketIds));
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
    updateAttachments(tickets, AI_RESOLVE_TYPE.AGENT);
    toggleBar([BAR_TYPE.CHAT]);
  }, [toggleBar, updateAttachments]);

  const findRelatedIssues = useCallback((ticket) => {
    if (!ticket) return;
    setCurrentTicket(ticket);
    setIsShowRelatedIssuesDialog(true);
  }, []);

  const createRowsTools = useCallback((props) => {
    let params = { ...props, projectName, workspaceID, chatTicketsByAI };
    if (canFindRelatedIssues) {
      params.findRelatedIssues = findRelatedIssues;
    }
    if (isFunction(customizeCreateRowsTools)) {
      return customizeCreateRowsTools(params);
    }
    return generatorTicketsRowsTools(params);
  }, [workspaceID, projectName, canFindRelatedIssues, chatTicketsByAI, findRelatedIssues, customizeCreateRowsTools]);

  const createContextMenuOptions = useCallback((props) => {
    let params = { ...props, projectName, workspaceID, chatTicketsByAI };
    if (canFindRelatedIssues) {
      params.findRelatedIssues = findRelatedIssues;
    }
    if (isFunction(customizeCreateContextMenuOptions)) {
      return customizeCreateContextMenuOptions(params);
    }
    return generatorTicketsContextMenuOptions(params);
  }, [projectName, workspaceID, canFindRelatedIssues, chatTicketsByAI, findRelatedIssues, customizeCreateContextMenuOptions]);

  if (isLoading) return (<CenteredLoading />);

  return (
    <>
      <SeaMetadata
        ref={metadataRef}
        viewID={viewID}
        api={metadataAPI}
        t={t}
        fixedColumnCount={2}
        localStorageNamePrefix={localStorageName}
        permission={permission}
        createContextMenuOptions={createContextMenuOptions}
        createRowsTools={createRowsTools}
        expandRow={expandRow}
        toggleView={toggleView}
        cascadeUpdateCells={cascadeUpdate}
        columnOrderRules={TICKET_COLUMNS_ORDER_CONFIG}
        columnWidthRules={TICKET_COLUMNS_WIDTH_CONFIG}
        tagsData={tagsData}
        createTag={createTag}
        toggleAllTags={() => togglePageSlugId(TICKET_PAGE_SLUG_ID.TAGS)}
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
    </>
  );
};

export default Tickets;
