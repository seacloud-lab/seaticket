import { SELECT_OPTION_COLORS } from '../../constants';
import { checkIsPredefinedColumn } from './common';

/**
 * Get options from single-select/multiple-select column.
 * @param {object} column e.g. { type, data: { options: [] } }
 * @returns options, array
 */
const getColumnOptions = (column) => {
  if (!column || !column.data || !Array.isArray(column.data.options)) {
    return [];
  }
  return column.data.options;
};

/**
 * Get option by id
 * @param {array} options e.g. [{ id, name, ... }]
 * @param {string} optionId
 * @returns option, object
 */
const getOption = (options, optionId) => {
  if (!Array.isArray(options) || !optionId) return null;
  return options.find(o => o.id === optionId || o.name === optionId);
};

const checkIsPredefinedOption = (column, optionId) => {
  const isPredefined = checkIsPredefinedColumn(column);
  if (!isPredefined) return false;
  const options = getColumnOptions(column);
  const option = getOption(options, optionId);
  if (!option) return false;
  return isPredefined;
};


/**
 * Get option name of the given id
 * @param {array} options e.g. [ { id, color, name, ... } ]
 * @param {string} targetOptionId option id
 * @returns option name, string
 */
const getOptionName = (options, targetOptionId) => {
  if (!targetOptionId || !Array.isArray(options)) return '';
  const targetOption = getOption(options, targetOptionId);
  return targetOption ? targetOption.name : '';
};

/**
 * Get option name of the given id
 * @param {array} options e.g. [ { id, color, name, ... } ]
 * @param {string} targetOptionId option id
 * @returns option name, string
 */
const getOptionDisplayNameByOption = (option) => {
  if (!option) return '';
  return option.display_name || option.name || '';
};

/**
 * Get option name of the given id
 * @param {array} options e.g. [ { id, color, name, ... } ]
 * @param {string} targetOptionId option id
 * @returns option name, string
 */
const getOptionDisplayName = (options, targetOptionId) => {
  if (!targetOptionId || !Array.isArray(options)) return '';
  const targetOption = getOption(options, targetOptionId);
  return getOptionDisplayNameByOption(targetOption);
};

/**
 * Get column option name by id
 * @param {object} column e.g. { data: { options, ... }, ... }
 * @param {string} optionId
 * @returns option name, string
 */
const getColumnOptionNameById = (column, optionId) => {

  // If it is a predefined option, use its id, otherwise use name.
  // When displaying predefined options, international translation is done based on id, so the name is no longer the name stored in the database
  if (checkIsPredefinedOption(column, optionId)) return optionId;
  const options = getColumnOptions(column);
  return getOptionName(options, optionId);
};

/**
 * Get column option name by id
 * @param {object} column e.g. { data: { options, ... }, ... }
 * @param {array} optionIds
 * @returns options name, array
 */
const getColumnOptionNamesByIds = (column, optionIds) => {
  if (!Array.isArray(optionIds)) return [];
  const isPredefined = checkIsPredefinedColumn(column);
  if (isPredefined) return optionIds;
  if (!Array.isArray(optionIds) || optionIds.length === 0) return [];
  const options = getColumnOptions(column);
  if (!Array.isArray(options) || options.length === 0) return [];
  return optionIds.map(optionId => getOptionName(options, optionId)).filter(name => name);
};

/**
 * Get column option name by id
 * @param {object} column e.g. { data: { options, ... }, ... }
 * @param {array} option names
 * @returns options id, array
 */
const getColumnOptionIdsByNames = (column, names) => {
  const isPredefined = checkIsPredefinedColumn(column);
  if (isPredefined) return names;
  if (!Array.isArray(names) || names.length === 0) return [];
  const options = getColumnOptions(column);
  if (!Array.isArray(options) || options.length === 0) return [];
  return names.map(name => {
    const option = getOption(options, name);
    if (option) return option.id;
    return null;
  }).filter(id => id);
};

/**
 * Get concatenated options names of given ids.
 * @param {array} options e.g. [ { id, color, name, ... }, ... ]
 * @param {array} targetOptionsIds e.g. [ option.id, ... ]
 * @returns concatenated options names, string. e.g. 'name1, name2'
 */
const getMultipleOptionName = (column, targetOptionsIds) => {
  const options = getColumnOptions(column);
  if (!Array.isArray(targetOptionsIds) || !Array.isArray(options)) return '';
  const selectedOptions = options.filter((option) => targetOptionsIds.includes(option.id));
  if (selectedOptions.length === 0) return '';
  return selectedOptions.map((option) => option.name).join(', ');
};

const getServerOptions = (column) => {
  if (!column) return;
  const options = column?.data?.options || [];
  if (options.length === 0) return [];
  return options.map(option => {
    if (checkIsPredefinedOption(column, option.id)) return { id: option.id, name: option.id };
    return option;
  });
};

const getOptionNameById = (column, optionId) => {
  const options = getColumnOptions(column);
  const option = options.find(op => op.id === optionId) || {};
  return option.name;
};

/**
 * generate unique option id
 * @param {array} options e.g. [{ id, ... }, ...]
 * @returns generated option id, string
 */
const generateOptionID = (options) => {
  if (options.length === 1) return String(Math.floor(Math.random() * (10 ** 6)));
  let optionID;
  let isIDUnique = false;
  while (!isIDUnique) {
    optionID = String(Math.floor(Math.random() * (10 ** 6)));

    // eslint-disable-next-line
    isIDUnique = options.every((option) => {
      return option.id !== optionID;
    });
    if (isIDUnique) {
      break;
    }
  }
  return optionID;
};

const getRandomOptionColor = (options) => {
  const defaultOptions = SELECT_OPTION_COLORS.slice(12, 24);
  let colorIdx = Math.floor(Math.random() * defaultOptions.length);
  if (!Array.isArray(options) || options.length === 0) {
    return defaultOptions[colorIdx];
  }

  // Avoid using the same color for adjacent labels
  const adjacentOptions = options.slice(-(defaultOptions.length - 1));
  let adjacentOptionsColorIdxArr = [];
  let selectOptionColorObj = {};
  defaultOptions.forEach((colorItem, index) => {
    selectOptionColorObj[colorItem.COLOR] = index;
  });
  adjacentOptions.forEach((option) => {
    let optionColorIdx = selectOptionColorObj[option.color];
    adjacentOptionsColorIdxArr.push(optionColorIdx);
  });

  // eslint-disable-next-line
  while (adjacentOptionsColorIdxArr.indexOf(colorIdx) != -1) {
    colorIdx = Math.floor(Math.random() * defaultOptions.length);
  }
  return defaultOptions[colorIdx] || defaultOptions[0];
};

/**
 * generate option
 * @param {array} options e.g. [{ id, ... }, ...]
 * @param {string} optionName
 * @param {string} optionColor used to find system support color options. The new color option will be generated if not found by "optionColor" or not supported
 * @returns generated option, object
 */
const createOption = (options, optionName, optionColor = '') => {
  const id = generateOptionID(options);
  let colors = optionColor && SELECT_OPTION_COLORS.find((systemColor) => systemColor.COLOR === optionColor);
  if (!colors) {
    colors = getRandomOptionColor(options);
  }
  return {
    id,
    name: optionName,
    color: colors.COLOR,
    textColor: colors.TEXT_COLOR,
  };
};

/**
 * Generate cell option by name.
 * @param {array} options e.g. [{ id, ... }, ...]
 * @param {string} optionName used as the option name
 * @returns return the option id if exist, otherwise generate a new option, object
 */
const generatorCellOption = (options, optionName) => {
  const existOption = options.find((option) => option.name === optionName);
  if (existOption) {
    return existOption;
  }
  const newOption = createOption(options, optionName) || {};
  return newOption;
};

/**
 * Generate cell options by names.
 * @param {array} options e.g. [{ id, ... }, ...]
 * @param {array} optionNames used as the options names
 * @returns Return the options ids if exist, otherwise generate new options, object
 */
const generatorCellOptions = (options, optionNames) => {
  let cellOptions = [];
  let selectedOptionIds = [];
  optionNames.forEach((optionName) => {
    let existingOption = options.find((option) => option.name === optionName);
    if (existingOption) {
      selectedOptionIds.push(existingOption.id);
    } else {
      let cellOption = createOption(options, optionName);
      if (cellOption) {
        cellOptions.push(cellOption);
        selectedOptionIds.push(cellOption.id);
      }
    }
  });
  if (cellOptions.length === 0) {
    return { selectedOptionIds };
  }
  return { cellOptions, selectedOptionIds };
};

const getNotDuplicateOption = (options) => {
  const defaultOptions = SELECT_OPTION_COLORS.slice(12, 24);
  let defaultOption = defaultOptions[Math.floor(Math.random() * defaultOptions.length)];
  const adjacentOptions = options.slice(-11);
  const _isDuplicate = (option) => option.color === defaultOption.COLOR;
  let duplicateOption = adjacentOptions.find(_isDuplicate);
  while (duplicateOption) {
    defaultOption = defaultOptions[Math.floor(Math.random() * defaultOptions.length)];
    duplicateOption = adjacentOptions.find(_isDuplicate);
  }
  return defaultOption;
};

export const generateNewOption = (options, name) => {
  const defaultOption = getNotDuplicateOption(options);
  const { COLOR: color, TEXT_COLOR: textColor, BORDER_COLOR: borderColor } = defaultOption;
  const newOption = { name, color, text_color: textColor, border_color: borderColor };
  newOption.id = generateOptionID(options);
  return newOption;
};

export {
  getColumnOptions,
  getOptionNameById,
  generateOptionID,
  createOption,
  generatorCellOption,
  generatorCellOptions,
  checkIsPredefinedOption,
  getOption,
  getOptionName,
  getOptionDisplayName,
  getOptionDisplayNameByOption,
  getColumnOptionNameById,
  getColumnOptionNamesByIds,
  getColumnOptionIdsByNames,
  getMultipleOptionName,
  getServerOptions,
};
