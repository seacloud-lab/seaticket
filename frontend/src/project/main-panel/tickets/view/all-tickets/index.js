import React, { useCallback, useMemo } from 'react';
import copy from 'copy-to-clipboard';
import { ticketsAPI } from '../../../../api';
import SeaMetadata, { CellType } from '@/sea-metadata';
import { useTags, useTicketsPage } from '../../hooks';
import { TICKET_PAGE_TYPE, TICKET_TYPES, TICKET_STATUS_OPTIONS, TICKET_STATUS } from '../../../../constants';
import { TicketForTickets } from '../../models';
import { gettext } from '@/constants';
import context from '@/sea-metadata/context';
import { toaster } from '@/components';

import './index.css';

const AllTickets = ({ projectUuid, projectName }) => {

  const { togglePageType, viewID, updateViewID } = useTicketsPage();
  const { tagsData, createTag } = useTags();

  const columns = useMemo(() => [
    { type: CellType.TEXT, key: 'title', name: gettext('Title'), editable: true, is_name_column: true, frozen: true, is_required: true, expand_able: true },
    { type: CellType.SINGLE_SELECT, key: 'status', name: gettext('Status'), editable: true, data: { options: TICKET_STATUS_OPTIONS }, is_required: true },
    { type: CellType.SINGLE_SELECT, key: 'type', name: gettext('Type'), editable: true, data: { options: TICKET_TYPES } },
    { type: CellType.LONG_TEXT, key: 'content', name: gettext('Content'), editable: true, is_required: true },
    { type: CellType.COLLABORATOR, key: 'assignees', name: gettext('Assignees'), editable: true },
    { type: CellType.TAGS, key: 'tags', name: gettext('Tags'), editable: true, modify_data_able: true },
    { type: CellType.NUMBER, key: 'reply_count', name: gettext('Reply count'), editable: false, data: { format: 'number' } },
    { type: CellType.COLLABORATOR, key: 'participants', name: gettext('Participants'), editable: false },
    { type: CellType.CTIME, key: 'created_at', name: gettext('Create time'), editable: false },
    { type: CellType.CREATOR, key: 'creator', name: gettext('Creator'), editable: false },
  ], []);

  const views = useMemo(() => [
    {
      _id: 'open',
      name: gettext('Open'),
      basic_filters: [
        { column_key: 'status', filter_predicate: 'is', filter_term: TICKET_STATUS.OPEN }
      ]
    }, {
      _id: 'closed',
      name: gettext('Closed'),
      basic_filters: [
        { column_key: 'status', filter_predicate: 'is_not', filter_term: TICKET_STATUS.OPEN }
      ]
    }
  ], []);

  const api = useMemo(() => ({
    getMetadata: (...params) => {
      return ticketsAPI.listProjectTickets(projectUuid, ...params).then(res => {
        const rows = Array.isArray(res.data.tickets) ? res.data.tickets.map(t => new TicketForTickets(t)) : [];
        return {
          data: {
            rows,
            columns,
          }
        };
      });
    },

    getViews: () => {
      return new Promise((resolve, reject) => {
        resolve({ data: { views } });
      });
    },

    // view
    getView: (viewID) => {
      return new Promise((resolve, reject) => {
        const view = views.find(v => v._id === viewID) || views[0];
        updateViewID(view._id);

        resolve({ data: {
          view: {
            ...view,
            columns_keys: context.localStorage.getItem('columns_keys') || [],
            filter_conjunction: context.localStorage.getItem('filter_conjunction') || 'Or',
            filters: context.localStorage.getItem('filters') || [],
            sorts: context.localStorage.getItem('sorts') || [],
            groupbys: context.localStorage.getItem('groupbys') || [],
            hidden_columns: context.localStorage.getItem('hidden_columns') || [],
          }
        } });
      });
    },

    // row
    insertRow: () => togglePageType(TICKET_PAGE_TYPE.NEW),
    modifyRow: (...params) => ticketsAPI.modifyProjectTicket(projectUuid, ...params),
    deleteRow: (...params) => ticketsAPI.deleteProjectTicket(projectUuid, ...params),

    // file
    uploadFile: (...params) => ticketsAPI.uploadFile(projectUuid, ...params),

  }), [projectUuid, views, columns, updateViewID]);

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

      if (context.checkCanDeleteRow()) {
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

      if (context.checkCanDeleteRow() && rows.length > 0) {
        list.push({
          label: gettext('Delete tickets'),
          rows: rows,
          callback: (event, { rows }) => {
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

    if (context.checkCanDeleteRow()) {
      list.push({
        label: gettext('Delete ticket'),
        callback: () => deleteRows && deleteRows([row._id])
      });
    }
    list.push({
      label: gettext('Copy link'),
      callback: () => {
        const { href, pathname, origin } = window.location;
        const decodePathname = decodeURIComponent(pathname);
        const projectNameIndex = decodePathname.indexOf(projectName);
        const newPathname = decodePathname.slice(0, projectNameIndex + projectName.length);
        const newHref = href.endsWith('/tickets/') ? href : origin + newPathname + '/tickets/';
        copy(newHref + row._id + '/');
        toaster.success(gettext('The ticket link has been copied'));
      }
    });
    return list;
  }, [projectName]);

  const localStorageName = useMemo(() => `sea-qa-${projectUuid}-tickets`, [projectUuid]);

  return (
    <SeaMetadata
      viewID={viewID}
      api={api}
      localStorageNamePrefix={localStorageName}
      createContextMenuOptions={createContextMenuOptions}
      expandRow={togglePageType}
      toggleView={updateViewID}

      // tags
      tagsData={tagsData}
      createTag={createTag}
      toggleAllTags={() => togglePageType(TICKET_PAGE_TYPE.TAGS)}
    />
  );
};

export default AllTickets;
