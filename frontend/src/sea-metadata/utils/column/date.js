import dayjs from 'dayjs';
import { getColumnType } from './core';
import { DATE_COLUMN_OPTIONS, DEFAULT_DATE_FORMAT, DEFAULT_TIMEZONE_FORMAT } from '../../constants';

/**
 * Check whether is date column:
 *  - column type is date, ctime or mtime etc.
 *  - column type is formula and result_type is date
 *  - column type is link/link_fromula and array_type is date, ctime or mtime etc.
 * @param {object} column e.g. { type, data }
 * @returns true/false, bool
 */
const isDateColumn = (column) => DATE_COLUMN_OPTIONS.includes(getColumnType(column));

const getDateColumnFormat = (column) => {
  let format = (column && column.data && column.data.format) ? column.data.format : DEFAULT_DATE_FORMAT;
  // Old Europe format is D/M/YYYY new format is DD/MM/YYYY
  format = format.replace(/D\/M\/YYYY/, 'DD/MM/YYYY');
  return format;
};

/**
 * Get formatted date
 * @param {string} date e.g. "2023-07-06 11:30"
 * @param {string} format e.g. "YYYY-MM-DD"
 * @returns formatted date, string
 */
const getDateDisplayString = (date, format) => {
  if (!date || typeof date !== 'string') {
    return '';
  }

  const dateObj = dayjs(date);
  if (!dateObj.isValid()) return date;
  switch (format) {
    case 'D/M/YYYY':
    case 'DD/MM/YYYY': {
      const formatValue = dateObj.format('YYYY-MM-DD');
      const formatValueList = formatValue.split('-');
      return `${formatValueList[2]}/${formatValueList[1]}/${formatValueList[0]}`;
    }
    case 'D/M/YYYY HH:mm':
    case 'DD/MM/YYYY HH:mm': {
      const formatValues = dateObj.format('YYYY-MM-DD HH:mm');
      const formatValuesList = formatValues.split(' ');
      const formatDateList = formatValuesList[0].split('-');
      return `${formatDateList[2]}/${formatDateList[1]}/${formatDateList[0]} ${formatValuesList[1]}`;
    }
    case 'D/M/YYYY HH:mm:ss':
    case 'DD/MM/YYYY HH:mm:ss': {
      const formatValues = dateObj.format('YYYY-MM-DD HH:mm:ss');
      const formatValuesList = formatValues.split(' ');
      const formatDateList = formatValuesList[0].split('-');
      return `${formatDateList[2]}/${formatDateList[1]}/${formatDateList[0]} ${formatValuesList[1]}`;
    }
    case 'M/D/YYYY':
    case 'M/D/YYYY HH:mm':
    case 'M/D/YYYY HH:mm:ss':
    case 'YYYY-MM-DD':
    case 'YYYY-MM-DD HH:mm':
    case 'YYYY-MM-DD HH:mm:ss':
    case 'YYYY':
    case 'YYYY-MM':
    case 'DD.MM.YYYY':
    case 'DD.MM.YYYY HH:mm':
    case 'DD.MM.YYYY HH:mm:ss': {
      return dateObj.format(format);
    }
    case DEFAULT_TIMEZONE_FORMAT: {
      const formattedDate = dateObj.format(DEFAULT_TIMEZONE_FORMAT);
      const offset = dayjs(date).utcOffset();
      const hours = Math.abs(Math.floor(offset / 60));
      const sign = offset >= 0 ? '+' : '-';
      return `${formattedDate} GMT${sign}${hours}`;
    }
    default:
      // Compatible with older versions: if format is null, use defaultFormat
      return dateObj.format('YYYY-MM-DD');
  }
};


const formatWithTimezone = (date) => {
  return getDateDisplayString(date, DEFAULT_TIMEZONE_FORMAT);
};


export { isDateColumn, getDateColumnFormat, getDateDisplayString, formatWithTimezone };
