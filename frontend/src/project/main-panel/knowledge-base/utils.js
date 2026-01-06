import { gettext } from '@/constants';
import { CellType } from '@/sea-metadata';
import { BAR_TYPE } from '@/project/constants';
import { getTableColumnByKey } from '@/sea-metadata/utils/table';
import { getRowsByIds } from '@/sea-metadata/utils/row';

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

export const convertRowToServerData = (rowUpdate, { data, tagsData }) => {
  let serverRowData = {};
  Object.keys(rowUpdate).forEach(key => {
    const column = getTableColumnByKey(data, key);
    if (!column) return;
    const { name, type } = column;
    let cellValue = rowUpdate[key];
    if (type === CellType.TAGS) {
      if (Array.isArray(cellValue) && cellValue.length > 0) {
        const tags = getRowsByIds(tagsData, cellValue);
        cellValue = tags.map(tag => tag.name);
      }
    }
    serverRowData[name] = cellValue;
  });
  return serverRowData;
};
