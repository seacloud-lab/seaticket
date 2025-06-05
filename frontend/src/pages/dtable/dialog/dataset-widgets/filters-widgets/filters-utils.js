import {
  FILTER_PREDICATE_TYPE,
  FILTER_COLUMN_OPTIONS,
  FILTER_TERM_MODIFIER_TYPE,
  filterTermModifierNotWithin,
  filterTermModifierIsWithin,
  CellType,
  isDateColumn,
  isNumericColumn,
  FORMULA_COLUMN_TYPES,
  FORMULA_RESULT_TYPE,
  COLLABORATOR_COLUMN_TYPES,
  DATE_COLUMN_OPTIONS
} from 'dtable-utils';

export const SPECIAL_TERM_TYPE = {
  CREATOR: 'creator',
  SINGLE_SELECT: 'single_select',
  MULTIPLE_SELECT: 'multiple_select',
  COLLABORATOR: 'collaborator',
  RATE: 'rate'
};

export const SIMPLE_TEXT_INPUT_COLUMNS_MAP = {
  [CellType.TEXT]: true,
  [CellType.LONG_TEXT]: true,
  [CellType.GEOLOCATION]: true,
  [CellType.AUTO_NUMBER]: true,
  [CellType.EMAIL]: true,
  [CellType.URL]: true,
  [CellType.IMAGE]: true,
  [CellType.FILE]: true,
  [FORMULA_RESULT_TYPE.STRING]: true,
  [FORMULA_RESULT_TYPE.BOOL]: true,
};

export const DATE_LABEL_MAP = {
  [FILTER_TERM_MODIFIER_TYPE.EXACT_DATE]: true,
  [FILTER_TERM_MODIFIER_TYPE.NUMBER_OF_DAYS_AGO]: true,
  [FILTER_TERM_MODIFIER_TYPE.NUMBER_OF_DAYS_FROM_NOW]: true,
  [FILTER_TERM_MODIFIER_TYPE.THE_NEXT_NUMBERS_OF_DAYS]: true,
  [FILTER_TERM_MODIFIER_TYPE.THE_PAST_NUMBERS_OF_DAYS]: true,
};

export const DATE_EMPTY_LABEL_MAP = {
  [FILTER_PREDICATE_TYPE.EMPTY]: true,
  [FILTER_PREDICATE_TYPE.NOT_EMPTY]: true,
};

const MULTIPLE_SELECTOR_COLUMNS = [CellType.MULTIPLE_SELECT, CellType.COLLABORATOR, CellType.CREATOR, CellType.LAST_MODIFIER];

const isArrayFilterTermByArrayType = (array_type) => {
  return COLLABORATOR_COLUMN_TYPES.includes(array_type) ||
    array_type === CellType.SINGLE_SELECT ||
    array_type === CellType.MULTIPLE_SELECT;
};

export const isFilterTermArray = (column, filterPredicate) => {
  const { type, data } = column;
  if (MULTIPLE_SELECTOR_COLUMNS.includes(type)) {
    return true;
  }
  if (type === CellType.SINGLE_SELECT && [FILTER_PREDICATE_TYPE.IS_ANY_OF, FILTER_PREDICATE_TYPE.IS_NONE_OF].includes(filterPredicate)) {
    return true;
  } else if (FORMULA_COLUMN_TYPES.includes(type)) {
    const { result_type, array_type } = data || {};
    return result_type === FORMULA_RESULT_TYPE.ARRAY && isArrayFilterTermByArrayType(array_type);
  } else if (type === CellType.LINK) {
    const { array_type } = data || {};
    return isArrayFilterTermByArrayType(array_type);
  }
  return false;
};

export const getUpdatedFilterByCreator = (filter, collaborator) => {
  const multipleSelectType = [FILTER_PREDICATE_TYPE.CONTAINS, FILTER_PREDICATE_TYPE.NOT_CONTAIN];
  let { filter_predicate, filter_term: filterTerm } = filter;
  if (multipleSelectType.includes(filter_predicate)) {
    filterTerm = filterTerm ? filter.filter_term.slice(0) : [];
    let selectedEmail = collaborator.email;
    let collaborator_index = filterTerm.indexOf(selectedEmail);
    if (collaborator_index > -1) {
      filterTerm.splice(collaborator_index, 1);
    } else {
      filterTerm.push(selectedEmail);
    }
  } else {
    if (filterTerm[0] === collaborator.email) {
      return;
    }
    filterTerm = [collaborator.email];
  }
  return Object.assign({}, filter, { filter_term: filterTerm });
};

export const getUpdatedFilterBySelectSingle = (filter, columnOption) => {
  let new_filter_term;
  // if predicate is any of / is none of, filter_term is array; else filter_term is string
  if (filter.filter_predicate === FILTER_PREDICATE_TYPE.IS_ANY_OF || filter.filter_predicate === FILTER_PREDICATE_TYPE.IS_NONE_OF) {
    new_filter_term = Array.isArray(filter.filter_term) ? [...filter.filter_term] : [];
    const index = new_filter_term.indexOf(columnOption.id);
    if (index === -1) {
      new_filter_term.push(columnOption.id);
    } else {
      new_filter_term.splice(index, 1);
    }
  } else {
    new_filter_term = columnOption.id;
  }
  return Object.assign({}, filter, { filter_term: new_filter_term });
};

export const getUpdatedFilterBySelectMultiple = (filter, columnOption) => {
  let filterTerm = filter.filter_term ? filter.filter_term : [];
  let index = filterTerm.indexOf(columnOption.id);
  if (index > -1) {
    filterTerm.splice(index, 1);
  } else {
    filterTerm.push(columnOption.id);
  }
  return Object.assign({}, filter, { filter_term: filterTerm });
};

export const getUpdatedFilterByCollaborator = (filter, collaborator) => {
  let filterTerm = filter.filter_term ? filter.filter_term.slice(0) : [];
  let selectedEmail = collaborator.email;
  let collaborator_index = filterTerm.indexOf(selectedEmail);
  if (collaborator_index > -1) {
    filterTerm.splice(collaborator_index, 1);
  } else {
    filterTerm.push(selectedEmail);
  }
  return Object.assign({}, filter, { filter_term: filterTerm });
};

export const getUpdatedFilterByRate = (filter, value) => {
  if (filter.filter_term === value) {
    return;
  }
  return Object.assign({}, filter, { filter_term: value });
};

export const getColumnOptions = (column) => {
  const { type, data } = column;
  if (FORMULA_COLUMN_TYPES.includes(type)) {
    return getFormulaColumnFilterOptions(column);
  }
  if (type === CellType.LINK) {
    const { array_type } = data || {};
    return getFilterOptionsByArrayType(array_type);
  }
  return FILTER_COLUMN_OPTIONS[type] || {};
};

const getFormulaColumnFilterOptions = (column) => {
  const { data } = column;
  const { result_type, array_type } = data || {};
  if ([FORMULA_RESULT_TYPE.NUMBER, FORMULA_RESULT_TYPE.DATE].includes(result_type)) {
    return FILTER_COLUMN_OPTIONS[result_type];
  }
  if (result_type === FORMULA_RESULT_TYPE.ARRAY) {
    return getFilterOptionsByArrayType(array_type);
  }
  return FILTER_COLUMN_OPTIONS[CellType.TEXT];
};

const getFilterOptionsByArrayType = (array_type) => {
  if (!array_type) {
    return {};
  }
  let checkType = array_type;
  if (COLLABORATOR_COLUMN_TYPES.includes(array_type)) {
    checkType = CellType.COLLABORATOR;
  } else if (array_type === CellType.SINGLE_SELECT ) {
    checkType = CellType.MULTIPLE_SELECT;
  } else if (DATE_COLUMN_OPTIONS.includes(array_type)) {
    checkType = CellType.DATE;
  } else if (isNumericColumn({ type: array_type })) {
    checkType = CellType.NUMBER;
  }
  return FILTER_COLUMN_OPTIONS[checkType] || FILTER_COLUMN_OPTIONS[CellType.TEXT];
};

export const getFilterByColumn = (column, value, filter = {}) => {
  let { type: columnType, data: columnData } = column;
  let { filterPredicateList } = getColumnOptions(column, value);
  if (!filterPredicateList) return;
  let filterPredicate = filterPredicateList[0];

  let updatedFilter = Object.assign({}, filter, { column_key: column.key, filter_predicate: filterPredicate });
  if (columnType === CellType.CHECKBOX) {
    updatedFilter.filter_term = false;
  } else if (isFilterTermArray(column, filterPredicate)) {
    updatedFilter.filter_term = [];
  } else if (isDateColumn(column)) {
    let filterTermModifier = filterPredicate === FILTER_PREDICATE_TYPE.IS_WITHIN ? filterTermModifierIsWithin[0] : filterTermModifierNotWithin[0];
    updatedFilter.filter_term_modifier = filterTermModifier;
    updatedFilter.filter_term = '';
  } else if (columnType === CellType.RATE) {
    const { rate_max_number } = columnData;
    updatedFilter.filter_term = rate_max_number;
  } else if (FORMULA_COLUMN_TYPES.includes(columnType)) {
    const newUpdatedFilter = getFormulaColumnFilter(column, value, filter);
    if (!newUpdatedFilter) {
      updatedFilter.filter_term = '';
    } else {
      updatedFilter.filter_term = newUpdatedFilter.filter_term;
    }
  } else if (columnType === CellType.LINK) {
    const { array_type, array_data } = columnData || {};
    if (!array_type) {
      updatedFilter.filter_term = '';
    } else {
      const linkedColumn = { type: array_type, data: array_data };
      const newUpdatedFilter = getFilterByColumn(linkedColumn, value, filter) || {};
      updatedFilter.filter_term = newUpdatedFilter.filter_term || '';
    }
  } else {
    updatedFilter.filter_term = '';
  }
  return updatedFilter;
};

export const getFormulaColumnFilter = (column, value, filter) => {
  const { data } = column;
  const { result_type, array_type, array_data } = data || {};
  if (result_type === FORMULA_RESULT_TYPE.ARRAY) {
    if (!array_type) return '';
    const linkedColumn = { type: array_type, data: array_data };
    return getFilterByColumn(linkedColumn, value, filter);
  }
  return '';
};

// file, image : not support
// text, long-text, number, single-select, date, ctime, mtime, formula, link, geolocation : string
// checkbox : boolean
// multiple-select, collaborator, creator, last modifier : array

export const getUpdatedFilterByColumn = (filters, value, filterIndex, column) => {
  const filter = filters[filterIndex];
  if (filter.column_key === column.key) {
    return;
  }
  return getFilterByColumn(column, value, filter);
};

export const getUpdatedFilterByPredicate = (filter, column, filterPredicate) => {
  let updatedFilter = Object.assign({}, filter, { filter_predicate: filterPredicate });
  let { type: columnType } = column;
  if (columnType === CellType.CHECKBOX) {
    updatedFilter.filter_term = false;
  } else if ([CellType.SINGLE_SELECT, CellType.DEPARTMENT_SINGLE_SELECT].includes(columnType)) {
    if (filterPredicate === FILTER_PREDICATE_TYPE.IS_ANY_OF || filterPredicate === FILTER_PREDICATE_TYPE.IS_NONE_OF) {
      updatedFilter.filter_term = [];
    } else {
      updatedFilter.filter_term = '';
    }
  } else if (isFilterTermArray(column, filterPredicate)) {
    updatedFilter.filter_term = [];
  } else if (isDateColumn(column)) {
    let filterTermModifier = filterPredicate === FILTER_PREDICATE_TYPE.IS_WITHIN ? filterTermModifierIsWithin[0] : filterTermModifierNotWithin[0];
    updatedFilter.filter_term_modifier = filterTermModifier;
  }
  return updatedFilter;
};

export const getUpdatedFilterByTermModifier = (filters, filterIndex, filterTermModifier) => {
  const filter = filters[filterIndex];
  if (filter.filter_term_modifier === filterTermModifier) {
    return;
  }
  return Object.assign({}, filter, { filter_term_modifier: filterTermModifier });
};

export const getUpdatedFilterByNormalTerm = (filters, column, filterIndex, event) => {
  const filter = filters[filterIndex];
  let filterTerm;
  if (column.type === CellType.CHECKBOX) {
    filterTerm = event.target.checked;
  } else {
    filterTerm = event.target.value;
  }
  if (filter.filter_term === filterTerm) {
    return;
  }
  return Object.assign({}, filter, { filter_term: filterTerm });
};

export const getUpdatedFilterBySpecialTerm = (filters, filterIndex, type, value) => {
  const filter = filters[filterIndex];
  switch (type) {
    case SPECIAL_TERM_TYPE.CREATOR: {
      return getUpdatedFilterByCreator(filter, value);
    }
    case SPECIAL_TERM_TYPE.SINGLE_SELECT: {
      return getUpdatedFilterBySelectSingle(filter, value);
    }
    case SPECIAL_TERM_TYPE.MULTIPLE_SELECT: {
      return getUpdatedFilterBySelectMultiple(filter, value);
    }
    case SPECIAL_TERM_TYPE.COLLABORATOR: {
      return getUpdatedFilterByCollaborator(filter, value);
    }
    case SPECIAL_TERM_TYPE.RATE: {
      return getUpdatedFilterByRate(filter, value);
    }
    default: {
      return null;
    }
  }
};
