import copy from 'copy-to-clipboard';
import { gettext, siteRoot } from '@/constants';
import { PRIORITIES } from '@/sea-metadata/constants';
import { BAR_TYPE } from '@/project/constants';
import { toaster } from '@/components';
import { getColumnByName, getColumnOptions } from '@/sea-metadata/utils/column';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { PREDEFINED_PORTAL_ISSUE_COLUMN_NAME } from './constants';
import { IssueForAI } from './models';
import { cascadeUpdate } from '../tickets/utils';
import { normalizeContextMenuOptions, normalizeRowsMoreTools } from '@/project/utils';

export const generatorIssueURL = ({ issue, workspaceID, projectName }) => {
  const { origin } = location;
  const issueId = issue._id || issue.id;
  const url = `${origin}${siteRoot}workspace/${workspaceID}/project/${projectName}/${BAR_TYPE.PORTAL_ISSUES}/${issueId}/`;
  const urlObject = new URL(url);
  return urlObject.href;
};

export const generateOpenIssueOption = (issue, callback) => {
  if (!issue || !callback) return;
  return {
    key: 'open_issue',
    label: gettext('Open issue'),
    callback: () => callback(issue._id),
  };
};

export const generateCopyLinkOption = ({ row, workspaceID, projectName }) => {
  return {
    label: gettext('Copy link'),
    key: 'copy_link',
    callback: () => {
      const url = generatorIssueURL({ issue: row, workspaceID, projectName });
      copy(url);
      toaster.success(gettext('The issue link has been copied'));
    }
  };
};

export const generateChatIssuesByAIOption = ({ rows, columns }, callback) => {
  if (!Array.isArray(rows) || rows.length === 0 || !callback) return null;
  return {
    label: rows.length > 1 ? gettext('Chat issues') : gettext('Chat issue'),
    key: 'chat_issues',
    callback: () => {
      const titleColumn = getColumnByName(columns, PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.TITLE);
      if (!titleColumn) return;
      let newRows = [];
      rows.forEach(row => {
        const newRow = {
          [PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.TITLE]: getCellValueByColumn(row, titleColumn),
          _pk: row._id,
        };
        newRows.push(new IssueForAI(newRow));
      });
      callback(newRows);
    },
  };
};

export const generateCreateTicketOption = ({ row, columns }, callback) => {
  const column = getColumnByName(columns, PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.LINKED_TICKET);
  if (!column) return null;
  const cellValue = getCellValueByColumn(row, column);
  if (cellValue) return null;
  if (!callback) return null;
  return {
    key: 'create_ticket',
    label: gettext('Create related ticket'),
    callback: () => callback && callback(row),
  };
};

export const generateLinkAnExistingTicketOption = ({ row, columns }, callback) => {
  const column = getColumnByName(columns, PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.LINKED_TICKET);
  if (!column) return null;
  const cellValue = getCellValueByColumn(row, column);
  if (cellValue) return null;
  if (!callback) return null;

  return {
    key: 'link_an_existing_ticket',
    label: gettext('Link an existing ticket'),
    callback: () => callback && callback(row),
  };
};

export const generateDeleteIssueOption = ({ row }, callback) => {
  if (!callback) return null;
  return {
    label: gettext('Delete issue'),
    key: 'delete_row',
    callback: () => callback(row._id)
  };
};

export const generatorIssueCopyLinkTool = ({ row, workspaceID, projectName }) => {
  return {
    key: 'copy',
    icon: 'copy',
    label: gettext('Copy link'),
    callback: (event) => {
      event && event.stopPropagation();
      event?.nativeEvent && event.nativeEvent.stopImmediatePropagation();
      const url = generatorIssueURL({ issue: row, workspaceID, projectName });
      copy(url);
      toaster.success(gettext('The issue link has been copied'));
    },
  };
};

export const generatorRowsMoreTool = ({
  rows,
  columns,
  modifyRows,
  chatIssuesByAI,
  findRelatedIssues,
  context,
  createTicket,
  linkAnExistingTicket,
}) => {
  const stateColumn = getColumnByName(columns, 'state');
  const priorityColumn = getColumnByName(columns, 'priority');
  const stateColumnOptions = getColumnOptions(stateColumn);

  let children = [];
  children.push(generateChatIssuesByAIOption({ rows, columns }, chatIssuesByAI));

  // Add "Find related issues" option only for single row selection
  if (rows.length === 1 && findRelatedIssues) {
    children.push({
      label: gettext('Find related issues'),
      key: 'find_related_issues',
      callback: () => findRelatedIssues(rows[0]),
    });
  }

  if (rows.length === 1 && createTicket) {
    const row = rows[0];
    children.push(generateCreateTicketOption({ row, columns: columns }, createTicket));
    children.push(generateLinkAnExistingTicketOption({ row, columns: columns }, linkAnExistingTicket));
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
            className: 'seaqa-ticket-priority-dropdown-item',
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
    children: normalizeRowsMoreTools(children)
  };
};

export const generatorIssuesRowsTools = ({ rows, workspaceID, projectName, ...props }) => {
  let tools = [];
  if (rows.length === 1) {
    const row = rows[0];
    const tool = generatorIssueCopyLinkTool({ row, workspaceID, projectName });
    tools.push(tool);
  }
  const moreTool = generatorRowsMoreTool({ rows, workspaceID, projectName, ...props });
  tools.push(moreTool);
  return tools;
};

export const generatorIssuesContextMenuOptions = ({
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
  chatIssuesByAI,
  togglePageSlugId,
  workspaceID,
  projectName,
  permission,
  createTicket,
  linkAnExistingTicket,
  canDeleteRow,
}) => {
  let list = [];

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
      list.push(generateChatIssuesByAIOption({ rows, columns: table.columns }, chatIssuesByAI));
      if (rows.length === 1) {
        const row = rows[0];
        list.push(generateCreateTicketOption({ row, columns: table.columns }, createTicket));
        list.push(generateLinkAnExistingTicketOption({ row, columns: table.columns }, linkAnExistingTicket));
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
    return normalizeContextMenuOptions(list);
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
    list.push(generateChatIssuesByAIOption({ rows, columns: table.columns }, chatIssuesByAI));

    if (context.canDeleteRows()) {
      list.push('Divider');
      list.push({
        label: gettext('Delete issues'),
        key: 'delete_rows',
        callback: (event) => {
          const rowIds = rows.map(row => row._id);
          deleteRows && deleteRows(rowIds);
        }
      });
    }
    return normalizeContextMenuOptions(list);
  }

  // handle selected cell
  if (!selectedPosition) return list;
  const { groupRowIndex, rowIdx: rowIndex } = selectedPosition;
  const row = rowGetterByIndex({ isGroupView, groupRowIndex, rowIndex }) || table.id_row_map[selectedRowIds[0]];
  if (!row) return list;
  list.push(generateChatIssuesByAIOption({ rows: [row], columns: table.columns }, chatIssuesByAI));
  list.push(generateCreateTicketOption({ row, columns: table.columns }, createTicket));
  list.push(generateLinkAnExistingTicketOption({ row, columns: table.columns }, linkAnExistingTicket));
  list.push('Divider');
  list.push(generateOpenIssueOption(row, togglePageSlugId));
  list.push(generateCopyLinkOption({ row, workspaceID, projectName }));
  if (canDeleteRow || context.canDeleteRow()) {
    list.push('Divider');
    list.push(generateDeleteIssueOption({ row }, deleteRow));
  }
  return normalizeContextMenuOptions(list);
};

export {
  cascadeUpdate,
};
