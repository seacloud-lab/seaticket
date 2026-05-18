import { isTableRows, getRowIdFromRow, getRowsByIds } from '../utils/row';
import { getColumnByKey, getColumnOriginName, getOption, checkIsPredefinedOption, getColumnOptionIdsByNames,
  getColumnOptionNamesByIds } from '../utils/column';
import { isValidCellValue, getCellValueByColumn, getCellValueDisplayString } from '../utils/cell';
import { getFilteredRows } from '../utils/filter';
import { getGroupRows } from '../utils/group';
import { sortTableRows } from '../utils/sort';
import { isFilterView, isGroupView, isSortView, getRowColors } from '../utils/view';
import { getSearchRule } from '../utils/search';
import { COLUMN_DATA_OPERATION_TYPE, OPERATION_TYPE } from './operations';
import { CellType, SUPPORT_SEARCH_COLUMNS } from '../constants';
import context from '../context';

// const DEFAULT_COMPUTER_PROPERTIES_CONTROLLER = {
//   isUpdateSummaries: true,
//   isUpdateColumnColors: true,
// };

// get rendered rows depend on filters/sorts etc.
class DataProcessor {

  static getSortedRows(table, rows, sorts, { collaborators, typesData, tagsData }) {
    const tableRows = isTableRows(rows) ? rows : getRowsByIds(table, rows);
    return sortTableRows(table, tableRows, sorts, { collaborators, typesData, tagsData });
  }

  static getGroupedRows(table, rows, groupbys, { collaborators, typesData, tagsData }) {
    const tableRows = isTableRows(rows) ? rows : getRowsByIds(table, rows);
    const groups = getGroupRows(table, tableRows, groupbys, { collaborators, typesData, tagsData });
    return groups;
  }

  static updateSummaries(table, rows) {
    // todo
  }

  static hasRelatedFilters = (view, updatedColumnKeyMap) => {
    const { filters, basic_filters = [] } = view;
    return (Array.isArray(filters) && filters.some(filter => updatedColumnKeyMap[filter.column_key])) ||
      (Array.isArray(basic_filters) && basic_filters.some(filter => updatedColumnKeyMap[filter.column_key]));
  };

  static hasRelatedSort = (sorts, updatedColumnKeyMap) => {
    return sorts.some(sort => updatedColumnKeyMap[sort.column_key]);
  };

  static hasRelatedGroupby(groupbys, updatedColumnKeyMap) {
    return groupbys.some(groupby => updatedColumnKeyMap[groupby.column_key]);
  }

  static hasRelatedRowColor(colorbys, updatedColumnKeyMap) {
    const colorRules = colorbys?.color_by_rules;
    if (!Array.isArray(colorRules) || colorRules.length === 0) return false;
    return colorRules.some(rule => {
      const filters = rule?.filters;
      return Array.isArray(filters) && filters.some(filter => updatedColumnKeyMap[filter.column_key]);
    });
  }

  static deleteGroupRows(groups, idDeletedRowMap) {
    groups.forEach(group => {
      const { subgroups, row_ids } = group;
      if (Array.isArray(subgroups) && subgroups.length > 0) {
        this.deleteGroupRows(subgroups, idDeletedRowMap);
      } else if (row_ids) {
        group.row_ids = row_ids.filter(rowId => !idDeletedRowMap[rowId]);
      }
    });
  }

  static deleteEmptyGroups = (groups) => {
    return groups.filter(group => {
      const { subgroups, row_ids } = group;
      if (subgroups && subgroups.length > 0) {
        const validSubGroups = this.deleteEmptyGroups(subgroups);
        if (validSubGroups.length === 0) {
          return false;
        }
        return true;
      }
      if (!row_ids || row_ids.length === 0) {
        return false;
      }
      return true;
    });
  };

  static run(table, { collaborators, username, userId, typesData, tagsData }) {
    let rows = table.rows;
    const { filters, filter_conjunction, basic_filters, sorts, groupbys } = table.view;
    const availableColumns = table.view.columns || table.columns;
    const isFilterComputedOnServer = context.getSetting('isFilterComputedOnServer', true);
    const isSortComputedOnServer = context.getSetting('isSortComputedOnServer', true);
    if (!isFilterComputedOnServer && isFilterView(table.view, availableColumns)) {
      const { rows: filterRows } = getFilteredRows(
        { columns: availableColumns },
        rows,
        { basicFilters: basic_filters, filters, filterConjunction: filter_conjunction },
        { username, userId, isReturnID: false, tagsData }
      );
      rows = filterRows;
    }

    if (!isSortComputedOnServer && isSortView({ sorts }, availableColumns)) {
      rows = sortTableRows({ columns: availableColumns }, rows, sorts, { collaborators, typesData, tagsData, isReturnID: false });
    }

    table.view.colors = getRowColors(rows, table.view, availableColumns, { username, userId, tagsData });

    const _isGroupView = isGroupView({ groupbys }, availableColumns);
    if (!_isGroupView) {
      table.view.rows = rows.map(row => row._id);
      return;
    }
    let renderedRows = rows;
    const groups = _isGroupView ? this.getGroupedRows(table, renderedRows, groupbys, { collaborators, typesData, tagsData }) : [];
    const row_ids = isTableRows(renderedRows) ? renderedRows.map(row => row._id) : renderedRows;
    table.view.rows = row_ids;
    table.view.groups = groups;
  }

  static updateDataWithInsertRows(table, newRowIds, { collaborators, username, userId, typesData, tagsData }) {
    const { basic_filters, filters, filter_conjunction, sorts, groupbys } = table.view;
    const availableColumns = table.view.columns || table.columns;
    let rows = getRowsByIds(table, table.view.rows);
    const isFilterComputedOnServer = context.getSetting('isFilterComputedOnServer', true);
    const isSortComputedOnServer = context.getSetting('isSortComputedOnServer', true);
    if (!isFilterComputedOnServer) {
      let newRows = getRowsByIds(table, newRowIds);
      if (isFilterView(table.view, availableColumns)) {
        const { rows: filterRows } = getFilteredRows(
          { columns: availableColumns },
          newRows,
          { basicFilters: basic_filters, filters, filterConjunction: filter_conjunction },
          { username, userId, isReturnID: false }
        );
        newRows = filterRows;
      }
      rows = [...rows, ...newRows];
    }
    if (!isSortComputedOnServer && rows.length !== table.view.rows.length && isSortView({ sorts }, availableColumns)) {
      rows = sortTableRows({ columns: availableColumns }, rows, sorts, { collaborators, typesData, tagsData, isReturnID: false });
    }
    table.view.colors = getRowColors(rows, table.view, availableColumns, { username, userId, tagsData });
    const _isGroupView = isGroupView({ groupbys }, availableColumns);
    if (!_isGroupView) {
      table.view.rows = rows.map(row => row._id);
      return;
    }
    let renderedRows = rows;
    const groups = _isGroupView ? this.getGroupedRows(table, renderedRows, groupbys, { collaborators, typesData, tagsData }) : [];
    const row_ids = isTableRows(renderedRows) ? renderedRows.map(row => row._id) : renderedRows;
    table.view.rows = row_ids;
    table.view.groups = groups;
  }

  static updateDataWithModifyRows(table, relatedColumnKeyMap, rowIds, { collaborators, username, userId, typesData, tagsData }) {
    const { basic_filters, filters, filter_conjunction, sorts, groupbys, colorbys } = table.view;
    const availableColumns = table.view.columns || table.columns;
    let rows = getRowsByIds(table, table.view.rows);
    const isFilterComputedOnServer = context.getSetting('isFilterComputedOnServer', true);
    const isSortComputedOnServer = context.getSetting('isSortComputedOnServer', true);
    if (!isFilterComputedOnServer) {
      let newRows = getRowsByIds(table, rowIds);
      if (isFilterView(table.view, availableColumns) && this.hasRelatedFilters(table.view, relatedColumnKeyMap)) {
        const { rows: filterRows } = getFilteredRows(
          { columns: availableColumns },
          newRows,
          { basicFilters: basic_filters, filters, filterConjunction: filter_conjunction },
          { username, userId, isReturnID: false }
        );
        newRows = filterRows;
      }
      if (newRows.length === 0) {
        rows = rows.filter(r => !rowIds.includes(r._id));
      }
    }
    if (!isSortComputedOnServer && isSortView({ sorts }, availableColumns) && this.hasRelatedSort(sorts, relatedColumnKeyMap)) {
      rows = sortTableRows({ columns: availableColumns }, rows, sorts, { collaborators, typesData, tagsData, isReturnID: false });
    }

    if (this.hasRelatedRowColor(colorbys, relatedColumnKeyMap)) {
      table.view.colors = getRowColors(rows, table.view, availableColumns, { username, userId, tagsData });
    }

    const _isGroupView = isGroupView({ groupbys }, availableColumns);
    if (!_isGroupView) {
      table.view.rows = rows.map(row => row._id);
      return;
    }
    const isRegroup = _isGroupView && this.hasRelatedGroupby(groupbys, relatedColumnKeyMap);
    if (isRegroup) {
      table.view.groups = this.getGroupedRows(table, rows, groupbys, { collaborators, typesData, tagsData });
    }
  }

  static updateDataWithDeleteRows(deletedRowsIds, table) {
    const { columns, groupbys, groups, rows } = table.view;
    const idNeedDeletedMap = deletedRowsIds.reduce((currIdNeedDeletedMap, rowId) => ({ ...currIdNeedDeletedMap, [rowId]: true }), {});
    table.view.rows = rows.filter(rowId => !idNeedDeletedMap[rowId]);

    // remove row from group view
    const _isGroupView = isGroupView({ groupbys }, columns);
    if (_isGroupView) {
      this.deleteGroupRows(groups, idNeedDeletedMap);
      table.view.groups = this.deleteEmptyGroups(groups);
    }
    table.view.colors = getRowColors(table.rows, table.view, columns);
  }

  static handleReloadedRows(table, reloadedRows, relatedColumnKeyMap) {
    const idReloadedRowMap = reloadedRows.reduce((map, row) => {
      map[row._id] = row;
      return map;
    }, {});
    table.rows.forEach((row, index) => {
      const rowId = row._id;
      const reloadedRow = idReloadedRowMap[rowId];
      const newRow = Object.assign({}, table.rows[index], reloadedRow);
      if (reloadedRow) {
        table.rows[index] = newRow;
        table.id_row_map[rowId] = newRow;
      }
    });

    this.updateDataWithModifyRows();
    this.updateSummaries();
  }

  static handleNotExistRows(table, idRowNotExistMap) {
    let notExistRows = [];
    let existRows = [];
    table.rows.forEach((row) => {
      const rowId = row._id;
      if (idRowNotExistMap[rowId]) {
        notExistRows.push(row);
        delete table.id_row_map[rowId];
      } else {
        existRows.push(row);
      }
    });
    table.rows = table.rows.filter((row) => !idRowNotExistMap[row._id]);
    table.view.rows = table.rows.filter((rowId) => !idRowNotExistMap[rowId]);

    this.updateSummaries();
  }

  static updateRowsWithModifyColumnData(table, column, operation, { tagsData } = {}) {
    const { old_data, new_data } = operation;
    const columnName = getColumnOriginName(column);
    const columnType = column.type;
    const oldColumn = { ...column, data: old_data };
    const newColumn = { ...column, data: new_data };

    // modify row data
    for (const row of table.rows) {
      const cellValue = getCellValueByColumn(row, column, { tagsData });
      if (isValidCellValue(cellValue, column)) {
        if (columnType === CellType.SINGLE_SELECT && !checkIsPredefinedOption(column, cellValue)) {
          const oldOptions = old_data?.options || [];
          const newOptions = new_data?.options || [];
          const oldOption = getOption(oldOptions, cellValue);
          const newOption = getOption(newOptions, oldOption?.id);
          row[columnName] = newOption ? newOption.name : null;
        } else if (columnType === CellType.MULTIPLE_SELECT) {
          const oldOptionIds = getColumnOptionIdsByNames(oldColumn, cellValue);
          const newOptionNames = getColumnOptionNamesByIds(newColumn, oldOptionIds);
          row[columnName] = newOptionNames ? newOptionNames : null;
        }
        const id = getRowIdFromRow(row);
        table.id_row_map[id] = row;
      }
    }
  }

  static syncOperationOnData(table, operation, { collaborators, tagsData, typesData }) {
    switch (operation.op_type) {
      case OPERATION_TYPE.INSERT_ROW: {
        const { row } = operation;
        this.updateDataWithInsertRows(table, [row._id], { collaborators, tagsData, typesData });
        this.updateSummaries();
        break;
      }
      case OPERATION_TYPE.MODIFY_ROW: {
        const { columns } = table.view;
        const { row_update, row_id } = operation;
        let relatedColumnKeyMap = {};
        let relatedColumnKeys = [...Object.keys(row_update)];
        relatedColumnKeys.forEach(columnKey => {
          if (!relatedColumnKeyMap[columnKey]) {
            const column = getColumnByKey(columns, columnKey);
            if (column) {
              relatedColumnKeyMap[columnKey] = true;
            }
          }
        });
        this.updateDataWithModifyRows(table, relatedColumnKeyMap, [row_id], { collaborators, typesData });
        this.updateSummaries();
        break;
      }
      case OPERATION_TYPE.MODIFY_ROWS: {
        const { columns } = table.view;
        const { id_row_updates, row_ids } = operation;
        let relatedColumnKeyMap = {};
        let relatedColumnKeys = [];
        row_ids.forEach(rowId => {
          const id_row_update = id_row_updates[rowId];
          if (id_row_update) {
            relatedColumnKeys.push(...Object.keys(id_row_update));
          }
        });
        relatedColumnKeys.forEach(columnKey => {
          if (!relatedColumnKeyMap[columnKey]) {
            const column = getColumnByKey(columns, columnKey);
            if (column) {
              relatedColumnKeyMap[columnKey] = true;
            }
          }
        });
        this.updateDataWithModifyRows(table, relatedColumnKeyMap, row_ids, { collaborators, typesData });
        this.updateSummaries();
        break;
      }
      case OPERATION_TYPE.MODIFY_ROW_VIA_BUTTON: {
        const { columns } = table.view;
        const { original_updates } = operation;
        const relatedColumnKeyMap = {};
        for (let columnKey in original_updates) {
          const column = getColumnByKey(columns, columnKey);
          if (column) {
            relatedColumnKeyMap[columnKey] = true;
          }
        }
        this.updateDataWithModifyRows(table, relatedColumnKeyMap, [], { collaborators, typesData });
        this.updateSummaries();
        break;
      }
      case OPERATION_TYPE.DELETE_ROW: {
        const { row_id } = operation;
        this.updateDataWithDeleteRows([row_id], table);
        this.updateSummaries();
        break;
      }
      case OPERATION_TYPE.DELETE_ROWS: {
        const { success_rows } = operation;
        this.updateDataWithDeleteRows(success_rows, table);
        this.updateSummaries();
        break;
      }
      case OPERATION_TYPE.DELETE_LOCAL_ROWS: {
        const { row_ids } = operation;
        this.updateDataWithDeleteRows(row_ids, table);
        this.updateSummaries();
        break;
      }
      case OPERATION_TYPE.RESTORE_ROWS: {
        const { rows_data, upper_row_ids } = operation;
        const { rows } = table.view;
        const insertRowIds = rows_data.map(rowData => rowData._id);
        let updatedRowIds = [...rows];
        if (!Array.isArray(upper_row_ids) || upper_row_ids.length === 0) {
          updatedRowIds.push(...insertRowIds);
        } else {
          upper_row_ids.forEach((upperRowId, index) => {
            const insertRowId = insertRowIds[index];
            const upperRowIndex = updatedRowIds.indexOf(upperRowId);
            if (upperRowIndex < 0) {
              updatedRowIds.push(insertRowId);
            } else {
              updatedRowIds.splice(upperRowIndex + 1, 0, insertRowId);
            }
          });
        }
        table.view.rows = updatedRowIds;
        this.updateDataWithModifyRows(table, {}, [], { collaborators, typesData });
        this.updateSummaries();
        break;
      }
      case OPERATION_TYPE.MOVE_ROW: {
        this.run(table, { collaborators });
        break;
      }
      case OPERATION_TYPE.MODIFY_GROUPBYS: {
        const { columns, groupbys, rows } = table.view;
        if (!isGroupView({ groupbys }, columns)) {
          table.view.groups = [];
          break;
        }
        table.view.groups = this.getGroupedRows(table, rows, groupbys, { collaborators, typesData, tagsData });
        break;
      }
      case OPERATION_TYPE.MODIFY_ROW_COLOR: {
        const availableColumns = table.view.columns || table.columns;
        const renderedRows = getRowsByIds(table, table.view.rows);
        table.view.colors = getRowColors(renderedRows, table.view, availableColumns, { tagsData });
        break;
      }
      case OPERATION_TYPE.MODIFY_COLUMN_DATA:
      case OPERATION_TYPE.MODIFY_LOCAL_COLUMN_DATA: {
        const { column_key, option_modify_type } = operation;
        const column = getColumnByKey(table.columns, column_key);
        if (!column) break;
        if (column.type === CellType.SINGLE_SELECT || column.type === CellType.MULTIPLE_SELECT) {
          if (option_modify_type === COLUMN_DATA_OPERATION_TYPE.RENAME_OPTION) {
            this.updateRowsWithModifyColumnData(table, column, operation, { tagsData });
          }
        }
        break;
      }
      case OPERATION_TYPE.MODIFY_SETTINGS: {
        const { settings } = operation;
        table.view.settings = settings;
        break;
      }
      case OPERATION_TYPE.SEARCH_ROWS: {
        const { value } = operation;
        if (!value) {
          table.isSearchView = false;
          table.view.rows = table.rows.map(r => r._id);
        } else {
          const regValue = getSearchRule(value);
          const columns = table.view.columns.filter(c => SUPPORT_SEARCH_COLUMNS.includes(c.type));
          let viewRows = [];

          for (let i = 0; i < table.rows.length; i++) {
            const row = table.rows[i];
            const copyRegValue = regValue.map(item => ({ ...item }));
            for (let j = 0; j < columns.length; j++) {
              const column = columns[j];
              const cellValue = getCellValueDisplayString(row, column, { collaborators, tagsData, typesData });
              for (let k = 0; k < copyRegValue.length; k++) {
                const reg = copyRegValue[k].reg;
                const isMatched = reg.test(cellValue);
                if (isMatched) {
                  copyRegValue[k].isMatched = true;
                }
              }
            }
            if (copyRegValue.every(item => item.isMatched)) {
              viewRows.push(row._id);
            }
          }
          table.view.rows = viewRows;
          table.isSearchView = true;
        }
        const { columns, groupbys, rows } = table.view;
        if (!isGroupView({ groupbys }, columns)) {
          table.view.groups = [];
          break;
        }
        table.view.groups = this.getGroupedRows(table, rows, groupbys, { collaborators, typesData, tagsData });
        break;
      }
      default: {
        break;
      }
    }
  }
}

export default DataProcessor;
