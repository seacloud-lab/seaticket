import { gettext } from '@/constants';
import { BAR_TYPE } from '@/project/constants';

export const generatorKnowledgeBaseURL = ({ row, workspaceID, projectName }) => {
  const { origin } = location;
  return `${origin}/workspace/${workspaceID}/project/${projectName}/${BAR_TYPE.KNOWLEDGE}/${row._id}/`;
};

export const generatorKnowledgeContextMenuOptions = ({
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
  if (selectedRange) return list;
  const selectedRowIds = rowMetrics ? Object.keys(rowMetrics.idSelectedRowMap) : [];
  if (selectedRowIds.length > 1) {
    if (context.canDeleteRows()) list.push({ label: gettext('Delete records'), callback: () => deleteRows(selectedRowIds) });
    return list;
  }
  if (!selectedPosition) return list;
  const { groupRowIndex, rowIdx: rowIndex } = selectedPosition;
  const row = rowGetterByIndex({ isGroupView, groupRowIndex, rowIndex }) || table.id_row_map[selectedRowIds[0]];
  if (!row) return list;
  if (context.canDeleteRow()) list.push({ label: gettext('Delete record'), callback: () => deleteRow(row._id) });
  return list;
};
