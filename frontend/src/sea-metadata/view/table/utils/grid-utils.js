import dayjs from 'dayjs';
import { getPreviewContent } from '@seafile/seafile-editor';
import { getCellValueByColumn, isCellValueChanged, isValidCellValue } from '../../../utils/cell';
import { getColumnByIndex, getColumnOriginName } from '../../../utils/column';
import { CellType, NOT_SUPPORT_DRAG_COPY_COLUMN_TYPES, TRANSFER_TYPES,
  REG_NUMBER_DIGIT, REG_STRING_NUMBER_PARTS, RATE_MAX_NUMBER, PASTE_SOURCE,
} from '../../../constants';
import { getGroupRowByIndex } from './group-metrics';
import { convertCellValue } from '../../../utils/convert-utils';
import context from '../../../context';
import { getRowIdFromRow } from '../../../utils/row';

const NORMAL_RULE = ({ value }) => {
  return value;
};

const isCopyPaste = true;

class GridUtils {

  constructor(metadata, api) {
    this.metadata = metadata;
    this.api = api;
  }

  getCopiedContent({ type, copied, isGroupView, columns }) {
    const validColumns = columns.map(c => ({ ...c, editor: '', formatter: '' }));
    // copy from internal grid
    if (type === TRANSFER_TYPES.METADATA_FRAGMENT) {
      const { selectedRowIds, copiedRange } = copied;

      // copy from selected rows
      if (Array.isArray(selectedRowIds) && selectedRowIds.length > 0) {
        return {
          copiedRows: selectedRowIds.map(rowId => this.api.rowGetterById(rowId)),
          copiedColumns: validColumns,
        };
      }

      // copy from selected range
      let copiedRows = [];
      let copiedColumns = [];
      const { topLeft, bottomRight } = copiedRange;
      const { rowIdx: minRowIndex, idx: minColumnIndex, groupRowIndex: minGroupRowIndex } = topLeft;
      const { rowIdx: maxRowIndex, idx: maxColumnIndex } = bottomRight;
      let currentGroupIndex = minGroupRowIndex;
      for (let i = minRowIndex; i <= maxRowIndex; i++) {
        copiedRows.push(this.api.rowGetterByIndex({ isGroupView, groupRowIndex: currentGroupIndex, rowIndex: i }));
        if (isGroupView) {
          currentGroupIndex++;
        }
      }
      for (let i = minColumnIndex; i <= maxColumnIndex; i++) {
        copiedColumns.push(getColumnByIndex(i, validColumns));
      }
      return { copiedRows, copiedColumns };
    }

    const { copiedRows, copiedColumns } = copied;
    return { copiedRows, copiedColumns };
  }

  clearCutData(cutPosition, cutData, isGroupView) {
    let { rowIdx: startRowIndex, groupRowIndex } = cutPosition;
    const { copiedColumns, copiedRows } = cutData;
    let updateRowIds = [];
    let idRowUpdates = {};
    let idOldRowData = {};

    copiedRows.forEach((row, index) => {
      const cutRowIdx = startRowIndex + index;
      const cutRow = this.api.rowGetterByIndex({ isGroupView, groupRowIndex: groupRowIndex, rowIndex: cutRowIdx });
      groupRowIndex++;
      const cutRowId = getRowIdFromRow(cutRow);
      const canModify = context.canModifyRow(cutRow);
      if (canModify) {
        updateRowIds.push(cutRowId);
        copiedColumns.forEach((copiedColumn, index) => {
          if (copiedColumn.editable && !copiedColumn.is_required) {
            const cellValue = getCellValueByColumn(cutRow, copiedColumn);
            const copiedColumnName = getColumnOriginName(copiedColumn);
            idRowUpdates[cutRowId] = Object.assign({}, idRowUpdates[cutRowId], { [copiedColumnName]: null });
            idOldRowData[cutRowId] = Object.assign({}, idOldRowData[cutRowId], { [copiedColumnName]: cellValue });
          }
        });
      }
    });

    if (Object.keys(idRowUpdates).length > 0) {
      this.api.modifyRows(updateRowIds, idRowUpdates, idRowUpdates, idOldRowData, idOldRowData, true);
    }
  }

  async paste({ type, copied, multiplePaste, pasteRange, isGroupView, columns, viewId, pasteSource, cutPosition, tagsData, collaborators }) {
    const { row_ids: renderRowIds } = this.metadata;
    const { topLeft, bottomRight = {} } = pasteRange;
    const { rowIdx: startRowIndex, idx: startColumnIndex, groupRowIndex } = topLeft;
    const { rowIdx: endRowIndex, idx: endColumnIndex } = bottomRight;
    const { copiedRows, copiedColumns } = copied;
    const copiedRowsLen = copiedRows.length;
    const copiedColumnsLen = copiedColumns.length;
    const pasteRowsLen = multiplePaste ? endRowIndex - startRowIndex + 1 : copiedRowsLen;
    const pasteColumnsLen = multiplePaste ? endColumnIndex - startColumnIndex + 1 : copiedColumnsLen;
    const renderRowsCount = renderRowIds.length;

    const isFromCut = pasteSource === PASTE_SOURCE.CUT && type === TRANSFER_TYPES.METADATA_FRAGMENT;
    if (isFromCut) {
      const { search } = window.location;
      const urlParams = new URLSearchParams(search);
      const currentViewId = urlParams.has('view') && urlParams.get('view');
      if (currentViewId === viewId) {
        // this.clearCutData(cutPosition, copied, isGroupView);
      }
    }

    // need expand rows
    const startExpandRowIndex = renderRowsCount - startRowIndex;

    if ((copiedRowsLen > startExpandRowIndex)) return;

    let updateRowIds = [];
    let idRowUpdates = {};
    let idOriginalRowUpdates = {};
    let idOldRowData = {};
    let idOriginalOldRowData = {};
    let currentGroupRowIndex = groupRowIndex;

    for (let i = 0; i < pasteRowsLen; i++) {
      const pasteRow = this.api.rowGetterByIndex({ isGroupView, groupRowIndex: currentGroupRowIndex, rowIndex: startRowIndex + i });
      if (isGroupView) {
        currentGroupRowIndex++;
      }
      if (!pasteRow) {
        continue;
      }
      const updateRowId = pasteRow._id;
      const copiedRowIndex = i % copiedRowsLen;
      const copiedRow = copiedRows[copiedRowIndex];
      let originalUpdate = {};
      let originalKeyUpdate = {};
      let originalOldRowData = {};
      let originalKeyOldRowData = {};

      for (let j = 0; j < pasteColumnsLen; j++) {
        const pasteColumn = getColumnByIndex(j + startColumnIndex, columns);
        if (!pasteColumn || !context.canModifyRow(pasteRow)) {
          continue;
        }
        const copiedColumnIndex = j % copiedColumnsLen;
        const copiedColumn = getColumnByIndex(copiedColumnIndex, copiedColumns);
        const pasteColumnName = getColumnOriginName(pasteColumn);
        const copiedColumnName = getColumnOriginName(copiedColumn);
        const pasteCellValue = Object.prototype.hasOwnProperty.call(pasteRow, pasteColumnName) ? getCellValueByColumn(pasteRow, pasteColumn) : null;
        const copiedCellValue = Object.prototype.hasOwnProperty.call(copiedRow, copiedColumnName) ? getCellValueByColumn(copiedRow, copiedColumn) : null;
        let update = convertCellValue(copiedCellValue, pasteCellValue, pasteColumn, copiedColumn, { api: this.api, collaborators, tagsData });
        if (!isCellValueChanged(pasteCellValue, update, pasteColumn.type)) continue;
        if (!isValidCellValue(update, pasteColumn) && pasteColumn.is_required) continue;
        if (pasteColumn.type === CellType.LONG_TEXT && typeof update === 'string') {
          const { previewText, images, links, checklist } = getPreviewContent(update);
          update = { text: update, preview: previewText, images: images, links: links, checklist };
        }
        originalUpdate[pasteColumnName] = update;
        originalKeyUpdate[pasteColumn.key] = update;
        originalOldRowData[pasteColumnName] = pasteCellValue;
        originalKeyOldRowData[pasteColumn.key] = pasteCellValue;
      }

      if (Object.keys(originalUpdate).length > 0) {
        updateRowIds.push(updateRowId);
        idRowUpdates[updateRowId] = originalUpdate;
        idOriginalRowUpdates[updateRowId] = originalKeyUpdate;
        idOldRowData[updateRowId] = originalOldRowData;
        idOriginalOldRowData[updateRowId] = originalKeyOldRowData;
      }
    }

    if (updateRowIds.length === 0) return;
    this.api.modifyRows(updateRowIds, idRowUpdates, idOriginalRowUpdates, idOldRowData, idOriginalOldRowData, isCopyPaste);
  }

  getUpdateDraggedRows(draggedRange, shownColumns, rows, idRowMap, groupMetrics) {
    let rowIds = [];
    let updatedOriginalRows = {};
    let oldOriginalRows = {};
    const updatedRows = {};
    const oldRows = {};
    const { overRowIdx, topLeft, bottomRight } = draggedRange;
    const { idx: startColumnIdx } = topLeft;
    const { idx: endColumnIdx, rowIdx: endRowIdx, groupRowIndex } = bottomRight;

    const draggedRangeMatrix = this.getDraggedRangeMatrix(shownColumns, draggedRange, rows, groupMetrics, idRowMap);
    const rules = this.getDraggedRangeRules(draggedRangeMatrix, shownColumns, startColumnIdx);

    const selectedRowLength = draggedRangeMatrix[0].length;
    let fillingIndex = draggedRangeMatrix[0].length;

    // if group view then use index of groupRows which is different from the normal rows(they represent DOMs)
    let currentGroupRowIndex = groupRowIndex + 1;
    for (let i = endRowIdx + 1; i <= overRowIdx; i++) {
      let dragRow;
      // find the row that need to be updated (it's dragged)
      if (currentGroupRowIndex) {
        const groupRow = getGroupRowByIndex(currentGroupRowIndex, groupMetrics);
        dragRow = idRowMap[groupRow.rowId];
      } else {
        dragRow = rows[i];
      }
      const { _id: dragRowId } = dragRow;
      fillingIndex++;
      if (!context.canModifyRow(dragRow)) continue;
      rowIds.push(dragRowId);

      const idx = (i - endRowIdx - 1) % selectedRowLength;
      for (let j = startColumnIdx; j <= endColumnIdx; j++) {
        let column = shownColumns[j];
        let { key: cellKey, type } = column;
        const columnName = getColumnOriginName(column);
        if (context.canModifyColumn(column) && !NOT_SUPPORT_DRAG_COPY_COLUMN_TYPES.includes(type)) {
          const value = draggedRangeMatrix[j - startColumnIdx][idx];
          const rule = rules[cellKey];
          const fillingValue = rule({ n: fillingIndex - 1, value });
          const oldValue = getCellValueByColumn(dragRow, column);
          if (isCellValueChanged(fillingValue, oldValue, type)) {
            updatedOriginalRows[dragRowId] = Object.assign({}, updatedOriginalRows[dragRowId], { [columnName]: fillingValue });
            oldOriginalRows[dragRowId] = Object.assign({}, oldOriginalRows[dragRowId], { [columnName]: oldValue });
            const update = updatedOriginalRows[dragRowId];
            const oldUpdate = oldOriginalRows[dragRowId];

            updatedRows[dragRowId] = Object.assign({}, updatedRows[dragRowId], update);
            oldRows[dragRowId] = Object.assign({}, oldRows[dragRowId], oldUpdate);
          }
        }
      }
      currentGroupRowIndex++;
    }

    return {
      rowIds: rowIds,
      idOriginalRowUpdates: updatedOriginalRows,
      idRowUpdates: updatedRows,
      idOriginalOldRowData: oldOriginalRows,
      idOldRowData: oldRows
    };
  }

  getDraggedRangeMatrix(columns, draggedRange, rows, groupMetrics, idRowMap) {
    let draggedRangeMatrix = [];
    const { topLeft, bottomRight } = draggedRange;
    const { idx: startColumnIdx, rowIdx: startRowIdx, groupRowIndex } = topLeft;
    const { idx: endColumnIdx, rowIdx: endRowIdx } = bottomRight;
    for (let i = startColumnIdx; i <= endColumnIdx; i++) {
      let currentGroupRowIndex = groupRowIndex;
      draggedRangeMatrix[i - startColumnIdx] = [];
      const column = columns[i];
      for (let j = startRowIdx; j <= endRowIdx; j++) {
        let selectedRow;
        if (currentGroupRowIndex) {
          const groupRow = getGroupRowByIndex(currentGroupRowIndex, groupMetrics);
          selectedRow = idRowMap[groupRow.rowId];
        } else {
          selectedRow = rows[j];
        }
        draggedRangeMatrix[i - startColumnIdx][j - startRowIdx] = getCellValueByColumn(selectedRow, column);
        currentGroupRowIndex++;
      }
    }
    return draggedRangeMatrix;
  }

  getDraggedRangeRules(draggedRangeMatrix, columns, startColumnIdx) {
    let draggedRangeRuleMatrix = {};
    draggedRangeMatrix.forEach((valueList, i) => {
      let column = columns[i + startColumnIdx];
      let { type, data, key } = column;
      let ruleMatrixItem = NORMAL_RULE;
      if (valueList.length > 1) {
        switch (type) {
          case CellType.DATE: {
            let format = data && data.format && data.format.indexOf('HH:mm') > -1 ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD';
            let value0 = valueList[0];
            let yearTolerance = this._getYearTolerance(valueList);
            if (yearTolerance) {
              ruleMatrixItem = ({ n }) => {
                return dayjs(value0).add(n * yearTolerance, 'years').format(format);
              };
              break;
            }
            let monthTolerance = this._getMonthTolerance(valueList);
            if (monthTolerance) {
              ruleMatrixItem = ({ n }) => {
                return dayjs(value0).add(n * monthTolerance, 'months').format(format);
              };
              break;
            }
            let dayTolerance = this._getDayTolerance(valueList);
            if (dayTolerance) {
              ruleMatrixItem = ({ n }) => {
                let time = n * dayTolerance + this.getDateStringValue(value0);
                return dayjs(time).format(format);
              };
              break;
            }
            break;
          }
          case CellType.NUMBER: {
            ruleMatrixItem = this._getLeastSquares(valueList);
            break;
          }
          case CellType.TEXT: {
            ruleMatrixItem = this._getTextRule(valueList);
            break;
          }
          case CellType.RATE: {
            ruleMatrixItem = this._getRatingLeastSquares(valueList, data);
            break;
          }
          case CellType.TAGS: {
            ruleMatrixItem = ({ value }) => {
              if (!value) return [];
              if (!Array.isArray(value) || value.length === 0) return [];
              return value;
            };
            break;
          }
          default: {
            ruleMatrixItem = NORMAL_RULE;
            break;
          }
        }
      }
      draggedRangeRuleMatrix[key] = ruleMatrixItem;
    });
    return draggedRangeRuleMatrix;
  }

  getDateStringValue(date) {
    let dateObject = dayjs(date);
    return dateObject.isValid() ? dateObject.valueOf() : 0;
  }

  _getYearTolerance(dateList) {
    let date0 = dayjs(dateList[0]);
    let date1 = dayjs(dateList[1]);
    if (!date0.isValid() || !date1.isValid()) {
      return 0;
    }
    if (date0.month() !== date1.month() || date0.date() !== date1.date()
      || date0.hour() !== date1.hour() || date0.minute() !== date1.minute()) {
      return 0;
    }
    let date0Year = date0.year();
    let tolerance = date1.year() - date0Year;
    let isYearArithmeticSequence = dateList.every((date, n) => {
      let dateObject = dayjs(date);
      if (!dateObject.isValid()) {
        return false;
      }
      return dateObject.year() === n * tolerance + date0Year;
    });
    return isYearArithmeticSequence ? tolerance : 0;
  }

  _getMonthTolerance(dateList) {
    let date0 = dayjs(dateList[0]);
    let date1 = dayjs(dateList[1]);
    if (!date0.isValid() || !date1.isValid()) {
      return 0;
    }
    if (date0.date() !== date1.date() || date0.hour() !== date1.hour() || date0.minute() !== date1.minute()) {
      return 0;
    }
    let tolerance = (date1.month() - date0.month()) + (date1.year() - date0.year()) * 12;
    let isMonthArithmeticSequence = dateList.every((date, i) => {
      let month = i * tolerance;
      let dateObject = dayjs(date);
      if (!dateObject.isValid()) {
        return false;
      }
      return dateObject.isSame(dayjs(dateList[0]).add(month, 'month'), 'minute');
    });
    return isMonthArithmeticSequence ? tolerance : 0;
  }

  _getDayTolerance(dateList) {
    let date0 = this.getDateStringValue(dateList[0]);
    let tolerance = this.getDateStringValue(dateList[1]) - date0;
    let isDayArithmeticSequence = dateList.every((date, i) => {
      if (!dayjs(date).isValid()) {
        return false;
      }
      return this.getDateStringValue(date) === i * tolerance + date0;
    });
    return isDayArithmeticSequence ? tolerance : 0;
  }

  _getLeastSquares(numberList) {
    let slope;
    let intercept;
    let xAverage;
    let yAverage;
    let xSum = 0;
    let ySum = 0;
    let xSquareSum = 0;
    let xySum = 0;
    let validCellsLen = 0;
    let emptyCellPositions = [];
    numberList.forEach((v, i) => {
      if (v !== undefined && v !== null && v !== '') {
        validCellsLen++;
        xSum += i;
        ySum += v;
        xySum += (v * i);
        xSquareSum += Math.pow(i, 2);
      } else {
        emptyCellPositions.push(i);
      }
    });
    if (validCellsLen < 2) {
      return NORMAL_RULE;
    }
    xAverage = xSum / validCellsLen;
    yAverage = ySum / validCellsLen;
    slope = (xySum - validCellsLen * xAverage * yAverage) / (xSquareSum - validCellsLen * Math.pow(xAverage, 2));
    intercept = yAverage - slope * xAverage;
    return ({ n }) => {
      if (emptyCellPositions.length && emptyCellPositions.includes(n % numberList.length)) {
        return '';
      }
      let y = n * slope + intercept;
      return Number(parseFloat(y).toFixed(8));
    };
  }

  _isArithmeticSequence(numberList) {
    let number0 = numberList[0];
    let tolerance = numberList[1] - number0;
    let func = (v, n) => {
      return v === n * (tolerance) + number0;
    };
    return numberList.every(func);
  }

  _getTextItemStructureInfo(textItem) {
    let validTextItem = textItem || '';
    let lastNumberPosition = -1;
    let lastNumber = validTextItem;
    let valueList = validTextItem.match(REG_STRING_NUMBER_PARTS) || [];
    for (let i = valueList.length - 1; i > -1; i--) {
      let valueItem = valueList[i];
      if (REG_NUMBER_DIGIT.test(valueItem)) {
        lastNumberPosition = i;
        lastNumber = valueItem;
        break;
      }
    }
    if (lastNumberPosition !== -1) {
      valueList[lastNumberPosition] = '-|*|-sea-metadata-|*|-';
    }

    return { lastNumberPosition, lastNumber, structure: valueList.join('') };
  }

  _getTextFillNumberRule(valueList, lastNumber, lastNumberPosition, fillFunc) {
    let isStartWith0 = lastNumber.startsWith('0');
    return ({ n }) => {
      let fillValue = fillFunc ? fillFunc({ lastNumber, n }) : '';
      if (isStartWith0 && fillValue.length < lastNumber.length) {
        fillValue = '0'.repeat(lastNumber.length - fillValue.length) + fillValue;
      }
      valueList[lastNumberPosition] = fillValue;
      return valueList.join('');
    };
  }

  _getTextRule(textList) {
    let isAllNotIncludeNumber = textList.every(item => !REG_NUMBER_DIGIT.test(item || ''));
    if (isAllNotIncludeNumber) {
      return NORMAL_RULE;
    }
    if (textList.length === 1) {
      let valueList = textList[0].match(REG_STRING_NUMBER_PARTS);
      let { lastNumberPosition, lastNumber } = this._getTextItemStructureInfo(textList[0]);
      return this._getTextFillNumberRule(valueList, lastNumber, lastNumberPosition, ({ lastNumber, n }) => {
        let lastNumberValue = parseInt(lastNumber, 10);
        return (lastNumberValue + n) + '';
      });
    }
    // isStructureConsistent: the last number part is not equal, other is equal
    let structureList = textList.map((text) => this._getTextItemStructureInfo(text));
    let firstStructure = structureList[0];
    let isStructureConsistent = structureList.every(structure => structure['lastNumberPosition'] === firstStructure['lastNumberPosition'] && structure['structure'] === firstStructure['structure']);
    if (isStructureConsistent) {
      let numberList = structureList.map(structure => parseInt(structure.lastNumber, 10));
      if (this._isArithmeticSequence(numberList)) {
        let valueList = textList[0].match(REG_STRING_NUMBER_PARTS);
        let secondStructure = structureList[1];
        let secondStructureLastNumberValue = parseInt(secondStructure['lastNumber'], 10);
        return this._getTextFillNumberRule(valueList, firstStructure['lastNumber'], firstStructure['lastNumberPosition'], ({ lastNumber, n }) => {
          let lastNumberValue = parseInt(lastNumber, 10);
          return (n * (secondStructureLastNumberValue - lastNumberValue) + lastNumberValue) + '';
        });
      }
      return NORMAL_RULE;
    }
    return ({ value, n }) => {
      if (REG_NUMBER_DIGIT.test(value || '')) {
        let valueList = value.match(REG_STRING_NUMBER_PARTS);
        let { lastNumberPosition, lastNumber } = this._getTextItemStructureInfo(value);
        let isStartWith0 = lastNumber.startsWith('0');
        let lastNumberValue = parseInt(lastNumber, 10);
        let fillValue = (lastNumberValue + Math.floor(n / textList.length)) + '';
        if (isStartWith0 && fillValue.length < lastNumber.length) {
          fillValue = '0'.repeat(lastNumber.length - fillValue.length) + fillValue;
        }
        valueList[lastNumberPosition] = fillValue;
        return valueList.join('');
      }
      return value;
    };
  }

  _getRatingLeastSquares(numberList, data) {
    const { rate_max_number = RATE_MAX_NUMBER[4].name } = data || {};
    let slope;
    let intercept;
    let xAverage;
    let yAverage;
    let xSum = 0;
    let ySum = 0;
    let xSquareSum = 0;
    let xySum = 0;
    let validCellsLen = 0;
    let emptyCellPositions = [];
    numberList.forEach((v, i) => {
      if (v !== undefined && v !== null && v !== '') {
        validCellsLen++;
        xSum += i;
        ySum += v;
        xySum += (v * i);
        xSquareSum += Math.pow(i, 2);
      } else {
        emptyCellPositions.push(i);
      }
    });
    if (validCellsLen < 2) {
      return NORMAL_RULE;
    }
    xAverage = xSum / validCellsLen;
    yAverage = ySum / validCellsLen;
    slope = (xySum - validCellsLen * xAverage * yAverage) / (xSquareSum - validCellsLen * Math.pow(xAverage, 2));
    intercept = yAverage - slope * xAverage;
    return ({ n }) => {
      if (emptyCellPositions.length && emptyCellPositions.includes(n % numberList.length)) {
        return '';
      }
      let y = n * slope + intercept;
      const value = Number(parseFloat(y).toFixed(0));
      if (value > rate_max_number) return rate_max_number;
      if (value < 0) return 0;
      return value;
    };
  }

}

export default GridUtils;
