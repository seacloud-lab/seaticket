import { isDateColumn } from '../column';
import {
  CellType, FILTER_PREDICATE_TYPE, FILTER_COLUMN_OPTIONS, FILTER_TERM_MODIFIER_TYPE, FILTER_ERR_MSG,
  filterTermModifierNotWithin, filterTermModifierIsWithin,
} from '../../constants';

export const SIMPLE_TEXT_INPUT_COLUMNS_MAP = {
  [CellType.TEXT]: true,
  [CellType.URL]: true,
};

export const DATE_LABEL_MAP = {
  [FILTER_TERM_MODIFIER_TYPE.EXACT_DATE]: true,
  [FILTER_TERM_MODIFIER_TYPE.NUMBER_OF_DAYS_AGO]: true,
  [FILTER_TERM_MODIFIER_TYPE.NUMBER_OF_DAYS_FROM_NOW]: true,
  [FILTER_TERM_MODIFIER_TYPE.THE_NEXT_NUMBERS_OF_DAYS]: true,
  [FILTER_TERM_MODIFIER_TYPE.THE_PAST_NUMBERS_OF_DAYS]: true,
};

export const ARRAY_PREDICATE = {
  [FILTER_PREDICATE_TYPE.IS_ANY_OF]: true,
  [FILTER_PREDICATE_TYPE.IS_NONE_OF]: true,
  [FILTER_PREDICATE_TYPE.HAS_ANY_OF]: true,
  [FILTER_PREDICATE_TYPE.HAS_ALL_OF]: true,
  [FILTER_PREDICATE_TYPE.HAS_NONE_OF]: true,
  [FILTER_PREDICATE_TYPE.IS_EXACTLY]: true,
};

const STRING_PREDICATE = {
  [FILTER_PREDICATE_TYPE.IS]: true,
  [FILTER_PREDICATE_TYPE.IS_NOT]: true
};

export const DATA_EMPTY_LABEL_MAP = {
  [FILTER_PREDICATE_TYPE.EMPTY]: true,
  [FILTER_PREDICATE_TYPE.NOT_EMPTY]: true,
};

export const FILTER_ERR_MSG_LIST = [
  FILTER_ERR_MSG.INVALID_FILTER,
  FILTER_ERR_MSG.INCOMPLETE_FILTER,
  FILTER_ERR_MSG.COLUMN_MISSING,
  FILTER_ERR_MSG.COLUMN_NOT_SUPPORTED,
  FILTER_ERR_MSG.UNMATCHED_PREDICATE,
  FILTER_ERR_MSG.UNMATCHED_MODIFIER,
  FILTER_ERR_MSG.INVALID_TERM,
];

const MULTIPLE_SELECTOR_COLUMNS = [
  CellType.MULTIPLE_SELECT,
  CellType.COLLABORATOR,
  CellType.TAGS,
];

export const isFilterTermArray = (column, predicate) => {
  const { type } = column;
  if (MULTIPLE_SELECTOR_COLUMNS.includes(type)) {
    return true;
  }

  if ([CellType.CREATOR, CellType.LAST_MODIFIER].includes(type)) {
    return [FILTER_PREDICATE_TYPE.CONTAINS, FILTER_PREDICATE_TYPE.NOT_CONTAIN].includes(predicate);
  }
  if ((type === CellType.SINGLE_SELECT || type === CellType.TYPE) && ARRAY_PREDICATE[predicate]) {
    return true;
  }
  return false;
};

export const getColumnOptions = (column) => {
  const { type } = column;
  return FILTER_COLUMN_OPTIONS[type] || {};
};

export const getFilterByColumn = (column, filter = {}) => {
  let { filterPredicateList } = getColumnOptions(column);
  if (!filterPredicateList) return;
  let filterPredicate = filterPredicateList[0];

  let updatedFilter = Object.assign({}, filter, { column_key: column.key, filter_predicate: filterPredicate });

  // text | number | long-text | url | email
  // auto-number | geolocation | duration
  updatedFilter.filter_term = '';

  // single-select | multiple-select | collaborators | creator | last-modifier
  if (isFilterTermArray(column, filterPredicate)) {
    updatedFilter.filter_term = [];
    return updatedFilter;
  }
  // date | ctime | mtime
  if (isDateColumn(column)) {
    let filterTermModifier = filterPredicate === FILTER_PREDICATE_TYPE.IS_WITHIN ? filterTermModifierIsWithin[0] : filterTermModifierNotWithin[0];
    updatedFilter.filter_term_modifier = filterTermModifier;
    updatedFilter.filter_term = '';
    return updatedFilter;
  }

  return updatedFilter;
};

// file, image : not support
// text, long-text, number, single-select, date, ctime, mtime, formula, link, geolocation : string
// checkbox : boolean
// multiple-select, collaborator, creator, last modifier : array

export const getUpdatedFilterByColumn = (filters, filterIndex, column) => {
  const filter = filters[filterIndex];
  if (filter.column_key === column.key) {
    return;
  }
  return getFilterByColumn(column, filter);
};

export const getUpdatedFilterByPredicate = (filter, column, filterPredicate) => {
  let updatedFilter = Object.assign({}, filter, { filter_predicate: filterPredicate });
  let { type: columnType } = column;
  if (columnType === CellType.CHECKBOX || columnType === CellType.UNREAD_STATUS || columnType === CellType.REPLY_STATUS) {
    updatedFilter.filter_term = false;
    return updatedFilter;
  }

  if (columnType === CellType.SINGLE_SELECT || columnType === CellType.TYPE) {
    if (ARRAY_PREDICATE[filterPredicate]) {
      if (ARRAY_PREDICATE[filter.filter_predicate] !== ARRAY_PREDICATE[filterPredicate]) {
        updatedFilter.filter_term = [];
      }
    } else if (STRING_PREDICATE[filterPredicate]) {
      if (STRING_PREDICATE[filter.filter_predicate] !== STRING_PREDICATE[filterPredicate]) {
        updatedFilter.filter_term = '';
      }
    } else {
      updatedFilter.filter_term = '';
    }
    return updatedFilter;
  }

  if ([CellType.CREATOR, CellType.LAST_MODIFIER].includes(columnType)) {
    if (STRING_PREDICATE[filter.filter_predicate] !== STRING_PREDICATE[filterPredicate]
      || filterPredicate === FILTER_PREDICATE_TYPE.INCLUDE_ME
    ) {
      updatedFilter.filter_term = [];
    }
  }
  if (isFilterTermArray(column, filterPredicate)) {
    if (DATA_EMPTY_LABEL_MAP[filterPredicate] || filterPredicate === FILTER_PREDICATE_TYPE.INCLUDE_ME) {
      updatedFilter.filter_term = [];
    }
    return updatedFilter;
  }
  if (isDateColumn(column)) {
    let filterTermModifier = filterPredicate === FILTER_PREDICATE_TYPE.IS_WITHIN ? filterTermModifierIsWithin[0] : filterTermModifierNotWithin[0];
    updatedFilter.filter_term_modifier = filterTermModifier;
    return updatedFilter;
  }

  return updatedFilter;
};

export const getUpdatedFilterByTermModifier = (filter, filterTermModifier) => {
  if (filter.filter_term_modifier === filterTermModifier) {
    return;
  }
  return Object.assign({}, filter, { filter_term_modifier: filterTermModifier });
};

export const getUpdatedFilterByNormalTerm = (filter, column, filterIndex, event) => {
  let filterTerm;
  if (column.type === CellType.CHECKBOX || column.type === CellType.UNREAD_STATUS || column.type === CellType.REPLY_STATUS) {
    filterTerm = event.target.checked;
  } else {
    filterTerm = event.target.value;
  }
  if (filter.filter_term === filterTerm) {
    return filter;
  }
  return Object.assign({}, filter, { filter_term: filterTerm });
};

export {
  getValidFilters,
  getValidFiltersWithoutError,
  deleteInvalidFilter,
  otherDate,
  getFormattedFilterOtherDate,
  getFormattedFilter,
  getFormattedFilters,
} from './core';

export {
  creatorFilter,
  dateFilter,
  textFilter,
} from './filter-column';

export {
  filterRow,
  filterRows,
  getFilteredRows,
} from './filter-row';
