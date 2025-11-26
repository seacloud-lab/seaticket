import { gettext } from '@/constants';
import { CellType } from '@/sea-metadata';
import { PRIORITIES } from '@/sea-metadata/constants';
import { BAR_TYPE } from '@/project/constants';
import copy from 'copy-to-clipboard';
import { toaster } from '@/components';
import { getColumnByName, getColumnOptions } from '@/sea-metadata/utils/column';
import { getTableColumnByKey } from '@/sea-metadata/utils/table';
import { getOptionNameById, getColumnOptionNamesByIds } from '@/sea-metadata/utils/column';
import { getRowById, getRowsByIds } from '@/sea-metadata/utils/row';
import ObjectUtils from '@/utils/object-utils';

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

export const generatorRowsMoreTool = ({ rows, columns, modifyRows }) => {
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
      }
    ]
  };
};

// server use name-optionName to update single-select/multiple-select
// server use name-value to update row
export const convertRowToServerData = (rowUpdate, { data, typesData, tagsData }) => {
  let serverRowData = {};
  Object.keys(rowUpdate).forEach(key => {
    const column = getTableColumnByKey(data, key);
    if (!column) return;
    const { name, type } = column;
    let cellValue = rowUpdate[key];
    if (type === CellType.SINGLE_SELECT ) {
      if (cellValue) {
        cellValue = getOptionNameById(column, cellValue);
      }
    } else if (type === CellType.TYPE) {
      if (cellValue) {
        const option = getRowById(typesData, cellValue);
        cellValue = option.name;
      }
    } else if (type === CellType.TAGS) {
      if (Array.isArray(cellValue) && cellValue.length > 0) {
        const tags = getRowsByIds(tagsData, cellValue);
        cellValue = tags.map(tag => tag.name);
      }
    } else if (type === CellType.MULTIPLE_SELECT) {
      if (Array.isArray(cellValue) && cellValue.length > 0) {
        cellValue = getColumnOptionNamesByIds(column, cellValue);
      }
    }
    serverRowData[name] = cellValue;
  });
  return serverRowData;
};

export const convertRowsToServerData = (rowsUpdate, { data, typesData, tagsData }) => {
  return rowsUpdate.map(rowUpdate => {
    const { row_id, row } = rowUpdate;
    return { row_id, row: convertRowToServerData(row, { data, typesData, tagsData }) };
  }).filter(rowUpdate => rowUpdate.row && !ObjectUtils.isEmpty(rowUpdate.row));
};
