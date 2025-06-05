import React from 'react';
import PropTypes from 'prop-types';
import { FORMULA_RESULT_TYPE, getCellValueDisplayString, CellType, getTableById, getRowsByIds, getLinkedTableID } from 'dtable-utils';
import {
  NumberFormatter,
  DateFormatter,
  MultipleSelectFormatter,
  CollaboratorFormatter,
  TextFormatter
} from 'dtable-ui-component';
import { getDigitalSignImageUrl } from 'dtable-ui-component/lib/DigitalSignFormatter/utils';
import FileWidget from './file-widget';
import LongTextWidget from './long-text-widget';
import { getFormulaValue } from '../../utils/widget-utils';

function FormulaWidget(props) {
  const { column, collaborators, style, tables } = props;
  const { data } = column;
  if (!data) return props.renderEmptyFormatter();

  const value = getFormulaValue(column, props.value);
  const { array_type, array_data, result_type } = data || {};

  if (result_type === FORMULA_RESULT_TYPE.ARRAY) {
    if (!array_type) return props.renderEmptyFormatter();
    switch (array_type) {
      case CellType.FILE:
      case CellType.IMAGE: {
        if (!Array.isArray(value) || value.length === 0) return props.renderEmptyFormatter();
        return value.map((item, index) => {
          return (
            <FileWidget
              key={`${array_type}-${index}`}
              value={item}
              style={style}
              type={array_type}
            />
          );
        });
      }
      case CellType.DIGITAL_SIGN: {
        if (!Array.isArray(value) || value.length === 0) return props.renderEmptyFormatter();
        const { serviceURL } = window.app.config;
        const { dtable_uuid, workspaceID } = window.app.pageOptions;
        const config = { server: serviceURL, workspaceID: workspaceID, dtableUuid: dtable_uuid };
        return value.map((item, index) => {
          const url = getDigitalSignImageUrl(item, config);
          if (!url) return null;
          return (
            <FileWidget
              key={`${array_type}-${index}`}
              value={url}
              style={style}
              type={array_type}
            />
          );
        });
      }
      case CellType.MULTIPLE_SELECT:
      case CellType.SINGLE_SELECT: {
        if (!Array.isArray(value) || value.length === 0) return props.renderEmptyFormatter();
        return (
          <MultipleSelectFormatter
            value={value}
            options={array_data ? array_data.options : []}
            containerClassName={`page-design-${CellType.MULTIPLE_SELECT}-pdf-formatter`}
          />
        );
      }
      case CellType.COLLABORATOR: {
        if (!Array.isArray(value) || value.length === 0) return props.renderEmptyFormatter();
        let validValue = value.filter(item => item);
        if (validValue.length === 0) return props.renderEmptyFormatter();
        return (
          <CollaboratorFormatter
            value={validValue}
            collaborators={collaborators}
            containerClassName={`page-design-${CellType.COLLABORATOR}-pdf-formatter`}
          />
        );
      }
      case CellType.CREATOR:
      case CellType.LAST_MODIFIER: {
        // need update: can get unknown creators by listUserInfo(dtable-sdk) to show.
        if (!Array.isArray(value) || value.length === 0) return props.renderEmptyFormatter();
        let validValue = value.filter(item => item);
        if (validValue.length === 0) return props.renderEmptyFormatter();
        return (
          <CollaboratorFormatter
            value={validValue}
            collaborators={collaborators}
            containerClassName={`page-design-${CellType.COLLABORATOR}-pdf-formatter`}
          />
        );
      }
      case CellType.LINK: {
        const { currentTableId } = props;
        if (!Array.isArray(value) || value.length === 0) return props.renderEmptyFormatter();
        const { link_id, table_id, other_table_id, display_column_key } = array_data;
        if (!link_id || !table_id || !other_table_id || !display_column_key) return props.renderEmptyFormatter();
        const linkedTableID = getLinkedTableID(currentTableId, table_id, other_table_id);
        const linkedTable = getTableById(tables, linkedTableID);
        if (!linkedTable) return props.renderEmptyFormatter();
        const rows = getRowsByIds(linkedTable, value);
        if (!Array.isArray(rows) || rows.length === 0) return props.renderEmptyFormatter();
        const { columns } = linkedTable;
        const displayColumn = columns.find(column => column.key === display_column_key);
        if (!displayColumn) return props.renderEmptyFormatter();
        const { type, key, data: displayColumnData } = displayColumn;
        return (
          <div className={`dtable-ui cell-formatter-container link-formatter page-design-${CellType.LINK}-pdf-formatter`}>
            {rows
              .map(row => getCellValueDisplayString(row, type, key, { data: displayColumnData }))
              .join(', ')
            }
          </div>
        );
      }
      case CellType.LONG_TEXT: {
        if (!Array.isArray(value) && value.length === 0) return props.renderEmptyFormatter();
        let validValue = '';
        value.forEach(item => {
          const { text } = item || {};
          if (text) {
            const validText = validValue ? `\n${text}` : text;
            validValue += validText;
          }
        });
        return (
          <LongTextWidget
            value={validValue}
            className={`page-design-${CellType.LONG_TEXT}-pdf-formatter`}
          />
        );
      }
      default: {
        const valueString = Array.isArray(value) ?
          value.map((val) => {
            return getCellValueDisplayString(
              { 'FORMULA_ARRAY': val },
              array_type,
              'FORMULA_ARRAY',
              { data: array_data }
            );
          }).join(', ') : '';
        if (!valueString) return props.renderEmptyFormatter();
        return (
          <TextFormatter
            value={valueString}
            containerClassName={`page-design-${CellType.TEXT}-pdf-formatter`}
          />
        );
      }
    }
  }

  if (typeof value === 'object') return props.renderEmptyFormatter();

  if (result_type === FORMULA_RESULT_TYPE.NUMBER) {
    if (!value && value !== 0) return props.renderEmptyFormatter();
    return <NumberFormatter value={value} data={column.data} containerClassName={`page-design-${CellType.NUMBER}-pdf-formatter`} />;
  }

  if (result_type === FORMULA_RESULT_TYPE.DATE) {
    if (!value) return props.renderEmptyFormatter();
    return <DateFormatter value={value} format={column.data.format} containerClassName={`page-design-${CellType.DATE}-pdf-formatter`} />;
  }

  if (result_type === FORMULA_RESULT_TYPE.STRING) {
    if (!value) return props.renderEmptyFormatter();
    return <TextFormatter value={value} containerClassName={`page-design-${CellType.TEXT}-pdf-formatter`} />;
  }

  if (Object.prototype.toString.call(value) === '[object Boolean]') {
    return <TextFormatter value={value + ''} containerClassName={`page-design-${CellType.TEXT}-formatter`} />;
  }

  return props.renderEmptyFormatter();
}

FormulaWidget.propTypes = {
  value: PropTypes.any,
  column: PropTypes.object.isRequired,
  collaborators: PropTypes.array.isRequired,
  currentTableId: PropTypes.string.isRequired,
  style: PropTypes.object,
  tables: PropTypes.array,
  renderEmptyFormatter: PropTypes.func,
};

export default FormulaWidget;
