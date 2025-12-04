import React, { useCallback, useMemo } from 'react';
import { ticketsAPI } from '../../../../api';
import SeaMetadata, { VIEW_TOOL } from '@/sea-metadata';
import context from '@/sea-metadata/context';
import { useTicketsPage, useMetadata } from '../../hooks';
import { TICKET_PAGE_SLUG_ID, TICKET_CHILDREN_PAGE_SLUG_ID, TICKET_NOT_DISPLAY_COLUMNS, TICKET_PREDEFINED_COLUMN_CONFIG } from '../../constants';
import { gettext } from '@/constants';
import { CenteredLoading } from '@/components';
import { getRowById } from '@/sea-metadata/utils/row';
import { BAR_TYPE } from '@/project/constants/bar';
import {
  generatorRowCopyLinkTool, generatorRowsMoreTool,
  convertRowToServerData, convertRowsToServerData,
  cascadeUpdateSubState, generatorTicketsContextMenuOptions
} from '../../utils';
import { AI_RESOLVE_TYPE } from '@/project/main-panel/ask/constants';
import { useAIChatTools } from '@/project/main-panel/ask/hooks';

const TypeTickets = ({ projectUuid, workspaceID, projectName, toggleBar }) => {

  const { isLoading, pageSlugId, childrenPageSlugId, togglePageSlugId } = useTicketsPage();
  const { isLoading: isMetadataLoading, typesData, createType, tagsData } = useMetadata();

  const { updateAttachments } = useAIChatTools();

  const viewsData = useMemo(() => ({
    navigation: [{ _id: '0000', type: 'view' }],
    views: [
      {
        _id: '0000',
        name: gettext('All'),
      }
    ]
  }), []);

  const api = useMemo(() => ({
    getMetadata: (...params) => {
      return ticketsAPI.listTicketsByType(projectUuid, childrenPageSlugId).then(res => {
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
        return {
          data: {
            rows,
            columns,
          }
        };
      });
    },

    // view
    getViews: () => {
      return new Promise((resolve, reject) => {
        resolve({ data: viewsData });
      });
    },

    getView: (viewID) => {
      return new Promise((resolve, reject) => {
        const view = viewsData.views[0];

        resolve({ data: { view: {
          ...view,
          sorts: context.localStorage.getItem('sorts') || [],
        } } });
      });
    },

    modifyView: (viewID, viewData) => {
      return new Promise((resolve, reject) => {
        Object.keys(viewData).forEach(key => {
          context.localStorage.setItem(key, viewData[key]);
        });
        resolve({ data: { success: true } });
      });
    },

    // row
    insertRow: () => togglePageSlugId(TICKET_PAGE_SLUG_ID.NEW),
    modifyRow: (row_id, row_update, isCopyPaste, { data, typesData, tagsData } = {}) => {
      const rowData = convertRowToServerData(row_update, { data, typesData, tagsData });
      return ticketsAPI.modifyProjectTicket(projectUuid, row_id, rowData, isCopyPaste);
    },
    modifyRows: (rowsUpdate, isCopyPaste, { data, typesData, tagsData } = {}) => {
      const rowsData = convertRowsToServerData(rowsUpdate, { data, typesData, tagsData });
      return ticketsAPI.modifyProjectTickets(projectUuid, rowsData, isCopyPaste);
    },
    deleteRows: (...params) => ticketsAPI.deleteProjectTickets(projectUuid, ...params),

    // file
    uploadFile: (...params) => ticketsAPI.uploadFile(projectUuid, ...params),

  }), [projectUuid, childrenPageSlugId, viewsData, togglePageSlugId]);

  const chatTicketsByAI = useCallback((tickets) => {
    updateAttachments(tickets, AI_RESOLVE_TYPE.AGENT);
    toggleBar([BAR_TYPE.CHAT]);
  }, [toggleBar, updateAttachments]);

  const createRowsTools = useCallback(({ rows, columns, modifyRows }) => {
    let tools = [];
    if (rows.length === 1) {
      const row = rows[0];
      const tool = generatorRowCopyLinkTool({ row, workspaceID, projectName });
      tools.push(tool);
    }
    const moreTool = generatorRowsMoreTool({ rows, columns, modifyRows, chatTicketsByAI });
    tools.push(moreTool);
    return tools;
  }, [workspaceID, projectName, chatTicketsByAI]);

  const createContextMenuOptions = useCallback((props) => {
    return generatorTicketsContextMenuOptions({ ...props, projectName, workspaceID, chatTicketsByAI });
  }, [projectName, workspaceID, chatTicketsByAI]);

  const localStorageName = useMemo(() => `sea-qa-${projectUuid}-type-tickets`, [projectUuid]);

  const t = useMemo(() => {
    return {
      row: gettext('ticket'),
      rows: gettext('tickets'),
      Rows: gettext('Tickets'),
    };
  }, []);

  if (isLoading || isMetadataLoading) return (<CenteredLoading />);
  const type = getRowById(typesData, childrenPageSlugId);
  if (!type) {
    togglePageSlugId(pageSlugId, TICKET_CHILDREN_PAGE_SLUG_ID.ALL);
    return null;
  }

  return (
    <SeaMetadata
      viewID="0000"
      api={api}
      localStorageNamePrefix={localStorageName}
      createRowsTools={createRowsTools}
      createContextMenuOptions={createContextMenuOptions}
      expandRow={(row) => togglePageSlugId(row._id)}
      toggleView={() => {}}
      viewTools={[VIEW_TOOL.SEARCH, VIEW_TOOL.SORTS]}
      isViewComputedOnServer={false}

      // types
      typesData={typesData}
      createType={createType}

      tagsData={tagsData}

      t={t}
      cascadeUpdateCells={cascadeUpdateSubState}
    />
  );
};

export default TypeTickets;
