import { filterRow, deleteInvalidFilter, getValidFilters } from '../filter';
import { ValidateFilter } from '../validate';
import { ROW_COLOR_TYPE } from '../../constants';

const getValidRowColorRules = (colorbys, columns, tagsData) => {
  const colorRules = colorbys?.color_by_rules;
  if (!Array.isArray(colorRules)) return [];

  return colorRules.filter((rule) => {
    if (!rule || !rule.color || !Array.isArray(rule.filters) || rule.filters.length === 0) {
      return false;
    }

    const validFilters = getValidFilters(rule.filters, columns);
    if (validFilters.length === 0) return false;

    return validFilters.every((filter) => {
      const { error_message } = ValidateFilter.validate(filter, columns, { tagsData });
      return !error_message;
    });
  }).map((rule) => {
    const validFilters = deleteInvalidFilter(rule.filters, columns);
    return {
      ...rule,
      filters: validFilters,
      filter_conjunction: rule.filter_conjunction || 'And',
    };
  });
};

export const getRowColors = (rows, view, columns, { username, userId, tagsData } = {}) => {
  const colorbys = view?.colorbys;
  if (!colorbys || colorbys.type !== ROW_COLOR_TYPE.BY_RULES) return {};

  const rules = getValidRowColorRules(colorbys, columns, tagsData);
  if (rules.length === 0) return {};

  return rows.reduce((colors, row) => {
    const matchedRule = rules.find((rule) => {
      return filterRow(row, rule.filter_conjunction, rule.filters, { username, userId, tagsData });
    });
    if (matchedRule) {
      colors[row._id] = matchedRule.color;
    }
    return colors;
  }, {});
};

export const hasRowColor = (colorbys) => {
  return colorbys?.type === ROW_COLOR_TYPE.BY_RULES && Array.isArray(colorbys?.color_by_rules) && colorbys.color_by_rules.length > 0;
};

export const getDefaultRowColorRule = (columns, defaultFilter, defaultColor) => {
  if (!defaultFilter) return null;
  return {
    color: defaultColor,
    filters: [defaultFilter],
    filter_conjunction: 'Or',
  };
};
