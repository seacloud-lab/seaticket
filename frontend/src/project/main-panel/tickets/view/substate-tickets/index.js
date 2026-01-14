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
  generatorTicketsRowsTools,
  cascadeUpdate, generatorTicketsContextMenuOptions,
} from '../../utils';
import { convertRowToNameValue, convertRowsToNameValue } from '@/sea-metadata/utils/row';
import { AI_RESOLVE_TYPE } from '@/project/main-panel/ask/constants';
import { useAIChatTools } from '@/project/main-panel/ask/hooks';

const SubstateTickets = ({ projectUuid, workspaceID, projectName, toggleBar }) => {

  const { isLoading, pageSlugId, childrenPageSlugId, togglePageSlugId } = useTicketsPage();
  const { substatesData, typesData, tagsData } = useMetadata();

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
      return ticketsAPI.listTicketsBySubstate(projectUuid, childrenPageSlugId).then(res => {
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
      return new Promise((resolve) => {
        resolve({ data: viewsData });
      });
    },

    getView: (viewID) => {
      return new Promise((resolve) => {
        const view = viewsData.views[0];
        resolve({ data: { view: {
          ...view,
          sorts: context.localStorage.getItem('sorts') || [],
        } } });
      });
    },

    modifyView: (viewID, viewData) => {
      return new Promise((resolve) => {
        Object.keys(viewData).forEach(key => {
          context.localStorage.setItem(key, viewData[key]);
        });
        resolve({ data: { success: true } });
      });
    },

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

  }), [projectUuid, childrenPageSlugId, viewsData, togglePageSlugId]);

  const chatTicketsByAI = useCallback((tickets) => {
    updateAttachments(tickets, AI_RESOLVE_TYPE.AGENT);
    toggleBar([BAR_TYPE.CHAT]);
  }, [toggleBar, updateAttachments]);

  const createRowsTools = useCallback((props) => {
    return generatorTicketsRowsTools({ ...props, projectName, workspaceID, chatTicketsByAI });
  }, [workspaceID, projectName, chatTicketsByAI]);

  const createContextMenuOptions = useCallback((props) => {
    return generatorTicketsContextMenuOptions({ ...props, projectName, workspaceID, chatTicketsByAI });
  }, [projectName, workspaceID, chatTicketsByAI]);

  const localStorageName = useMemo(() => `sea-qa-${projectUuid}-substate-tickets`, [projectUuid]);

  const t = useMemo(() => ({
    row: gettext('ticket'),
    rows: gettext('tickets'),
    Rows: gettext('Tickets'),
  }), []);

  if (isLoading) return (<CenteredLoading />);

  const substate = getRowById(substatesData, childrenPageSlugId);
  if (!substate) {
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
      settings={{ isFilterComputedOnServer: false, isSortComputedOnServer: false, canManageView: false }}

      // assist data
      typesData={typesData}
      tagsData={tagsData}

      t={t}
      cascadeUpdateCells={cascadeUpdate}
    />
  );
};

export default SubstateTickets;
