import { isTableRows, getRowIdFromRow, getRowsByIds } from '../utils/row';
import { getColumnByKey, getColumnOriginName, getOption, checkIsPredefinedOption, getColumnOptionIdsByNames,
  getColumnOptionNamesByIds } from '../utils/column';
import { isValidCellValue, getCellValueByColumn, getCellValueDisplayString } from '../utils/cell';
import { getFilteredRows } from '../utils/filter';
import { getGroupRows } from '../utils/group';
import { sortTableRows } from '../utils/sort';
import { isFilterView, isGroupView, isSortView } from '../utils/view';
import { getSearchRule } from '../utils/search';
import { username } from '@/constants';
import { COLUMN_DATA_OPERATION_TYPE, OPERATION_TYPE } from './operations';
import { CellType, SUPPORT_SEARCH_COLUMNS } from '../constants';
import context from '../context';

// const DEFAULT_COMPUTER_PROPERTIES_CONTROLLER = {
//   isUpdateSummaries: true,
//   isUpdateColumnColors: true,
// };

// get rendered rows depend on filters/sorts etc.
class DataProcessor {

  static getFilteredRows(table, rows, filterConjunction, filters) {
    const tableRows = isTableRows(rows) ? rows : getRowsByIds(table, rows);
    const { row_ids } = getFilteredRows(table, tableRows, filterConjunction, filters, { username });
    return row_ids;
  }

  static getSortedRows(table, rows, sorts, { collaborators, typesData }) {
    const tableRows = isTableRows(rows) ? rows : getRowsByIds(table, rows);
    return sortTableRows(table, tableRows, sorts, { collaborators, typesData });
  }

  static getGroupedRows(table, rows, groupbys, { collaborators, typesData }) {
    const tableRows = isTableRows(rows) ? rows : getRowsByIds(table, rows);
    const groups = getGroupRows(table, tableRows, groupbys, { collaborators, typesData });
    return groups;
  }

  static updateSummaries(table, rows) {
    // todo
  }

  static hasRelatedFilters = (filters, updatedColumnKeyMap) => {
    return filters.some(filter => updatedColumnKeyMap[filter.column_key]);
  };

  static hasRelatedSort = (sorts, updatedColumnKeyMap) => {
    return sorts.some(sort => updatedColumnKeyMap[sort.column_key]);
  };

  static hasRelatedGroupby(groupbys, updatedColumnKeyMap) {
    return groupbys.some(groupby => updatedColumnKeyMap[groupby.column_key]);
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

  static run(table, { collaborators, username, userId, typesData }) {
    let rows = table.rows;
    const { filters, filter_conjunction, sorts, groupbys } = table.view;
    const availableColumns = table.view.available_columns || table.columns;
    if (!context.isViewComputedOnServer) {
      if (isFilterView({ filters }, availableColumns)) {
        const { rows: filterRows } = getFilteredRows({ columns: availableColumns }, rows, filter_conjunction, filters, { username, userId, isReturnID: false });
        rows = filterRows;
      }

      if (isSortView({ sorts }, availableColumns)) {
        rows = sortTableRows({ columns: availableColumns }, rows, sorts, { collaborators, typesData, isReturnID: false });
      }
    }

    const _isGroupView = isGroupView({ groupbys }, availableColumns);
    if (!_isGroupView) {
      table.view.rows = rows.map(row => row._id);
      return;
    }
    let renderedRows = rows;
    const groups = _isGroupView ? this.getGroupedRows(table, renderedRows, groupbys, { collaborators, typesData }) : [];
    const row_ids = isTableRows(renderedRows) ? renderedRows.map(row => row._id) : renderedRows;
    table.view.rows = row_ids;
    table.view.groups = groups;
  }

  static updateDataWithInsertRows(table, newRowIds, { collaborators, username, userId, typesData }) {
    const { filters, filter_conjunction, sorts, groupbys } = table.view;
    const availableColumns = table.view.available_columns || table.columns;
    let rows = getRowsByIds(table, table.view.rows);
    if (!context.isViewComputedOnServer) {
      let newRows = getRowsByIds(table, newRowIds);
      if (isFilterView({ filters }, availableColumns)) {
        const { rows: filterRows } = getFilteredRows({ columns: availableColumns }, newRows, filter_conjunction, filters, { username, userId, isReturnID: false });
        newRows = filterRows;
      }
      rows = [...rows, ...newRows];
      if (rows.length !== table.view.rows.length && isSortView({ sorts }, availableColumns)) {
        rows = sortTableRows({ columns: availableColumns }, rows, sorts, { collaborators, typesData, isReturnID: false });
      }
    }
    const _isGroupView = isGroupView({ groupbys }, availableColumns);
    if (!_isGroupView) {
      table.view.rows = rows.map(row => row._id);
      return;
    }
    let renderedRows = rows;
    const groups = _isGroupView ? this.getGroupedRows(table, renderedRows, groupbys, { collaborators }) : [];
    const row_ids = isTableRows(renderedRows) ? renderedRows.map(row => row._id) : renderedRows;
    table.view.rows = row_ids;
    table.view.groups = groups;
  }

  static updateDataWithModifyRows(table, relatedColumnKeyMap, rowIds, { collaborators, username, userId, typesData }) {
    const { filters, filter_conjunction, sorts, groupbys } = table.view;
    const availableColumns = table.view.available_columns || table.columns;
    let rows = getRowsByIds(table, table.view.rows);
    if (!context.isViewComputedOnServer) {
      let newRows = getRowsByIds(table, rowIds);
      if (isFilterView({ filters }, availableColumns) && this.hasRelatedFilters(filters, relatedColumnKeyMap)) {
        const { rows: filterRows } = getFilteredRows({ columns: availableColumns }, newRows, filter_conjunction, filters, { username, userId, isReturnID: false });
        newRows = filterRows;
      }
      if (newRows.length === 0) {
        rows = rows.filter(r => !rowIds.includes(r._id));
      }
      if (isSortView({ sorts }, availableColumns) && this.hasRelatedSort(sorts, relatedColumnKeyMap)) {
        rows = sortTableRows({ columns: availableColumns }, rows, sorts, { collaborators, typesData, isReturnID: false });
      }
    }
    const _isGroupView = isGroupView({ groupbys }, availableColumns);
    if (!_isGroupView) {
      table.view.rows = rows.map(row => row._id);
      return;
    }
    const isRegroup = _isGroupView && this.hasRelatedGroupby(groupbys, relatedColumnKeyMap);
    if (isRegroup) {
      table.view.groups = this.getGroupedRows(table, rows, groupbys, { collaborators });
    }
  }

  static updateDataWithDeleteRows(deletedRowsIds, table) {
    const { available_columns, groupbys, groups, rows } = table.view;
    const idNeedDeletedMap = deletedRowsIds.reduce((currIdNeedDeletedMap, rowId) => ({ ...currIdNeedDeletedMap, [rowId]: true }), {});
    table.view.rows = rows.filter(rowId => !idNeedDeletedMap[rowId]);

    // remove row from group view
    const _isGroupView = isGroupView({ groupbys }, available_columns);
    if (_isGroupView) {
      this.deleteGroupRows(groups, idNeedDeletedMap);
      table.view.groups = this.deleteEmptyGroups(groups);
    }
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

  static updateRowsWithModifyColumnData(table, column, operation) {
    const { old_data, new_data } = operation;
    const columnName = getColumnOriginName(column);
    const columnType = column.type;
    const oldColumn = { ...column, data: old_data };
    const newColumn = { ...column, data: new_data };

    // modify row data
    for (const row of table.rows) {
      const cellValue = getCellValueByColumn(row, column);
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
        const { available_columns } = table.view;
        const { row_update, row_id } = operation;
        let relatedColumnKeyMap = {};
        let relatedColumnKeys = [...Object.keys(row_update)];
        relatedColumnKeys.forEach(columnKey => {
          if (!relatedColumnKeyMap[columnKey]) {
            const column = getColumnByKey(available_columns, columnKey);
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
        const { available_columns } = table.view;
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
            const column = getColumnByKey(available_columns, columnKey);
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
        const { available_columns } = table.view;
        const { original_updates } = operation;
        const relatedColumnKeyMap = {};
        for (let columnKey in original_updates) {
          const column = getColumnByKey(available_columns, columnKey);
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
        const { available_columns, groupbys, rows } = table.view;
        if (!isGroupView({ groupbys }, available_columns)) {
          table.view.groups = [];
          break;
        }
        table.view.groups = this.getGroupedRows(table, rows, groupbys, { collaborators });
        break;
      }
      case OPERATION_TYPE.MODIFY_COLUMN_DATA:
      case OPERATION_TYPE.MODIFY_LOCAL_COLUMN_DATA: {
        const { column_key, option_modify_type } = operation;
        const column = getColumnByKey(table.columns, column_key);
        if (!column) break;
        if (column.type === CellType.SINGLE_SELECT || column.type === CellType.MULTIPLE_SELECT) {
          if (option_modify_type === COLUMN_DATA_OPERATION_TYPE.RENAME_OPTION) {
            this.updateRowsWithModifyColumnData(table, column, operation);
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
        }
        const { available_columns, groupbys, rows } = table.view;
        if (!isGroupView({ groupbys }, available_columns)) {
          table.view.groups = [];
          break;
        }
        table.view.groups = this.getGroupedRows(table, rows, groupbys, { collaborators });
        break;
      }
      default: {
        break;
      }
    }
  }
}

export default DataProcessor;
