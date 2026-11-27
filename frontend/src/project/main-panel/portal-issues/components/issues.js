import React, { useCallback, useMemo, useRef, useState } from 'react';
import { CenteredLoading } from '@/components';
import { gettext } from '@/constants';
import { portalAPI } from '@/portal/api';
import ResourceDetailsDialog from '@/project/components/resource-details-dialog';
import { useData, useTags } from '@/project/hooks';
import { useLinkedTicketUpdate, useLinkTicket } from '@/project/hooks/link-ticket';
import { useResourceUpdate } from '@/project/hooks/resource-dialog';
import { useAIChatTools } from '@/project/main-panel/ask/hooks';
import SeaMetadata from '@/sea-metadata';
import { EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import context from '@/sea-metadata/context';
import { convertRowToNameValue, convertRowsToNameValue } from '@/sea-metadata/utils/row';
import { isFunction } from '@/utils/type-detection';
import { ticketsAPI } from '../../../api';
import {
  PORTAL_ISSUE_PAGE_SLUG_ID, PORTAL_ISSUE_PREDEFINED_COLUMN_CONFIG,
  PORTAL_ISSUE_NOT_DISPLAY_COLUMNS, PREDEFINED_PORTAL_ISSUE_COLUMN_NAME,
  PORTAL_ISSUE_COLUMNS_ORDER_CONFIG, PORTAL_ISSUE_COLUMNS_WIDTH_CONFIG,
  PORTAL_ISSUE_TABLE_NAME, PORTAL_ISSUE_TYPE,
} from '../constants';
import { usePortalIssuesMetadata } from '../hooks';
import {
  generatorIssuesRowsTools,
  cascadeUpdate, generatorIssuesContextMenuOptions,
} from '../utils';

const Issues = ({
  canCreateRelatedTickets = true, isBuiltInView = false, canOpenIssue = true, canChatWithAI = false, isShowViewInURL = true,
  isShowCustomer = true,
  projectUuid, workspaceID, projectName, permission,
  api,
  localStorageNamePrefix: customizeLocalStorageNamePrefix,
  createContextMenuOptions: customizeCreateContextMenuOptions,
  createRowsTools: customizeCreateRowsTools,
  togglePageSlugId = () => {},
  isLoading = false,
  settings = {},
  getIssue = (uuid, issueNumber) => portalAPI.getPortalIssue(uuid, issueNumber),
  onRefresh,
  onCustomViewRowClick,
  useCache = true,
  ...props
}) => {
  const { handleResolveAttachmentsByAI } = useAIChatTools();
  const {
    typesData, createType,
    substatesData, createSubstate,
    customersData,
  } = usePortalIssuesMetadata();
  const { tagsData, createTag } = useTags();
  const {
    getTableViews, getTableView, insertView, deleteView, modifyView, moveView, duplicateView,
    getMetadata, modifyRow, modifyRows, deleteRow, deleteRows,
  } = useData();

  const { createTicket, linkAnExistingTicket } = useLinkTicket();

  const metadataRef = useRef(null);
  const allColumns = useRef([]);

  useLinkedTicketUpdate({
    projectUuid,
    tableName: PORTAL_ISSUE_TABLE_NAME,
    onUpdate: ({ rowId, rowUpdateData, linkedRecords }) => {
      context.eventBus.dispatch(EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, rowId, rowUpdateData);
      context.eventBus.dispatch(EVENT_BUS_TYPE.UPDATE_DATA_ATTRIBUTE, { linked_records: linkedRecords }, false);
    },
  });

  const [currentIssue, setCurrentIssue] = useState(null);
  const [isShowIssueDetailsDialog, setIsShowIssueDetailsDialog] = useState(false);

  const handleExpandRow = useCallback((issue) => {
    setCurrentIssue({ ...issue, type: PORTAL_ISSUE_TYPE });
    setIsShowIssueDetailsDialog(true);
  }, []);

  useResourceUpdate({ projectUuid, tableName: PORTAL_ISSUE_TABLE_NAME, onUpdate: ({ rowId, rowUpdateData, deleted, updateList = true }) => {
    if (!updateList) return;
    if (deleted) {
      context.eventBus.dispatch(EVENT_BUS_TYPE.DELETE_ROWS, [rowId]);
    } else if (rowUpdateData) {
      context.eventBus.dispatch(EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, rowId, rowUpdateData);
    }
  } });

  const metadataAPI = useMemo(() => {
    let _api = {};

    // metadata
    if (isFunction(api.getMetadata)) {
      _api.getMetadata = (...params) => {
        return getMetadata(PORTAL_ISSUE_TABLE_NAME, { ...params[0], use_cache: useCache }, () => api.getMetadata(...params).then(res => {
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
          const typeColumn = columns.find(c => c.name === PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.TYPE);
          if (typeColumn) {
            context.setSetting('typeColumnKey', typeColumn.key);
            if (isBuiltInView) {
              typeColumn.modify_data_able = false;
            }
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
  }, [
    projectUuid, isBuiltInView, api, getTableViews, getTableView, insertView, deleteView, modifyView, moveView, duplicateView, useCache,
    getMetadata, modifyRow, modifyRows, deleteRow, deleteRows, togglePageSlugId,
  ]);

  const localStorageName = useMemo(() => customizeLocalStorageNamePrefix || `seaqa-${projectUuid}-issues`, [projectUuid, customizeLocalStorageNamePrefix]);

  const t = useMemo(() => {
    return {
      row: gettext('issue'),
      rows: gettext('issues'),
      Row: gettext('Issue'),
      Rows: gettext('Issues'),
    };
  }, []);

  const createRowsTools = useCallback(({ columns, ...props }) => {
    let params = { ...props, columns, projectName, workspaceID, togglePageSlugId };
    if (canCreateRelatedTickets) {
      params.createTicket = createTicket;
      params.linkAnExistingTicket = linkAnExistingTicket;
    }
    if (canChatWithAI) {
      params.chatIssuesByAI = handleResolveAttachmentsByAI;
    }
    if (isFunction(customizeCreateRowsTools)) {
      return customizeCreateRowsTools(params);
    }
    return generatorIssuesRowsTools(params);
  }, [
    workspaceID, projectName, canCreateRelatedTickets, canChatWithAI,
    handleResolveAttachmentsByAI, createTicket, customizeCreateRowsTools, togglePageSlugId,
    linkAnExistingTicket,
  ]);

  const createContextMenuOptions = useCallback((props) => {
    let params = { ...props, projectName, workspaceID, togglePageSlugId };
    if (canCreateRelatedTickets) {
      params.createTicket = createTicket;
      params.linkAnExistingTicket = linkAnExistingTicket;
    }
    if (canChatWithAI) {
      params.chatIssuesByAI = handleResolveAttachmentsByAI;
    }

    if (isFunction(customizeCreateContextMenuOptions)) {
      return customizeCreateContextMenuOptions(params);
    }
    return generatorIssuesContextMenuOptions(params);
  }, [
    projectName, workspaceID, canCreateRelatedTickets, canChatWithAI,
    handleResolveAttachmentsByAI, createTicket, customizeCreateContextMenuOptions, togglePageSlugId,
    linkAnExistingTicket,
  ]);

  const createMoreOptions = useCallback((row, _details, options) => {
    return metadataRef.current?.createMoreOptions(row, options) || [];
  }, []);

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

  if (isLoading) return (<CenteredLoading />);

  return (
    <>
      <SeaMetadata
        className="seaqa-issues-metadata"
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
        onCustomViewRowClick={onCustomViewRowClick}
        cascadeUpdateCells={cascadeUpdate}
        columnOrderRules={PORTAL_ISSUE_COLUMNS_ORDER_CONFIG}
        columnWidthRules={PORTAL_ISSUE_COLUMNS_WIDTH_CONFIG}
        tagsData={tagsData}
        createTag={createTag}
        typesData={typesData}
        createType={createType}
        customersData={customersData}
        toggleAllTypes={() => togglePageSlugId(PORTAL_ISSUE_PAGE_SLUG_ID.TYPES)}
        substatesData={substatesData}
        createSubstate={createSubstate}
        toggleAllSubstates={() => togglePageSlugId(PORTAL_ISSUE_PAGE_SLUG_ID.SUBSTATES)}
        settings={{ ...settings, canClearCells: false, canPasteCells: false, canDragFillCells: false }}
        { ...props }
      />
      {isShowIssueDetailsDialog && (
        <ResourceDetailsDialog
          projectUuid={projectUuid}
          resource={currentIssue}
          permission={permission}
          canCreateRelatedTickets={canCreateRelatedTickets}
          canChatWithAI={canChatWithAI}
          canOpenIssue={canOpenIssue}
          isReadonly={isBuiltInView}
          columns={allColumns.current}
          switchResource={handleSwitchIssue}
          onToggle={() => setIsShowIssueDetailsDialog(false)}
          getIssue={getIssue}
          createMoreOptions={createMoreOptions}
          isShowCustomer={isShowCustomer}
        />
      )}
    </>
  );
};

export default Issues;
