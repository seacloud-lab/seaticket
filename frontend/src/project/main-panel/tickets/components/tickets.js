import React, { useCallback, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { ticketsAPI } from '../../../api';
import SeaMetadata, { useDataCache } from '@/sea-metadata';
import { useTicketsPage, useMetadata } from '../hooks';
import {
  TICKET_PAGE_SLUG_ID, TICKET_PREDEFINED_COLUMN_CONFIG,
  TICKET_NOT_DISPLAY_COLUMNS, PREDEFINED_TICKET_COLUMN_NAME,
  TICKET_COLUMNS_ORDER_CONFIG, TICKET_COLUMNS_WIDTH_CONFIG,
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

const Tickets = ({
  viewID, canFindRelatedIssues = true,
  projectUuid, workspaceID, projectName, permission,
  toggleBar, api, localStorageNamePrefix: customizeLocalStorageNamePrefix,
  createContextMenuOptions: customizeCreateContextMenuOptions,
  createRowsTools: customizeCreateRowsTools,
  ...props
}) => {
  const { togglePageSlugId, toggleView, isLoading } = useTicketsPage();
  const { cachedData, cacheData, clearCacheData } = useDataCache();
  const { updateAttachments } = useAIChatTools();
  const {
    tagsData, createTag,
    typesData, createType,
    substatesData, createSubstate,
  } = useMetadata();

  const metadataRef = useRef(null);
  const currentTime = useRef(new Date());

  const [isShowRelatedIssuesDialog, setIsShowRelatedIssuesDialog] = useState(false);
  const [currentTicket, setCurrentTicket] = useState(null);

  const expandRow = useCallback((row) => {
    const data = metadataRef.current.getData();
    cacheData(data);
    togglePageSlugId(row._id);
  }, [togglePageSlugId, cacheData]);

  const metadataAPI = useMemo(() => {
    let _api = {};

    // metadata
    if (isFunction(api.getMetadata)) {
      _api.getMetadata = (...params) => {
        const { view_id } = params[0];
        if (cachedData && cachedData.view?._id === view_id && dayjs(currentTime.current).diff(cachedData.create_at, 'hours') < 1) {
          return new Promise((resolve, reject) => {
            const rows = cachedData.rows;
            const columns = cachedData.columns;
            const typeColum = columns.find(c => c.name === PREDEFINED_TICKET_COLUMN_NAME.TYPE);
            if (typeColum) {
              context.setSetting('typeColumnKey', typeColum.key);
            }
            const stateColumn = columns.find(c => c.name === PREDEFINED_TICKET_COLUMN_NAME.STATE);
            if (stateColumn) {
              context.setSetting('stateColumnKey', stateColumn.key);
            }
            const tagsColumn = columns.find(c => c.name === PREDEFINED_TICKET_COLUMN_NAME.TYPE.TAGS);
            if (tagsColumn) {
              context.setSetting('tagsColumnKey', tagsColumn.key);
            }
            resolve({
              data: {
                rows: rows,
                columns: columns,
              }
            });
          }).then(res => {
            clearCacheData();
            return res;
          });
        }
        return api.getMetadata(...params).then(res => {
          const rows = Array.isArray(res.data.tickets) ? res.data.tickets : [];
          let columns = res?.data?.columns || [];
          const othersConfig = {
            'title': { click: (row) => togglePageSlugId(row._id) },
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
          clearCacheData();
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
      _api.getViews = () => {
        if (cachedData && cachedData.views && dayjs(currentTime.current).diff(cachedData.create_at, 'hours') < 1) {
          return new Promise((resolve, reject) => {
            resolve({
              data: cachedData.views
            });
          });
        }
        return api.getViews();
      };
    }
    if (isFunction(api.getView)) {
      _api.getView = (viewID) => {
        if (cachedData && cachedData.view?._id === viewID && dayjs(currentTime.current).diff(cachedData.create_at, 'hours') < 1) {
          return new Promise((resolve, reject) => {
            resolve({
              data: {
                view: cachedData.view
              }
            });
          });
        }
        return api.getView(viewID);
      };
    }
    if (isFunction(api.insertView)) {
      _api.insertView = (name, viewData) => api.insertView(name, viewData);
    }
    if (isFunction(api.modifyView)) {
      _api.modifyView = (viewID, viewData) => api.modifyView(viewID, viewData);
    }
    if (isFunction(api.deleteView)) {
      _api.deleteView = (viewID) => api.deleteView(viewID);
    }
    if (isFunction(api.moveView)) {
      _api.moveView = (sourceViewID, targetViewID) => api.moveView(sourceViewID, targetViewID);
    }
    if (isFunction(api.duplicateView)) {
      _api.duplicateView = (viewID) => api.duplicateView(viewID);
    }

    // row
    _api.insertRow = () => togglePageSlugId(TICKET_PAGE_SLUG_ID.NEW);
    if (isFunction(api.modifyRow)) {
      _api.modifyRow = (row_id, row_update, isCopyPaste, { data, typesData, tagsData } = {}) => {
        const rowData = convertRowToNameValue(row_update, { data, typesData, tagsData });
        return api.modifyRow(row_id, rowData, isCopyPaste);
      };
    }
    if (isFunction(api.modifyRows)) {
      _api.modifyRows = (rowsUpdate, isCopyPaste, { data, typesData, tagsData } = {}) => {
        const rowsData = convertRowsToNameValue(rowsUpdate, { data, typesData, tagsData });
        return api.modifyRows(rowsData, isCopyPaste);
      };
    }
    if (isFunction(api.deleteRow)) {
      _api.deleteRow = (...params) => api.deleteRow(...params);
    }
    if (isFunction(api.deleteRows)) {
      _api.deleteRows = (...params) => api.deleteRows(...params);
    }

    // file
    _api.uploadFile = (...params) => ticketsAPI.uploadFile(projectUuid, ...params);

    return _api;
  }, [projectUuid, cachedData, clearCacheData, api]);

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
