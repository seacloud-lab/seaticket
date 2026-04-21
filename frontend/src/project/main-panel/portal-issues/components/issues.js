import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ticketsAPI } from '../../../api';
import { portalAPI } from '@/portal/api';
import SeaMetadata from '@/sea-metadata';
import { usePortalIssuesMetadata } from '../hooks';
import {
  PORTAL_ISSUE_PAGE_SLUG_ID, PORTAL_ISSUE_PREDEFINED_COLUMN_CONFIG,
  PORTAL_ISSUE_NOT_DISPLAY_COLUMNS, PREDEFINED_PORTAL_ISSUE_COLUMN_NAME,
  PORTAL_ISSUE_COLUMNS_ORDER_CONFIG, PORTAL_ISSUE_COLUMNS_WIDTH_CONFIG,
  PORTAL_ISSUE_TABLE_NAME, PORTAL_ISSUE_TYPE, AUTO_UPDATE_PARTICIPANTS_KEY,
} from '../constants';
import { BAR_TYPE } from '@/project/constants';
import { gettext } from '@/constants';
import { CenteredLoading } from '@/components';
import context from '@/sea-metadata/context';
import toaster from '@/components/toaster';
import {
  generatorIssuesRowsTools,
  cascadeUpdate, generatorIssuesContextMenuOptions,
} from '../utils';
import { convertRowToNameValue, convertRowsToNameValue } from '@/sea-metadata/utils/row';
import { useAIChatTools } from '@/project/main-panel/ask/hooks';
// import RelatedIssuesDialog from './related-issues-dialog';
import { isFunction } from '@/utils/type-detection';
import { useData, useTags } from '@/project/hooks';
import ResourceDetailsDialog from '@/project/components/resource-details-dialog';

const Issues = ({
  viewID,
  canFindRelatedIssues = true, isBuiltInView = false,
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
    getMetadata, modifyRow, modifyRows, deleteRow, deleteRows,
  } = useData();

  const metadataRef = useRef(null);
  const allColumns = useRef([]);

  const [isShowRelatedIssuesDialog, setIsShowRelatedIssuesDialog] = useState(false);
  const [currentIssue, setCurrentIssue] = useState(null);
  const [isShowIssueDetailsDialog, setIsShowIssueDetailsDialog] = useState(false);

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
              linked_records: res.data?.linked_record_titles || {},
            }
          };
        }), isBuiltInView).then(res => {
          const rows = Array.isArray(res.data.tickets) ? res.data.tickets : [];
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
        if (row_update[AUTO_UPDATE_PARTICIPANTS_KEY]) {
          delete rowData[PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.PARTICIPANTS];
        }
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

  const chatIssuesByAI = useCallback((tickets) => {
    updateAttachments(tickets);
    toggleBar([BAR_TYPE.CHAT]);
  }, [toggleBar, updateAttachments]);

  const findRelatedIssues = useCallback((ticket) => {
    if (!ticket) return;
    setCurrentIssue(ticket);
    setIsShowRelatedIssuesDialog(true);
  }, []);

  const createRowsTools = useCallback((props) => {
    let params = { ...props, projectName, workspaceID, chatIssuesByAI, togglePageSlugId };
    if (canFindRelatedIssues) {
      params.findRelatedIssues = findRelatedIssues;
    }
    if (isFunction(customizeCreateRowsTools)) {
      return customizeCreateRowsTools(params);
    }
    return generatorIssuesRowsTools(params);
  }, [workspaceID, projectName, canFindRelatedIssues, chatIssuesByAI, findRelatedIssues, customizeCreateRowsTools, togglePageSlugId]);

  const createContextMenuOptions = useCallback((props) => {
    let params = { ...props, projectName, workspaceID, chatIssuesByAI, togglePageSlugId };
    if (canFindRelatedIssues) {
      params.findRelatedIssues = findRelatedIssues;
    }
    if (isFunction(customizeCreateContextMenuOptions)) {
      return customizeCreateContextMenuOptions(params);
    }
    return generatorIssuesContextMenuOptions(params);
  }, [projectName, workspaceID, canFindRelatedIssues, chatIssuesByAI, findRelatedIssues, customizeCreateContextMenuOptions, togglePageSlugId]);

  const createMoreOptions = useCallback((resource) => {
    const row = resource;
    return generatorIssuesContextMenuOptions({
      isGroupView: false,
      selectedPosition: { groupRowIndex: 0, rowIdx: 0 },
      table: { id_row_map: { [row._id]: row }, columns: allColumns.current },
      rowMetrics: { idSelectedRowMap: {} },
      deleteRow: (rowId) => {
        metadataAPI.deleteRow(rowId);
        setIsShowIssueDetailsDialog(false);
        toaster.success(context.translate('{Row} deleted'));
        onRefresh();
      },
      rowGetterByIndex: () => row,
      context,
      chatIssuesByAI,
      togglePageSlugId,
      workspaceID,
      projectName,
      findRelatedIssues: canFindRelatedIssues ? findRelatedIssues : undefined,
    });
  }, [workspaceID, projectName, canFindRelatedIssues, chatIssuesByAI, findRelatedIssues, togglePageSlugId, metadataAPI]);

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

  const onCloseRelatedIssuesDialog = useCallback(() => {
    setIsShowRelatedIssuesDialog(false);
    if (isShowIssueDetailsDialog) return;
    setCurrentIssue(null);
  }, [isShowIssueDetailsDialog]);

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
      {/* {isShowRelatedIssuesDialog && currentIssue && (
        <RelatedIssuesDialog
          projectUuid={projectUuid}
          ticketId={currentIssue._id}
          workspaceID={workspaceID}
          projectName={projectName}
          onClose={onCloseRelatedIssuesDialog}
        />
      )} */}
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
    </>
  );
};

export default Issues;
