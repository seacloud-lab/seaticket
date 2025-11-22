import React, { useCallback, useMemo } from 'react';
import copy from 'copy-to-clipboard';
import { ticketsAPI } from '../../../../api';
import SeaMetadata, { VIEW_TOOL } from '@/sea-metadata';
import context from '@/sea-metadata/context';
import { useTags, useTypes, useTicketsPage, useSubstates } from '../../hooks';
import { BAR_TYPE } from '../../../../constants';
import { TICKET_PAGE_TYPE, TICKET_CHILDREN_PAGE_TYPE, TICKET_NOT_DISPLAY_COLUMNS, TICKET_PREDEFINED_COLUMN_CONFIG } from '../../constants';
import { gettext } from '@/constants';
import { toaster } from '@/components';
import { getRowById } from '@/sea-metadata/utils/row';
import { generatorRowCopyLinkTool, generatorRowsMoreTool } from '../../utils';

const TagTickets = ({ projectUuid, workspaceID, projectName, permission }) => {

  const { isLoading, pageType, childrenPageType, togglePageType } = useTicketsPage();
  const { isLoading: isTagsLoading, tagsData, createTag } = useTags();
  const { typesData, createType } = useTypes();
  const { substatesData, createSubstate } = useSubstates();

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
      return ticketsAPI.listTicketsByTag(projectUuid, childrenPageType).then(res => {
        const rows = Array.isArray(res.data.tickets) ? res.data.tickets : [];
        let columns = res?.data?.columns || [];
        const othersConfig = {
          'title': { click: (row) => togglePageType(row._id) },
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
    insertRow: () => togglePageType(TICKET_PAGE_TYPE.NEW),
    modifyRow: (...params) => ticketsAPI.modifyProjectTicket(projectUuid, ...params),
    modifyRows: (...params) => ticketsAPI.modifyProjectTickets(projectUuid, ...params),
    deleteRow: (...params) => ticketsAPI.deleteProjectTicket(projectUuid, ...params),
    deleteRows: (...params) => ticketsAPI.deleteProjectTickets(projectUuid, ...params),

    // file
    uploadFile: (...params) => ticketsAPI.uploadFile(projectUuid, ...params),

  }), [projectUuid, childrenPageType, viewsData, togglePageType]);

  const createRowsTools = useCallback(({ rows, modifyRows }) => {
    let tools = [];
    if (rows.length === 1) {
      const row = rows[0];
      const tool = generatorRowCopyLinkTool({ row, workspaceID, projectName });
      tools.push(tool);
    }
    const moreTool = generatorRowsMoreTool({ rows, modifyRows });
    tools.push(moreTool);
    return tools;
  }, [workspaceID, projectName]);

  const createContextMenuOptions = useCallback(({
    isGroupView,
    selectedRange,
    selectedPosition,
    position,
    table,
    rowMetrics,
    deleteRows,
    hideMenu,
    onClearSelected,
    onCopySelected,
    rowGetterByIndex,
    selectNone,
    context,
  }) => {
    let list = [];

    // handle selected multiple cells
    if (selectedRange) {
      if (context.canModify()) {
        list.push({
          label: gettext('Clear selected'),
          callback: onClearSelected,
        });
      }
      list.push({
        label: gettext('Copy selected'),
        callback: onCopySelected,
      });

      if (context.canDeleteRow()) {
        const { topLeft, bottomRight } = selectedRange;
        let rows = [];
        for (let i = topLeft.rowIdx; i <= bottomRight.rowIdx; i++) {
          const row = rowGetterByIndex({ isGroupView, groupRowIndex: topLeft.groupRowIndex, rowIndex: i });
          if (row) {
            rows.push(row);
          }
        }
        if (rows.length > 0) {
          list.push({
            label: gettext('Delete selected'),
            rows: rows,
            callback: (event, { rows }) => {
              const rowIds = rows.map(row => row._id);
              deleteRows && deleteRows(rowIds);
            }
          });
        }
      }
      return list;
    }

    // handle selected rows
    const selectedRowIds = rowMetrics ? Object.keys(rowMetrics.idSelectedRowMap) : [];
    if (selectedRowIds.length > 1) {
      let rows = [];
      selectedRowIds.forEach(id => {
        const row = table.id_row_map[id];
        if (row) {
          rows.push(row);
        }
      });

      if (context.canDeleteRow() && rows.length > 0) {
        list.push({
          label: gettext('Delete tickets'),
          callback: (event) => {
            const rowIds = rows.map(row => row._id);
            deleteRows && deleteRows(rowIds);
          }
        });
      }
      return list;
    }

    // handle selected cell
    if (!selectedPosition) return list;
    const { groupRowIndex, rowIdx: rowIndex } = selectedPosition;
    const row = rowGetterByIndex({ isGroupView, groupRowIndex, rowIndex }) || table.id_row_map[selectedRowIds[0]];
    if (!row) return list;
    list.push({
      label: gettext('Open ticket'),
      callback: () => togglePageType(row._id),
    });

    list.push('Divider');

    if (context.canDeleteRow()) {
      list.push({
        label: gettext('Delete ticket'),
        callback: () => deleteRows && deleteRows([row._id])
      });
    }
    list.push({
      label: gettext('Copy link'),
      callback: () => {
        const { origin } = location;
        let url = `${origin}/workspace/${workspaceID}/project/${projectName}/${BAR_TYPE.TICKET}/${row._id}/`;
        copy(url);
        toaster.success(gettext('The ticket link has been copied'));
      }
    });
    return list;
  }, [projectName, workspaceID]);

  const localStorageName = useMemo(() => `sea-qa-${projectUuid}-tag-tickets`, [projectUuid]);

  const t = useMemo(() => {
    return {
      row: gettext('ticket'),
      rows: gettext('tickets'),
      Row: gettext('Ticket'),
      Rows: gettext('Tickets'),
    };
  }, []);

  if (isLoading || isTagsLoading) return null;
  const tag = getRowById(tagsData, childrenPageType);
  if (!tag) {
    togglePageType(pageType, TICKET_CHILDREN_PAGE_TYPE.ALL);
    return null;
  }

  return (
    <SeaMetadata
      viewID="0000"
      api={api}
      isViewComputedOnServer={false}
      permission={permission}
      localStorageNamePrefix={localStorageName}
      createContextMenuOptions={createContextMenuOptions}
      expandRow={(row) => togglePageType(row._id)}
      viewTools={[VIEW_TOOL.ROWS_TOOLS, VIEW_TOOL.SEARCH, VIEW_TOOL.SORTS]}
      createRowsTools={createRowsTools}

      // tags
      tagsData={tagsData}
      createTag={createTag}
      toggleAllTags={() => togglePageType(TICKET_PAGE_TYPE.TAGS)}

      typesData={typesData}
      createType={createType}
      toggleAllTypes={() => togglePageType(TICKET_PAGE_TYPE.TYPES)}

      substatesData={substatesData}
      createSubstate={createSubstate}
      toggleAllSubstates={() => togglePageType(TICKET_PAGE_TYPE.SUBSTATES)}

      t={t}
    />
  );
};

export default TagTickets;
