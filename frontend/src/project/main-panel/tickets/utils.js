import { gettext } from '@/constants';
import { PRIORITIES } from '@/sea-metadata/constants';
import { BAR_TYPE } from '@/project/constants';
import copy from 'copy-to-clipboard';
import { toaster } from '@/components';
import { getColumnByName, getColumnOptions, getOption } from '@/sea-metadata/utils/column';
import { getRowById } from '@/sea-metadata/utils/row';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { PREDEFINED_TICKET_COLUMN_NAME } from './constants';
import { TicketForAI } from './models';

export const generatorTicketURL = ({ row, workspaceID, projectName }) => {
  const { origin } = location;
  return `${origin}/workspace/${workspaceID}/project/${projectName}/${BAR_TYPE.TICKET}/${row._id}/`;
};

export const generatorRowCopyLinkTool = ({ row, workspaceID, projectName }) => {
  return {
    key: 'copy',
    icon: 'copy',
    label: gettext('Copy link'),
    callback: (event) => {
      event && event.stopPropagation();
      event?.nativeEvent && event.nativeEvent.stopImmediatePropagation();
      const url = generatorTicketURL({ row, workspaceID, projectName });
      copy(url);
      toaster.success(gettext('The ticket link has been copied'));
    },
  };
};

export const generatorRowsMoreTool = ({ rows, columns, modifyRows, chatTicketsByAI }) => {
  const stateColumn = getColumnByName(columns, 'state');
  const priorityColumn = getColumnByName(columns, 'priority');
  const stateColumnOptions = getColumnOptions(stateColumn);
  return {
    key: 'more',
    icon: 'more',
    children: [
      {
        label: gettext('Set state'),
        key: 'state',
        children: stateColumnOptions.map((o) => {
          return {
            key: o.id,
            label: o.display_name || o.name,
            callback: () => {
              let rowIds = [];
              let idRowUpdates = {};
              let idOldRowOldData = {};
              rows.forEach(row => {
                const { _id } = row;
                rowIds.push(_id);
                idRowUpdates[_id] = { [stateColumn.key]: o.id };
                idOldRowOldData[_id] = { [stateColumn.key]: row[stateColumn.key] };
              });
              modifyRows && modifyRows(rowIds, idRowUpdates, idOldRowOldData);
            },
          };
        })
      }, {
        label: gettext('Set priority'),
        key: 'priority',
        children: PRIORITIES.map(o => {
          return {
            ...o,
            key: o.value,
            icon: o.icon,
            label: o.name,
            className: 'sea-qa-ticket-priority-dropdown-item',
            callback: () => {
              let rowIds = [];
              let idRowUpdates = {};
              let idOldRowOldData = {};
              rows.forEach(row => {
                const { _id } = row;
                rowIds.push(_id);
                idRowUpdates[_id] = { [priorityColumn.key]: o.value };
                idOldRowOldData[_id] = { [priorityColumn.key]: row[priorityColumn.key] };
              });
              modifyRows && modifyRows(rowIds, idRowUpdates, idOldRowOldData);
            },
          };
        })
      }, {
        label: gettext('AI'),
        key: 'AI',
        children: [
          {
            label: rows.length > 1 ? gettext('Chat tickets') : gettext('Chat ticket'),
            key: 'chat_tickets',
            callback: () => {
              const titleColumn = getColumnByName(columns, PREDEFINED_TICKET_COLUMN_NAME.TITLE);
              if (!titleColumn) return;
              let newRows = [];
              rows.forEach(row => {
                const newRow = {
                  [PREDEFINED_TICKET_COLUMN_NAME.TITLE]: getCellValueByColumn(row, titleColumn),
                  _pk: row._id,
                };
                newRows.push(new TicketForAI(newRow));
              });
              chatTicketsByAI(newRows);
            },
          }
        ]
      }
    ]
  };
};

export const generatorTicketsRowsTools = ({ rows, columns, workspaceID, projectName, modifyRows, chatTicketsByAI }) => {
  let tools = [];
  if (rows.length === 1) {
    const row = rows[0];
    const tool = generatorRowCopyLinkTool({ row, workspaceID, projectName });
    tools.push(tool);
  }
  const moreTool = generatorRowsMoreTool({ rows, columns, modifyRows, chatTicketsByAI });
  tools.push(moreTool);
  return tools;
};

// When the value of state is modified, the values of substate are updated in a cascading fashion.
export const cascadeUpdateSubState = (table, rowId, rowUpdate, oldRowData) => {
  const row = getRowById(table, rowId);
  if (!row || !rowUpdate) return;
  const updatedColumnKeys = Object.keys(rowUpdate);
  const stateColumn = getColumnByName(table.columns, 'state');
  if (!stateColumn || !updatedColumnKeys.includes(stateColumn?.key)) return;

  const subStateColumn = getColumnByName(table.columns, 'substate');
  if (!subStateColumn) return;

  const { cascade_settings = {} } = subStateColumn.data || {};
  const options = getColumnOptions(subStateColumn);
  if (!cascade_settings) return;

  const cellValue = rowUpdate[stateColumn.key];
  const cascadeOptionIds = cellValue ? (cascade_settings[cellValue] || []) : [];
  const oldCascadeCellValue = getCellValueByColumn(rowUpdate, subStateColumn) || getCellValueByColumn(row, subStateColumn);
  if (cascadeOptionIds.includes(oldCascadeCellValue)) return;

  const validCascadeOptionIds = cascadeOptionIds.filter(id => getOption(options, id));
  const cascadeCellValue = validCascadeOptionIds[0] || null;
  rowUpdate[subStateColumn.key] = cascadeCellValue;
  oldRowData[subStateColumn.key] = oldCascadeCellValue;
};

export const generatorTicketsContextMenuOptions = ({
  isGroupView,
  selectedRange,
  selectedPosition,
  position,
  table,
  rowMetrics,
  deleteRow,
  deleteRows,
  hideMenu,
  onClearSelected,
  onCopySelected,
  rowGetterByIndex,
  selectNone,
  context,
  chatTicketsByAI,
  togglePageSlugId,
  workspaceID,
  projectName,
}) => {
  let list = [];

  const handleChatTicketsByAI = (rows) => {
    const titleColumn = getColumnByName(table.columns, PREDEFINED_TICKET_COLUMN_NAME.TITLE);
    if (!titleColumn) return;
    let newRows = [];
    rows.forEach(row => {
      const newRow = {
        [PREDEFINED_TICKET_COLUMN_NAME.TITLE]: getCellValueByColumn(row, titleColumn),
        _pk: row._id,
      };
      newRows.push(new TicketForAI(newRow));
    });
    chatTicketsByAI(newRows);
  };

  // handle selected multiple cells
  if (selectedRange) {
    if (context.canModify()) {
      list.push({
        label: gettext('Clear selected'),
        key: 'clear_selected',
        callback: onClearSelected,
      });
    }
    list.push({
      label: gettext('Copy selected'),
      key: 'copy_selected',
      callback: onCopySelected,
    });

    const { topLeft, bottomRight } = selectedRange;
    let rows = [];
    let currentGroupRowIndex = topLeft.groupRowIndex;
    for (let i = topLeft.rowIdx; i <= bottomRight.rowIdx; i++) {
      const row = rowGetterByIndex({ isGroupView, groupRowIndex: currentGroupRowIndex, rowIndex: i });
      currentGroupRowIndex++;
      if (row) {
        rows.push(row);
      }
    }

    if (context.canDeleteRows() && rows.length > 0) {
      list.push({
        label: gettext('Delete selected'),
        key: 'delete_selected',
        callback: (event) => {
          const rowIds = rows.map(row => row._id);
          deleteRows && deleteRows(rowIds);
        }
      });
    }

    if (rows.length > 0) {
      if (list.length > 0) {
        list.push('Divider');
      }
      list.push({
        key: 'AI',
        label: gettext('AI'),
        children: [
          {
            label: rows.length > 1 ? gettext('Chat tickets') : gettext('Chat ticket'),
            key: 'chat_tickets',
            callback: () => handleChatTicketsByAI(rows),
          }
        ],
      });
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

    if (context.canDeleteRows() && rows.length > 0) {
      list.push({
        label: gettext('Delete tickets'),
        key: 'delete_rows',
        callback: (event) => {
          const rowIds = rows.map(row => row._id);
          deleteRows && deleteRows(rowIds);
        }
      });
    }

    if (rows.length > 0) {
      if (list.length > 0) {
        list.push('Divider');
      }
      list.push({
        key: 'AI',
        label: gettext('AI'),
        children: [
          {
            label: rows.length > 1 ? gettext('Chat tickets') : gettext('Chat ticket'),
            key: 'chat_tickets',
            callback: () => handleChatTicketsByAI(rows),
          }
        ],
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
    callback: () => togglePageSlugId(row._id),
  });
  list.push('Divider');

  if (context.canDeleteRow()) {
    list.push({
      label: gettext('Delete ticket'),
      key: 'delete_row',
      callback: () => deleteRow && deleteRow(row._id)
    });
  }
  list.push({
    label: gettext('Copy link'),
    key: 'copy_link',
    callback: () => {
      const { origin } = location;
      let url = `${origin}/workspace/${workspaceID}/project/${projectName}/${BAR_TYPE.TICKET}/${row._id}/`;
      copy(url);
      toaster.success(gettext('The ticket link has been copied'));
    }
  });

  list.push('Divider');
  list.push({
    key: 'AI',
    label: gettext('AI'),
    children: [
      {
        label: gettext('Chat ticket'),
        key: 'chat_tickets',
        callback: () => handleChatTicketsByAI([row]),
      }
    ],
  });
  return list;
};
