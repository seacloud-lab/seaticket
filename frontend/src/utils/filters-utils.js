import { FILTER_PREDICATE_TYPE, CellType, FORMULA_COLUMN_TYPES, FORMULA_RESULT_TYPE, COLLABORATOR_COLUMN_TYPES } from 'dtable-utils';

const MULTIPLE_SELECTOR_COLUMNS = [CellType.MULTIPLE_SELECT, CellType.COLLABORATOR, CellType.CREATOR, CellType.LAST_MODIFIER];

const isArrayFilterTermByArrayType = (type) => {
  return type === CellType.SINGLE_SELECT || type === CellType.MULTIPLE_SELECT || COLLABORATOR_COLUMN_TYPES.includes(type);
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
