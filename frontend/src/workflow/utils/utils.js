import deepCopy from 'deep-copy';
import {
  CellType,
  getGeolocationDisplayString,
  getNumberDisplayString,
  getViewById,
  filterRows,
  getTableById,
  getLinkedTableID,
  formatStringToNumber,
  FILL_DEFAULT_VALUE_COLUMNS_TYPE,
} from 'dtable-utils';
import {
  NORMAL_NODE_TEMPLATE,
  INIT_NODE_TEMPLATE,
  COMPLETED_NODE_TEMPLATE,
  COLUMN_CONFIG_KEY,
  WORKFLOW_SUPPORT_VISIBLE_TYPE_MAP,
  NODE_TYPE,
} from '../constants';
import dayjs from '../../components/common/dayjs';
import Column from '../model/column';
import { convertRowDataBack } from '../../utils/utils';
import { CANCELED_NODE_TEMPLATE } from '../constants/nodes';

export const findLastExistNodeIndex = (arr) => {
  let idx = -1;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i]) {
      idx = i;
      break;
    }
  }
  return idx;
};

export const generateId = () => {
  return '' + Math.floor(Math.random() * Math.pow(10, 6));
};

export const nodeFactory = (nodeType, nodeName, { nodes = [], nextNode = {}, copiedNode = {} } = {}) => {
  let nodeId = generateId();
  while (nodes.find(node => node._id === nodeId)) {
    nodeId = generateId();
  }
  switch (nodeType) {
    case NODE_TYPE.INIT: {
      return Object.assign({}, INIT_NODE_TEMPLATE, { _id: nodeId });
    }
    case NODE_TYPE.COMPLETED: {
      return Object.assign({}, COMPLETED_NODE_TEMPLATE, { _id: nodeId });
    }
    case 'copy': {
      return Object.assign({}, copiedNode || NORMAL_NODE_TEMPLATE, { _id: nodeId, name: nodeName });
    }
    case NODE_TYPE.CANCELED: {
      return Object.assign({}, CANCELED_NODE_TEMPLATE, { name: nodeName });
    }
    default: {
      return Object.assign({}, NORMAL_NODE_TEMPLATE, {
        _id: nodeId,
        name: nodeName,
        next_node_id: nextNode._id || '',
      });
    }
  }
};

export const getValidWorkflowColumns = (tableColumns, columnsConfig = {}, tables = [], currentTableId = '') => {
  if (!Array.isArray(tableColumns) || tableColumns.length === 0) return [];
  return tableColumns
    .filter(column => WORKFLOW_SUPPORT_VISIBLE_TYPE_MAP[column.type])
    .map(column => {
      const columnConfig = columnsConfig[column.key] || {};
      if (column.type === CellType.LINK && currentTableId) {
        const { other_table_id, table_id } = column.data;
        const linkedTableID = getLinkedTableID(currentTableId, table_id, other_table_id);
        const linkedTable = getTableById(tables, linkedTableID);
        return new Column(column, columnConfig, linkedTable.columns);
      }
      return new Column(column, columnConfig);
    });
};

export const getDisplayNodeColumns = (workflowColumns, nodeColumns) => {
  if (!Array.isArray(workflowColumns) || workflowColumns.length === 0) return [];
  if (!Array.isArray(nodeColumns) || nodeColumns.length === 0) return [];
  const displayNodeColumns = nodeColumns.map(nodeColumn => {
    const { key } = nodeColumn;
    const column = workflowColumns.find(tableColumn => tableColumn.key === key);
    if (!column) return null;
    return Object.assign({}, column, { is_dynamic_participants_column: nodeColumn.is_dynamic_participants_column });
  }).filter(column => column);
  return displayNodeColumns;
};

export const getWorkflowFilteredColumns = (filterColumns, allColumns, rowData = {}) => {
  let row = convertRowDataBack(allColumns, rowData);
  if (rowData && rowData._id) row._id = rowData._id;
  return filterColumns.filter(column => {
    let { filters, filter_conjunction: filterConjunction, show_on_condition: showOnCondition } = column;
    if (showOnCondition) {
      let newFilters = [];
      filters.forEach(filter => {
        let filterColumn = allColumns.find(item => item.key === filter.column_key);
        if (filterColumn) {
          newFilters.push(Object.assign({}, filter, { column: { type: filterColumn.type, data: filterColumn.data } }));
        }
      });
      const formulaRows = row?._id ? { [row._id]: row } : {};
      const filteredRows = filterRows(filterConjunction, newFilters, [row], { formulaRows });
      return filteredRows.length > 0;
    }
    return true;
  });
};

export const getWorkflowFormInitRowData = (columns, config) => {
  let rowData = {};
  // get default value
  const defaultValueColumns = columns.filter(column => FILL_DEFAULT_VALUE_COLUMNS_TYPE.includes(column.type) && column.enable_fill_default_value);
  defaultValueColumns.forEach(column => {
    const { enable_fill_default_value: enableFillDefaultValue, default_value, key } = column;
    let validDefaultValue = default_value;
    if (column.type === CellType.DATE && validDefaultValue === 'current_date') {
      const hasTime = column.data && column.data.format && column.data.format.includes('HH:mm');
      validDefaultValue = dayjs(new Date()).format(hasTime ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD');
    }
    if (column.type === CellType.TEXT) {
      validDefaultValue = validDefaultValue.replace(/\{[^}]+\}/ig, (specialVariable) => {
        if (specialVariable.toLocaleLowerCase() === '{creator.name}') {
          if (config) {
            return config.name;
          }
        } else if (specialVariable.toLocaleLowerCase() === '{creator.id}') {
          if (config) {
            return config.userId;
          }
        }
        return '';
      });
    }
    if (enableFillDefaultValue) {
      rowData[key] = validDefaultValue;
    }
  });
  return rowData;
};

export const getShowColumns = (workflowColumns, selectedNode) => {
  let readOnlyColumns = selectedNode && selectedNode.node_form ? selectedNode.node_form.readonly_columns || [] : [];
  let readWriteColumns = selectedNode && selectedNode.node_form ? selectedNode.node_form.readwrite_columns || [] : [];
  readOnlyColumns = getDisplayNodeColumns(workflowColumns, readOnlyColumns);
  readWriteColumns = getDisplayNodeColumns(workflowColumns, readWriteColumns);
  return { readOnlyColumns, readWriteColumns, allColumns: [...readOnlyColumns, ...readWriteColumns] };
};

export const getTableHiddenColumnKeys = (table, viewId) => {
  if (!table) return [];
  const { views } = table;
  if (viewId) {
    const view = getViewById(views, viewId);
    if (view) {
      const { hidden_columns = [] } = view;
      if (!Array.isArray(hidden_columns)) return [];

      // avoid modifying referenced raw data
      return [...hidden_columns];
    }
    // view is not exist
  }

  // take the union of all view hidden columns in the current table
  const isAllViewHasHiddenColumns = views.every(view => {
    return view.hidden_columns && Array.isArray(view.hidden_columns) && view.hidden_columns.length > 0;
  });
  if (!isAllViewHasHiddenColumns) return [];

  let hiddenColumnKeys = [];
  const { hidden_columns } = views[0];
  hidden_columns.forEach(key => {
    const isExist = views.every(view => view.hidden_columns.includes(key));
    if (isExist) hiddenColumnKeys.push(key);
  });
  return hiddenColumnKeys;
};

export const getColumnWidth = (column) => {
  let { type, data } = column;
  switch (type) {
    case CellType.DATE: {
      let isShowHourAndMinute = data && data.format && data.format.indexOf('HH:mm') > -1;
      return isShowHourAndMinute ? 160 : 100;
    }
    case CellType.CTIME:
    case CellType.MTIME:
    case CellType.LINK:
    case CellType.GEOLOCATION: {
      return 160;
    }
    case CellType.COLLABORATOR: {
      return 100;
    }
    case CellType.CHECKBOX: {
      return 40;
    }
    case CellType.NUMBER:
    case CellType.AUTO_NUMBER: {
      return 120;
    }
    case CellType.RATE: {
      const { rate_max_number } = data || {};
      const rateMaxNumber = rate_max_number || 5;
      return 16 * rateMaxNumber + 20;
    }
    default: {
      return 100;
    }
  }
};

export const getMissedRequiredColumns = (columns, row = {}) => {
  if (!Array.isArray(columns) || columns.length === 0) return [];
  return columns.filter(column => {
    const { key, type, data } = column;
    const cellValue = row[key];
    const isRequired = column[COLUMN_CONFIG_KEY.IS_REQUIRED];
    if (!isRequired) return false;

    switch (type) {
      case CellType.FILE:
      case CellType.IMAGE:
      case CellType.COLLABORATOR:
      case CellType.MULTIPLE_SELECT: {
        return !(Array.isArray(cellValue) && cellValue.length > 0);
      }
      case CellType.LINK: {
        if (!cellValue) return true;
        let realValue;
        if (cellValue.row_datas) {
          realValue = cellValue.row_datas;
        } else {
          realValue = cellValue;
        }
        return !(Array.isArray(realValue) && realValue.length > 0);
      }
      case CellType.CHECKBOX: {
        return false;
      }
      case CellType.LONG_TEXT: {
        if (!cellValue) return true;
        if (typeof cellValue === 'string') return false;

        // Remove zero width space
        const cleanedText = cellValue?.text.replace(/\u200B/g, '').trim();
        return (typeof cellValue === 'object' && cleanedText !== '') ? false : true;
      }
      case CellType.GEOLOCATION: {
        if (!cellValue) return true;
        return !getGeolocationDisplayString(cellValue, data);
      }
      case CellType.NUMBER: {
        if (!cellValue && cellValue !== 0) return true;
        if (typeof cellValue === 'string') return false;
        return !getNumberDisplayString(cellValue, data);
      }
      default: {
        return !cellValue;
      }
    }
  });
};

export const getNameValueRow = (columns, row) => {
  let nameValueRow = {};
  Object.keys(row).forEach(columnKey => {
    const column = columns.find(column => column.key === columnKey);
    if (column) {
      const { name: columnName, type, data } = column;
      let columnValue = row[columnKey];
      if (type === CellType.SINGLE_SELECT) {
        const options = data && data.options ? data.options : [];
        const option = options.find(item => item.id === columnValue);
        columnValue = option ? option.name : '';
      } else if (type === CellType.MULTIPLE_SELECT) {
        if (!Array.isArray(columnValue)) {
          columnValue = [];
        }
        const options = data && data.options ? data.options : [];
        columnValue = columnValue.map(valueItem => {
          const option = options.find(item => item.id === valueItem);
          return option ? option.name : '';
        });
      } else if (type === CellType.TEXT) {
        columnValue = columnValue ? columnValue.trim() : '';
      } else if (type === CellType.DATE && columnValue === 'current_date') {
        let format = data && data.format;
        let defaultDateFormat = 'YYYY-MM-DD';
        // Old Europe format is D/M/YYYY new format is DD/MM/YYYY
        format = format.replace(/D\/M\/YYYY/, 'DD/MM/YYYY');
        const dateFormat = format || defaultDateFormat;
        const newValue = dayjs(new Date()).format(dateFormat);
        columnValue = newValue;
      } else if (type === CellType.NUMBER) {
        if (typeof columnValue === 'string') {
          columnValue = formatStringToNumber(columnValue, data);
        }
        else if (typeof columnValue !== 'number') {
          columnValue = '';
        }
      }
      nameValueRow[columnName] = columnValue;
    }
  });
  return nameValueRow;
};

export const getLinkedRow = (linkedRowData) => {
  let newLinkedRows = [];
  let existLinkedRows = [];
  if (Object.keys(linkedRowData).length > 0) {
    Object.keys(linkedRowData).forEach(key => {
      let linkRowValue = deepCopy(linkedRowData[key]);
      let newRows = [];
      let existRows = [];
      linkRowValue.row_datas.forEach(item => {
        item._id ? existRows.push(item) : newRows.push(item);
      });

      if (newRows.length > 0) {
        newLinkedRows.push({ ...linkRowValue, ...{ row_datas: newRows } });
      }

      if (existRows.length > 0) {
        const { row_datas, ...existLinkRowsParams } = linkRowValue;
        const existRowIds = existRows.map(item => item._id);
        existLinkedRows.push({ ...existLinkRowsParams, ...{ row_ids: existRowIds } });
      }
    });
  }
  existLinkedRows = JSON.stringify(existLinkedRows);
  newLinkedRows = JSON.stringify(newLinkedRows);
  return { existLinkedRows, newLinkedRows };
};

export const isFunction = (functionToCheck) => {
  return Object.prototype.toString.call(functionToCheck) === '[object Function]';
};

export const concatToStandardUuId = (dtableUuid) => {
  return `${dtableUuid.slice(0, 8)}-${dtableUuid.slice(8, 12)}-${dtableUuid.slice(12, 16)}-${dtableUuid.slice(16, 20)}-${dtableUuid.slice(20)}`;
};

export const getLinkFieldsSettings = (columnConfig) => {
  if (!columnConfig) {
    return { linkVisibleFields: ['0000'], linkRequiredFields: [] };
  }
  const linkVisibleFields = columnConfig[COLUMN_CONFIG_KEY.LINK_VISIBLE_COLUMN_FIELDS] || ['0000'];
  const linkRequiredFields = columnConfig[COLUMN_CONFIG_KEY.LINK_REQUIRED_COLUMN_FIELDS] || [];
  return { linkVisibleFields, linkRequiredFields };
};
