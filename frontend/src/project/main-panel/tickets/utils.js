import { username, gettext, siteRoot } from '@/constants';
import { PRIORITIES } from '@/sea-metadata/constants';
import { BAR_TYPE } from '@/project/constants';
import copy from 'copy-to-clipboard';
import { toaster } from '@/components';
import { getColumnByName, getColumnOptions, getOption } from '@/sea-metadata/utils/column';
import { getRowById } from '@/sea-metadata/utils/row';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { PREDEFINED_TICKET_COLUMN_NAME, AUTO_UPDATE_PARTICIPANTS_KEY } from './constants';
import { TicketForAI } from './models';

export const generatorTicketURL = ({ ticket, workspaceID, projectName }) => {
  const { origin } = location;
  const ticketId = ticket._id || ticket.id;
  const url = `${origin}${siteRoot}workspace/${workspaceID}/project/${projectName}/${BAR_TYPE.TICKET}/${ticketId}/`;
  const urlObject = new URL(url);
  return urlObject.href;
};

export const generatorTicketCopyLinkTool = ({ ticket, workspaceID, projectName }) => {
  return {
    key: 'copy',
    icon: 'copy',
    label: gettext('Copy link'),
    callback: (event) => {
      event && event.stopPropagation();
      event?.nativeEvent && event.nativeEvent.stopImmediatePropagation();
      const url = generatorTicketURL({ ticket, workspaceID, projectName });
      copy(url);
      toaster.success(gettext('The ticket link has been copied'));
    },
  };
};

export const generatorRowsMoreTool = ({
  rows,
  columns,
  modifyRows,
  chatTicketsByAI,
  findRelatedIssues,
  context,
  createKnowledgeBaseRecord,
  createTask,
}) => {
  const stateColumn = getColumnByName(columns, 'state');
  const priorityColumn = getColumnByName(columns, 'priority');
  const stateColumnOptions = getColumnOptions(stateColumn);

  let children = [
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
  ];

  // Add "Find related issues" option only for single row selection
  if (rows.length === 1 && findRelatedIssues) {
    children.push({
      label: gettext('Find related issues'),
      key: 'find_related_issues',
      callback: () => findRelatedIssues(rows[0]),
    });
  }

  if (rows.length === 1 && createKnowledgeBaseRecord) {
    children.push({
      label: gettext('Create knowledge base record'),
      key: 'create_kb_record',
      callback: () => createKnowledgeBaseRecord(rows[0]),
    });
  }

  if (rows.length === 1 && createTask) {
    children.push({
      label: gettext('Create task'),
      key: 'create_task',
      callback: () => createTask(rows[0]),
    });
  }

  if (context.canModifyRows()) {
    children = [
      ...children,
      { key: 'divider' },
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
      },
    ];
  }

  return {
    key: 'more',
    icon: 'more',
    children
  };
};

export const generatorTicketsRowsTools = ({
  rows,
  columns,
  workspaceID,
  projectName,
  modifyRows,
  chatTicketsByAI,
  findRelatedIssues,
  context,
  createKnowledgeBaseRecord,
  createTask,
}) => {
  let tools = [];
  if (rows.length === 1) {
    const row = rows[0];
    const tool = generatorTicketCopyLinkTool({ ticket: row, workspaceID, projectName });
    tools.push(tool);
  }
  const moreTool = generatorRowsMoreTool({
    rows,
    columns,
    modifyRows,
    chatTicketsByAI,
    findRelatedIssues,
    context,
    createKnowledgeBaseRecord,
    createTask,
  });
  tools.push(moreTool);
  return tools;
};


export const cascadeUpdate = (table, rowId, rowUpdate, oldRowData) => {
  const row = getRowById(table, rowId);
  if (!row || !rowUpdate) return;
  const updatedColumnKeys = Object.keys(rowUpdate);

  // When the value of state is modified, the values of substate are updated in a cascading fashion.
  const stateColumn = getColumnByName(table.columns, PREDEFINED_TICKET_COLUMN_NAME.STATE);
  if (stateColumn && updatedColumnKeys.includes(stateColumn?.key)) {
    const subStateColumn = getColumnByName(table.columns, PREDEFINED_TICKET_COLUMN_NAME.SUB_STATE);
    if (subStateColumn) {
      const { cascade_settings = {} } = subStateColumn.data || {};
      const options = getColumnOptions(subStateColumn);
      if (cascade_settings) {
        const cellValue = rowUpdate[stateColumn.key];
        const cascadeOptionIds = cellValue ? (cascade_settings[cellValue] || []) : [];
        const oldCascadeCellValue = getCellValueByColumn(rowUpdate, subStateColumn) || getCellValueByColumn(row, subStateColumn);
        if (!cascadeOptionIds.includes(oldCascadeCellValue)) {
          const validCascadeOptionIds = cascadeOptionIds.filter(id => getOption(options, id));
          const cascadeCellValue = validCascadeOptionIds[0] || null;
          rowUpdate[subStateColumn.key] = cascadeCellValue;
          oldRowData[subStateColumn.key] = oldCascadeCellValue;
        }
      }
    }
  }

  // User A modifies the data and A becomes a participant if not operate participants column
  // const assigneesColumn = getColumnByName(table.columns, PREDEFINED_TICKET_COLUMN_NAME.ASSIGNEES);
  const participantsColumn = getColumnByName(table.columns, PREDEFINED_TICKET_COLUMN_NAME.PARTICIPANTS);
  if (participantsColumn) {
    if (updatedColumnKeys.includes(participantsColumn.key)) {
      rowUpdate[AUTO_UPDATE_PARTICIPANTS_KEY] = false;
    } else {
      const oldParticipants = row[participantsColumn?.key] || [];
      let newParticipants = oldParticipants.slice(0);
      // if (assigneesColumn && updatedColumnKeys.includes(assigneesColumn?.key)) {
      //   const assignees = rowUpdate[assigneesColumn.key];
      //   assignees.forEach(assignee => {
      //     if (!newParticipants.includes(assignee)) {
      //       newParticipants.push(assignee);
      //     }
      //   });
      // }
      if (!newParticipants.includes(username)) {
        newParticipants.push(username);
        rowUpdate[participantsColumn.key] = newParticipants;
        rowUpdate[AUTO_UPDATE_PARTICIPANTS_KEY] = true;
        oldRowData[participantsColumn.key] = newParticipants;
      }
    }
  }
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
  permission,
  findRelatedIssues,
  createKnowledgeBaseRecord,
  createTask,
  canDeleteRow
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

    if (rows.length > 0) {
      list.push(
        {
          label: rows.length > 1 ? gettext('Chat tickets') : gettext('Chat ticket'),
          key: 'chat_tickets',
          callback: () => handleChatTicketsByAI(rows),
        },
      );
      if (rows.length === 1 && createKnowledgeBaseRecord) {
        list.push({
          label: gettext('Create knowledge base record'),
          key: 'create_kb_record',
          callback: () => createKnowledgeBaseRecord(rows[0]),
        });
      }
      if (rows.length === 1 && createTask) {
        list.push({
          label: gettext('Create task'),
          key: 'create_task',
          callback: () => createTask(rows[0]),
        });
      }
      list.push('Divider');
    }

    list.push({
      label: gettext('Copy selected'),
      key: 'copy_selected',
      callback: onCopySelected,
    });

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

    if (rows.length === 0) return list;

    list.push({
      label: rows.length > 1 ? gettext('Chat tickets') : gettext('Chat ticket'),
      key: 'chat_tickets',
      callback: () => handleChatTicketsByAI(rows),
    });

    if (context.canDeleteRows()) {
      list.push('Divider');
      list.push({
        label: gettext('Delete tickets'),
        key: 'delete_rows',
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
    label: gettext('Chat ticket'),
    key: 'chat_tickets',
    callback: () => handleChatTicketsByAI([row]),
  });

  if (findRelatedIssues) {
    list.push({
      label: gettext('Find related issues'),
      key: 'find_related_issues',
      callback: () => findRelatedIssues(row),
    });
  }

  if (createKnowledgeBaseRecord) {
    list.push({
      label: gettext('Create knowledge base record'),
      key: 'create_kb_record',
      callback: () => createKnowledgeBaseRecord(row),
    });
  }
  if (createTask) {
    list.push({
      label: gettext('Create task'),
      key: 'create_task',
      callback: () => createTask(row),
    });
  }
  list.push('Divider');

  list.push({
    label: gettext('Open ticket'),
    callback: () => togglePageSlugId(row._id),
    key: 'open_ticket',
  });
  list.push({
    label: gettext('Copy link'),
    key: 'copy_link',
    callback: () => {
      const url = generatorTicketURL({ ticket: row, workspaceID, projectName });
      copy(url);
      toaster.success(gettext('The ticket link has been copied'));
    }
  });

  if (canDeleteRow || context.canDeleteRow()) {
    list.push('Divider');
    list.push({
      label: gettext('Delete ticket'),
      key: 'delete_row',
      callback: () => deleteRow && deleteRow(row._id)
    });
  }

  return list;
};
