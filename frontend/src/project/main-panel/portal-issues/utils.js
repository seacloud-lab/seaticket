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

export const generatorIssueURL = ({ issue, workspaceID, projectName }) => {
  const { origin } = location;
  const issueId = issue._id || issue.id;
  const url = `${origin}${siteRoot}workspace/${workspaceID}/project/${projectName}/${BAR_TYPE.PORTAL_ISSUES}/${issueId}/`;
  const urlObject = new URL(url);
  return urlObject.href;
};

export const generatorIssueCopyLinkTool = ({ issue, workspaceID, projectName }) => {
  return {
    key: 'copy',
    icon: 'copy',
    label: gettext('Copy link'),
    callback: (event) => {
      event && event.stopPropagation();
      event?.nativeEvent && event.nativeEvent.stopImmediatePropagation();
      const url = generatorIssueURL({ issue, workspaceID, projectName });
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
  createTicket
}) => {
  const stateColumn = getColumnByName(columns, 'state');
  const priorityColumn = getColumnByName(columns, 'priority');
  const stateColumnOptions = getColumnOptions(stateColumn);

  let children = [];

  if (chatIssuesByAI) {
    children.push({
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
        chatIssuesByAI(newRows);
      },
    });
  }

  // Add "Find related issues" option only for single row selection
  if (rows.length === 1 && findRelatedIssues) {
    children.push({
      label: gettext('Find related issues'),
      key: 'find_related_issues',
      callback: () => findRelatedIssues(rows[0]),
    });
  }

  if (rows.length === 1 && createTicket) {
    children.push({
      label: gettext('Create knowledge base record'),
      key: 'create_kb_record',
      callback: () => createTicket(rows[0]),
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
      },
    ];
  }

  return {
    key: 'more',
    icon: 'more',
    children
  };
};

export const generatorIssuesRowsTools = ({ rows, columns, workspaceID, projectName, modifyRows, chatIssuesByAI, context, createTicket }) => {
  let tools = [];
  if (rows.length === 1) {
    const row = rows[0];
    const tool = generatorIssueCopyLinkTool({ issue: row, workspaceID, projectName });
    tools.push(tool);
  }
  const moreTool = generatorRowsMoreTool({ rows, columns, modifyRows, chatIssuesByAI, context, createTicket });
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
  canDeleteRow
}) => {
  let list = [];

  const handleChatIssuesByAI = (rows) => {
    const titleColumn = getColumnByName(table.columns, PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.TITLE);
    if (!titleColumn) return;
    let newRows = [];
    rows.forEach(row => {
      const newRow = {
        [PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.TITLE]: getCellValueByColumn(row, titleColumn),
        _pk: row._id,
      };
      newRows.push(new IssueForAI(newRow));
    });
    chatIssuesByAI(newRows);
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
      if (chatIssuesByAI) {
        list.push(
          {
            label: rows.length > 1 ? gettext('Chat issues') : gettext('Chat issue'),
            key: 'chat_issues',
            callback: () => handleChatIssuesByAI(rows),
          },
        );
      }

      if (rows.length === 1 && createTicket) {
        list.push({
          label: gettext('Create related ticket'),
          key: 'create_ticket',
          callback: () => createTicket(rows[0]),
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
    if (chatIssuesByAI) {
      list.push({
        label: rows.length > 1 ? gettext('Chat issues') : gettext('Chat issue'),
        key: 'chat_issues',
        callback: () => handleChatIssuesByAI(rows),
      });
    }

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

    return list;
  }

  // handle selected cell
  if (!selectedPosition) return list;
  const { groupRowIndex, rowIdx: rowIndex } = selectedPosition;
  const row = rowGetterByIndex({ isGroupView, groupRowIndex, rowIndex }) || table.id_row_map[selectedRowIds[0]];
  if (!row) return list;
  if (chatIssuesByAI) {
    list.push({
      label: gettext('Chat issue'),
      key: 'chat_issues',
      callback: () => handleChatIssuesByAI([row]),
    });
  }

  if (createTicket) {
    list.push({
      label: gettext('Create related ticket'),
      key: 'create_ticket',
      callback: () => createTicket(row),
    });
  }
  list.push('Divider');

  list.push({
    label: gettext('Open issue'),
    callback: () => togglePageSlugId(row._id),
    key: 'open_issue',
  });
  list.push({
    label: gettext('Copy link'),
    key: 'copy_link',
    callback: () => {
      const url = generatorIssueURL({ issue: row, workspaceID, projectName });
      copy(url);
      toaster.success(gettext('The issue link has been copied'));
    }
  });
  list.push('Divider');

  if (canDeleteRow || context.canDeleteRow()) {
    list.push({
      label: gettext('Delete issue'),
      key: 'delete_row',
      callback: () => deleteRow && deleteRow(row._id)
    });
  }

  return list;
};

export {
  cascadeUpdate,
};
