import { isDateColumn } from '../column';
import {
  CellType, DISPLAY_GROUP_DATE_GRANULARITY, GROUP_DATE_GRANULARITY, SORT_TYPE, SUPPORT_GROUP_COLUMN_TYPES, GROUPBY_DATE_GRANULARITY_LIST,
} from '../../constants';

export const getDefaultCountType = (column) => {
  if (isDateColumn(column)) {
    return GROUP_DATE_GRANULARITY.MONTH;
  }
  return null;
};

export const getGroupbyColumns = (columns, groupbys = []) => {
  let groupbyColumnKeyMap = {};
  groupbys.forEach(groupby => {
    const { column_key } = groupby;
    if (column_key) {
      groupbyColumnKeyMap[column_key] = true;
    }
  });
  return columns.filter(column => {
    const { key, type } = column;
    if (!SUPPORT_GROUP_COLUMN_TYPES.includes(type)) {
      return false;
    }
    if (groupbyColumnKeyMap[key]) return false; // group by has already exist
    return true;
  });
};

export const getSelectedCountType = (column, countType) => {
  const type = countType || getDefaultCountType(column);
  if (!type) {
    return null;
  }
  if (isDateColumn(column)) {
    return DISPLAY_GROUP_DATE_GRANULARITY[type];
  }
  return null;
};

export const isShowGroupCountType = (column) => {
  if (isDateColumn(column)) return true;
  return false;
};

export const getGroupbyGranularityByColumn = (column) => {
  let granularityList = [];
  let displayGranularity = {};
  if (isDateColumn(column)) {
    granularityList = GROUPBY_DATE_GRANULARITY_LIST;
    displayGranularity = DISPLAY_GROUP_DATE_GRANULARITY;
  }
  return { granularityList, displayGranularity };
};

export const generateDefaultGroupby = (columns) => {
  const dateColumn = columns.find(column => column.type === CellType.DATE) || columns.find(column => isDateColumn(column));
  let groupby = { column_key: columns[0].key, sort_type: SORT_TYPE.UP };
  if (dateColumn) {
    groupby.column_key = dateColumn.key;
    groupby.count_type = getDefaultCountType(dateColumn);
  }
  return groupby;
};

export {
  deleteInvalidGroupby,
  isValidGroupby,
  getValidGroupbys,
} from './core';

export {
  groupTableRows,
  getGroupRows,
} from './group-row';
