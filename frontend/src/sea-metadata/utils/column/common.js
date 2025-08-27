import dcopy from 'deep-copy';
import { CellType, SEQUENCE_COLUMN_WIDTH } from '../../constants';
import context from '../../context';

export const getFrozenColumns = (columns) => {
  return columns.filter(column => column.frozen);
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

export const checkIsColumnFrozen = (column) => {
  if (!column) return false;
  return !!column.frozen;
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
      const childColumnCellValue = row[childColumnKey];
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
  if (!column) return false;
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
  let newColumnMetrics = dcopy(columnMetrics);

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
  const { key, name } = column;
  return checkIsPredefinedColumn(column) ? key : name;
};

export const getColumnOriginType = (column) => {
  const { type } = column;
  return type;
};

export const normalizeColumns = (columns) => {
  if (!Array.isArray(columns) || columns.length === 0) return [];
  const columnsWidth = context.localStorage.getItem('columns_width') || {};
  let displayColumns = [];
  columns.forEach(column => {
    if (column.is_name_column) {
      displayColumns.unshift(column);
    } else {
      displayColumns.push(column);
    }
  });
  return displayColumns.map(c => {
    if (columnsWidth[c.key]) {
      c.width = columnsWidth[c.key];
    }
    return c;
  });
};
