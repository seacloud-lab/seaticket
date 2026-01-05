import React, { useCallback, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { ticketsAPI } from '../../../../api';
import SeaMetadata, { useDataCache } from '@/sea-metadata';
import { useMetadata, useTicketsPage } from '../../hooks';
import {
  TICKET_PAGE_SLUG_ID, TICKET_PREDEFINED_COLUMN_CONFIG,
  TICKET_NOT_DISPLAY_COLUMNS, PREDEFINED_TICKET_COLUMN_NAME,
  TICKET_COLUMNS_ORDER_CONFIG, TICKET_COLUMNS_WIDTH_CONFIG,
} from '../../constants';
import { BAR_TYPE } from '@/project/constants';
import { gettext } from '@/constants';
import { CenteredLoading } from '@/components';
import context from '@/sea-metadata/context';
import {
  generatorTicketsRowsTools,
  cascadeUpdate, generatorTicketsContextMenuOptions,
} from '../../utils';
import { convertRowToNameValue, convertRowsToNameValue } from '@/sea-metadata/utils/row';
import { useAIChatTools } from '@/project/main-panel/ask/hooks';
import { AI_RESOLVE_TYPE } from '@/project/main-panel/ask/constants';
import RelatedIssuesDialog from '../../components/related-issues-dialog';

const AllTickets = ({ projectUuid, workspaceID, projectName, permission, toggleBar }) => {

  const { togglePageSlugId, viewID, toggleView, isLoading } = useTicketsPage();
  const { tagsData, createTag, typesData, createType, substatesData, createSubstate,
    isLoading: isMetadataLoading } = useMetadata();
  const { cachedData, cacheData, clearCacheData } = useDataCache();
  const { updateAttachments } = useAIChatTools();

  const metadataRef = useRef(null);
  const currentTime = useRef(new Date());

  const [isShowRelatedIssuesDialog, setIsShowRelatedIssuesDialog] = useState(false);
  const [currentTicket, setCurrentTicket] = useState(null);

  const expandRow = useCallback((row) => {
    const data = metadataRef.current.getData();
    cacheData(data);
    togglePageSlugId(row._id);
  }, [togglePageSlugId, cacheData]);

  const api = useMemo(() => ({
    getMetadata: (...params) => {
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
      return ticketsAPI.listProjectTickets(projectUuid, ...params).then(res => {
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
    },

    getViews: () => {
      if (cachedData && cachedData.views && dayjs(currentTime.current).diff(cachedData.create_at, 'hours') < 1) {
        return new Promise((resolve, reject) => {
          resolve({
            data: cachedData.views
          });
        });
      }
      return ticketsAPI.listViews(projectUuid);
    },

    // view
    getView: (viewID) => {
      if (cachedData && cachedData.view?._id === viewID && dayjs(currentTime.current).diff(cachedData.create_at, 'hours') < 1) {
        return new Promise((resolve, reject) => {
          resolve({
            data: {
              view: cachedData.view
            }
          });
        });
      }
      return ticketsAPI.getView(projectUuid, viewID);
    },
    insertView: (name, viewData) => ticketsAPI.insertView(projectUuid, name, viewData),
    modifyView: (viewID, viewData) => ticketsAPI.modifyView(projectUuid, viewID, viewData),
    deleteView: (viewID) => ticketsAPI.deleteView(projectUuid, viewID),
    moveView: (sourceViewID, targetViewID) => ticketsAPI.moveView(projectUuid, sourceViewID, targetViewID),
    duplicateView: (viewID) => ticketsAPI.duplicateView(projectUuid, viewID),

    // row
    insertRow: () => togglePageSlugId(TICKET_PAGE_SLUG_ID.NEW),
    modifyRow: (row_id, row_update, isCopyPaste, { data, typesData, tagsData } = {}) => {
      const rowData = convertRowToNameValue(row_update, { data, typesData, tagsData });
      return ticketsAPI.modifyProjectTicket(projectUuid, row_id, rowData, isCopyPaste);
    },
    modifyRows: (rowsUpdate, isCopyPaste, { data, typesData, tagsData } = {}) => {
      const rowsData = convertRowsToNameValue(rowsUpdate, { data, typesData, tagsData });
      return ticketsAPI.modifyProjectTickets(projectUuid, rowsData, isCopyPaste);
    },
    deleteRow: (...params) => ticketsAPI.deleteProjectTicket(projectUuid, ...params),
    deleteRows: (...params) => ticketsAPI.deleteProjectTickets(projectUuid, ...params),

    // file
    uploadFile: (...params) => ticketsAPI.uploadFile(projectUuid, ...params),

  }), [projectUuid, cachedData, clearCacheData]);

  const localStorageName = useMemo(() => `sea-qa-${projectUuid}-tickets`, [projectUuid]);

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
    return generatorTicketsRowsTools({ ...props, projectName, workspaceID, chatTicketsByAI, findRelatedIssues });
  }, [workspaceID, projectName, chatTicketsByAI, findRelatedIssues]);

  const createContextMenuOptions = useCallback((props) => {
    return generatorTicketsContextMenuOptions({ ...props, projectName, workspaceID, chatTicketsByAI, findRelatedIssues });
  }, [projectName, workspaceID, chatTicketsByAI, findRelatedIssues]);

  if (isLoading || isMetadataLoading) return (<CenteredLoading />);

  return (
    <>
      <SeaMetadata
        ref={metadataRef}
        viewID={viewID}
        api={api}
        t={t}
        fixedColumnCount={2}
        localStorageNamePrefix={localStorageName}
        permission={permission}
        createContextMenuOptions={createContextMenuOptions}
        createRowsTools={createRowsTools}
        expandRow={expandRow}
        toggleView={toggleView}
        tagsData={tagsData}
        createTag={createTag}
        toggleAllTags={() => togglePageSlugId(TICKET_PAGE_SLUG_ID.TAGS)}
        typesData={typesData}
        createType={createType}
        toggleAllTypes={() => togglePageSlugId(TICKET_PAGE_SLUG_ID.TYPES)}
        substatesData={substatesData}
        createSubstate={createSubstate}
        toggleAllSubstates={() => togglePageSlugId(TICKET_PAGE_SLUG_ID.SUBSTATES)}
        cascadeUpdateCells={cascadeUpdate}
        columnOrderRules={TICKET_COLUMNS_ORDER_CONFIG}
        columnWidthRules={TICKET_COLUMNS_WIDTH_CONFIG}
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

export default AllTickets;
