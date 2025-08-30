import { gettext } from '@/constants';
import { isRegExpression } from '../../../utils/common';
import { getColumnByKey, getColumnByName } from '../../../utils/column';
import { CellType } from '../../../constants';
import { COMMON_FORM_COLUMN_TYPE, TEXT_FORM_COLUMN, NUMBER_FORM_COLUMN } from './constants';
import context from '../../../context';

const _validateColumnName = ({ columnName, oldColumn, metadata }) => {
  if (!columnName) return { type: COMMON_FORM_COLUMN_TYPE.COLUMN_NAME, tips: gettext('This is required') };
  if (columnName.includes('.')) {
    return {
      type: COMMON_FORM_COLUMN_TYPE.COLUMN_NAME,
      tips: gettext('Name cannot contain dots'),
    };
  }
  if (columnName.includes('`')) {
    return {
      type: COMMON_FORM_COLUMN_TYPE.COLUMN_NAME,
      tips: gettext('Name cannot contain backtick'),
    };
  }
  if (columnName.includes('{') || columnName.includes('}')) {
    return {
      type: COMMON_FORM_COLUMN_TYPE.COLUMN_NAME,
      tips: gettext('Name cannot contain curly braces'),
    };
  }
  if (
    (!oldColumn || (oldColumn && oldColumn.name !== columnName)) &&
    getColumnByName(metadata.columns, columnName)
  ) {
    return {
      type: COMMON_FORM_COLUMN_TYPE.COLUMN_NAME,
      tips: context.translate('There is another {column} with this name'),
    };
  }
  return null;
};

const _validateColumnType = ({ column, metadata }) => {
  if (column.unique && getColumnByKey(metadata.columns, column.key)) {
    return {
      type: COMMON_FORM_COLUMN_TYPE.COLUMN_TYPE,
      tips: context.translate('Another {column} has this {column} type'),
    };
  }
  return null;
};

const _validateTextFormColumn = ({ column }) => {
  const { format_specification_value, format_check_type } = column;
  if (format_check_type === 'custom_format' && format_specification_value) {
    if (!isRegExpression(format_specification_value)) {
      return {
        type: TEXT_FORM_COLUMN.CUSTOM_REGULAR,
        tips: gettext('Invalid regular expression'),
      };
    }
  }
  return null;
};

const _validateNumberFormColumn = ({ column }) => {
  const { format, currency_symbol } = column;
  if (format === 'custom_currency' && !currency_symbol) {
    return {
      type: NUMBER_FORM_COLUMN.CUSTOM_CURRENCY,
      tips: gettext('This is required'),
    };
  }
  return null;
};

export const ValidateColumnFormColumns = {
  [COMMON_FORM_COLUMN_TYPE.COLUMN_NAME]: _validateColumnName,
  [COMMON_FORM_COLUMN_TYPE.COLUMN_TYPE]: _validateColumnType,
  [CellType.TEXT]: _validateTextFormColumn,
  [CellType.NUMBER]: _validateNumberFormColumn,
};

export const getColumnErrorTips = (columnError, columnType) => {
  const tips = columnError && columnError[columnType];
  return tips || null;
};

export const calculateWrapperScrollTopAtErrColumn = (errorColumn, wrapper) => {
  const { top: errColumnTop, height: errorColumnHeight } = errorColumn.getBoundingClientRect();
  const { top: wrapperTop, height: wrapperHeight } = wrapper.getBoundingClientRect();
  const wrapperScrollTop = wrapper.scrollTop;
  const wrapperScrollHeight = wrapper.scrollHeight;

  // with none scroll
  if (Math.round(wrapperHeight) === Math.round(wrapperScrollHeight)) {
    return null;
  }

  if (errColumnTop < wrapperTop) {
    const newScrollTop = wrapperScrollTop - (wrapperTop - errColumnTop) - 8; // 8px: half of column wrapper padding
    return newScrollTop > 0 ? newScrollTop : 0;
  }
  if (errColumnTop > wrapperTop + wrapperHeight) {
    const maxScrollTop = wrapperScrollHeight - wrapperHeight;
    const newScrollTop = wrapperScrollTop + (errColumnTop + errorColumnHeight + 8 - wrapperTop - wrapperHeight);
    return newScrollTop > maxScrollTop ? maxScrollTop : newScrollTop;
  }
  return null; // visible: not changed
};
