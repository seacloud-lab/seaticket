import deepcopy from 'deep-copy';
import { CellType, SEQUENCE_COLUMN_WIDTH } from '../../constants';
import { getCellValueByColumn } from '../cell';

export const checkIsColumnFrozen = (column) => {
  if (!column) return false;
  return !!column.frozen;
};

export const getFrozenColumns = (columns) => {
  return columns.filter(column => checkIsColumnFrozen(column));
};

export const getFrozenColumnsWidth = (columns) => {
  let width = 0;
  columns.forEach(column => {
    if (column.frozen) {
      width += column.width;
    }
  });
  return width;
};

export const isCheckboxColumn = (column) => {
  return column.type === CellType.CHECKBOX;
};

export const getColumnByType = (columnType, columns) => {
  if (!columnType || !Array.isArray(columns)) {
    return null;
  }
  return columns.find(column => column.type === columnType);
};

export const getColumnIndexByKey = (columnKey, columns) => {
  let index = 0;
  for (let i = 0; i < columns.length; i++) {
    if (columnKey === columns[i].key) {
      index = i;
      break;
    }
  }
  return index;
};

export const getColumnByIndex = (index, columns) => {
  if (Array.isArray(columns)) {
    return columns[index];
  }
  if (typeof Immutable !== 'undefined') {
    return columns.get(index);
  }
  return null;
};

export const getColumnWidth = (column) => {
  let { type } = column;
  switch (type) {
    case CellType.CTIME:
    case CellType.MTIME: {
      return 160;
    }
    default: {
      return 100;
    }
  }
};

export const checkIsNameColumn = (column) => {
  if (!column) return false;
  return Boolean(column?.is_name_column);
};

export const checkIsPriorityColumn = (column) => {
  if (!column) return false;
  return column.type === CellType.PRIORITY;
};

export const handleCascadeColumn = (optionValue, columnKey, columns, row, updated = {}, processedColumns = new Set()) => {
  // This column has already been processed, avoid circular dependency.
  if (!Array.isArray(columns) || processedColumns.has(columnKey)) {
    return updated;
  }
  processedColumns.add(columnKey);
  const singleSelectColumns = columns.filter(column => column.type === CellType.SINGLE_SELECT);
  for (let i = 0; i < singleSelectColumns.length; i++) {
    const singleSelectColumn = singleSelectColumns[i];
    const { data: { cascade_column_key, cascade_settings } } = singleSelectColumn;
    if (cascade_column_key === columnKey) {
      const { key: childColumnKey } = singleSelectColumn;
      const childColumnOptions = cascade_settings[optionValue];
      const childColumnCellValue = getCellValueByColumn(row, singleSelectColumn);
      const cellValueInOptions = childColumnOptions && childColumnOptions.includes(childColumnCellValue);
      if (!cellValueInOptions) {
        updated[childColumnKey] = '';
        handleCascadeColumn('', childColumnKey, columns, row, updated, processedColumns);
      }
    }
  }
  return updated;
};

export const findLastFrozenColumnIndex = (columns) => {
  for (let i = 0; i < columns.length; i++) {
    if (checkIsColumnFrozen(columns[i])) {
      return i;
    }
  }
  return -1;
};

export const setColumnOffsets = (columns) => {
  let nextColumns = [];
  let left = 0;
  columns.forEach((column) => {
    nextColumns.push({ ...column, left });
    left += column.width;
  });
  return nextColumns;
};

export const checkIsColumnSupportPreview = (column) => {
  if (!column) return false;
  return !!column.is_support_preview;
};

export const checkIsColumnEditable = (column) => {
  if (!column || column.type === CellType.PRIORITY) return false;
  return !!column.editable;
};

export const checkIsPopupColumnEditor = (column) => {
  if (!column) return false;
  return !!column.is_popup_editor;
};

export const isColumnSupportDirectEdit = (column) => {
  if (!column) return false;
  return [CellType.CHECKBOX].includes(column?.type);
};

export const recalculate = (columns, allColumns) => {
  const displayColumns = columns;
  const totalWidth = displayColumns.reduce((total, column) => {
    const width = column.width;
    total += width;
    return total;
  }, 0);
  let left = SEQUENCE_COLUMN_WIDTH;
  const frozenColumns = displayColumns.filter(c => checkIsColumnFrozen(c));
  const frozenColumnsWidth = frozenColumns.reduce((w, column) => {
    const width = column.width;
    return w + width;
  }, 0);
  const lastFrozenColumnKey = frozenColumnsWidth > 0 ? frozenColumns[frozenColumns.length - 1].key : null;
  const newColumns = displayColumns.map((column, index) => {
    const width = column.width;
    column.idx = index; // set column idx
    column.left = left; // set column offset
    column.width = width;
    left += width;
    return column;
  });

  return {
    totalWidth,
    lastFrozenColumnKey,
    frozenColumnsWidth,
    columns: newColumns,
    allColumns,
  };
};

export const recalculateColumnMetricsByResizeColumn = (columnMetrics, columnKey, width) => {
  let newColumnMetrics = deepcopy(columnMetrics);

  const columnIndex = columnMetrics.columns.findIndex((column) => column.key === columnKey);
  newColumnMetrics.columns[columnIndex] = { ...columnMetrics.columns[columnIndex], width };

  const columnAllIndex = columnMetrics.allColumns.findIndex((column) => column.key === columnKey);
  newColumnMetrics.allColumns[columnAllIndex] = { ...columnMetrics.allColumns[columnIndex], width };

  return recalculate(newColumnMetrics.columns, newColumnMetrics.allColumns);
};

export const checkIsPredefinedColumn = (column) => {
  return Boolean(column.is_predefined);
};

export const getColumnOriginName = (column) => {
  const { name } = column;
  return name;
};

export const getColumnOriginType = (column) => {
  const { type } = column;
  return type;
};

export const normalizeColumns = (columns, columnsWidth, columnOrderRules) => {
  if (!Array.isArray(columns) || columns.length === 0) return [];
  let displayColumns = [];

  // Arrange columns based on predefined order
  if (columnOrderRules) {
    const otherColumns = [];
    columns.forEach(column => {
      const { name } = column;
      const order = columnOrderRules[name];
      if (order) {
        const index = order - 1;
        displayColumns[index] = column;
      } else {
        otherColumns.push(column);
      }
    });
    displayColumns = [...displayColumns, ...otherColumns].filter(c => c); // remove undefined items
  } else {
    // find name column and move to first
    columns.forEach(column => {
      if (column.is_name_column) {
        displayColumns.unshift(column);
      } else {
        displayColumns.push(column);
      }
    });
    // find type === priority column and move to first
    const priorityColumns = displayColumns.filter(c => c.type === CellType.PRIORITY);
    // use only one priority type
    if (priorityColumns.length > 0) {
      displayColumns = [priorityColumns[0], ...displayColumns.filter(c => c.type !== CellType.PRIORITY)];
    }
  }

  return displayColumns.map(c => {
    if (columnsWidth[c.key]) {
      c.width = columnsWidth[c.key];
    }
    return c;
  });
};
