import React from 'react';
import PropTypes from 'prop-types';
import {
  MultipleSelectFormatter,
  NumberFormatter,
  DateFormatter,
  CTimeFormatter,
  MTimeFormatter,
  CheckboxFormatter,
  LongTextFormatter,
  CreatorFormatter,
  LastModifierFormatter
} from 'dtable-ui-component';
import {
  CellType, FORMULA_RESULT_TYPE, getDurationDisplayString,
  getGeolocationDisplayString,
  getMultipleOptionName,
} from 'dtable-utils';
import { getCellDisplayValue } from './value-display-utils';
import { getFormulaArrayValue, isArrayFormalColumn } from './dataset-utils';

function LinkFormatter(props) {
  const { column, value, containerClassName, collaborators } = props;
  const { data } = column;
  if (!Array.isArray(value) || value.length === 0) return props.renderEmptyFormatter();
  let { display_column: displayColumn } = data || {};
  if (!displayColumn) return props.renderEmptyFormatter();

  const { type: displayColumnType, data: displayColumnData } = displayColumn;
  const cellValue = getFormulaArrayValue(value, !isArrayFormalColumn(displayColumnType));
  if (!Array.isArray(cellValue) || cellValue.length === 0) return props.renderEmptyFormatter();

  switch (displayColumnType) {
    case CellType.TEXT:
    case CellType.AUTO_NUMBER:
    case CellType.EMAIL:
    case CellType.URL: {
      return (
        <div className={containerClassName}>
          {cellValue.map((value, index) => {
            if (!value) return null;
            return (
              <div key={`link-${displayColumnType}-${index}`} className="dtable-dataset-link-item">
                {value}
              </div>
            );
          })}
        </div>
      );
    }
    case CellType.NUMBER: {
      return (
        <div className={containerClassName}>
          {cellValue.map((value, index) => {
            if (!value && value !== 0) return null;
            return <NumberFormatter
              key={`link-${displayColumnType}-${index}`}
              containerClassName="dtable-dataset-link-item"
              data={displayColumnData || {}}
              value={value}
            />;
          })}
        </div>
      );
    }
    case CellType.DATE: {
      return (
        <div className={containerClassName}>
          {cellValue.map((value, index) => {
            if (!value || typeof value !== 'string') return null;
            const { format } = displayColumnData || {};
            return (
              <DateFormatter
                key={`link-${displayColumnType}-${index}`}
                value={value}
                format={format}
                containerClassName="dtable-dataset-link-item"
              />
            );
          })}
        </div>
      );
    }
    case CellType.CTIME: {
      return (
        <div className={containerClassName}>
          {cellValue.map((value, index) => {
            if (!value) return null;
            return <CTimeFormatter
              key={`link-${displayColumnType}-${index}`}
              value={value}
              containerClassName="dtable-dataset-link-item"
            />;
          })}
        </div>
      );
    }
    case CellType.MTIME: {
      return (
        <div className={containerClassName}>
          {cellValue.map((value, index) => {
            if (!value) return null;
            return <MTimeFormatter
              key={`link-${displayColumnType}-${index}`}
              value={value}
              containerClassName="dtable-dataset-link-item"
            />;
          })}
        </div>
      );
    }
    case CellType.DURATION: {
      return (
        <div className={containerClassName}>
          {cellValue.map((value, index) => {
            if (!value) return null;
            return (
              <div key={`link-${displayColumnType}-${index}`} className="dtable-dataset-link-item">
                {getDurationDisplayString(value, displayColumnData)}
              </div>
            );
          })}
        </div>
      );
    }
    case CellType.CREATOR: {
      props.queryUsers([cellValue]);
      return <CreatorFormatter collaborators={collaborators} value={cellValue} />;
    }
    case CellType.LAST_MODIFIER: {
      props.queryUsers([cellValue]);
      return <LastModifierFormatter collaborators={collaborators} value={cellValue} />;
    }
    case CellType.SINGLE_SELECT: {
      if (!cellValue || cellValue.length === 0) {
        return props.renderEmptyFormatter();
      }
      const options = displayColumnData && Array.isArray(displayColumnData.options) ? displayColumnData.options : [];
      return <MultipleSelectFormatter value={cellValue} options={options || []} containerClassName={`dtable-dataset-${displayColumnType}-formatter`} />;
    }
    case CellType.MULTIPLE_SELECT: {
      if (!cellValue || cellValue.length === 0) {
        return props.renderEmptyFormatter();
      }
      const options = displayColumnData && Array.isArray(displayColumnData.options) ? displayColumnData.options : [];
      return (
        <div className={containerClassName}>
          {cellValue.map((value, index) => {
            if (!value) return null;
            const valueDisplayString = Array.isArray(value) ? getMultipleOptionName(options, value) : getMultipleOptionName(options, [value]);
            return (
              <div key={`link-${displayColumnType}-${index}`} className="dtable-dataset-link-item">
                {valueDisplayString}
              </div>
            );
          })}
        </div>
      );
    }
    case CellType.COLLABORATOR: {
      if (!cellValue || cellValue.length === 0) {
        return props.renderEmptyFormatter();
      }
      props.queryUsers(cellValue);
      return (
        <div className={containerClassName}>
          {cellValue.map((value, index) => {
            if (!value) return null;
            const valueDisplayString = Array.isArray(value) ?
              getCellDisplayValue({ [displayColumn.key]: value }, displayColumn, collaborators)
              :
              getCellDisplayValue({ [displayColumn.key]: [value] }, displayColumn, collaborators);
            return (
              <div key={`link-${displayColumnType}-${index}`} className="dtable-dataset-link-item">
                {valueDisplayString}
              </div>
            );
          })}
        </div>
      );
    }
    case CellType.CHECKBOX: {
      return (
        <div className={containerClassName}>
          {cellValue.map((value, index) => {
            return <CheckboxFormatter
              key={`link-${displayColumnType}-${index}`}
              value={Boolean(value)}
              containerClassName={`dtable-dataset-${displayColumnType}-item`}
            />;
          })}
        </div>
      );
    }
    case CellType.GEOLOCATION: {
      return (
        <div className={containerClassName}>
          {cellValue.map((value, index) => {
            if (!value) return null;
            return (
              <div key={`link-${displayColumnType}-${index}`} className="dtable-dataset-link-item">
                {getGeolocationDisplayString(value, displayColumnData, { hyphen: ' ' })}
              </div>
            );
          })}
        </div>
      );
    }
    case CellType.LONG_TEXT: {
      return (
        <div className={containerClassName}>
          {cellValue.map((value, index) => {
            if (!value) return null;
            return (
              <LongTextFormatter
                key={`link-${displayColumnType}-${index}`}
                value={value}
                containerClassName={`dtable-dataset-${displayColumnType}-item`}
              />
            );
          })}
        </div>
      );
    }
    case CellType.FORMULA:
    case CellType.LINK_FORMULA: {
      return (
        <div className={containerClassName}>
          {cellValue.map((value, index) => {
            if (!value) return null;
            return (
              <div key={`link-${displayColumnType}-${index}`} className="dtable-dataset-link-item">
                {getCellDisplayValue({ [displayColumn.key]: value }, displayColumn, collaborators)}
              </div>
            );
          })}
        </div>
      );
    }
    case FORMULA_RESULT_TYPE.BOOL: {
      return (
        <div className={containerClassName}>
          {cellValue.map((value, index) => {
            return (
              <div key={`link-${displayColumnType}-${index}`} className="dtable-dataset-link-item">
                {value + ''}
              </div>
            );
          })}
        </div>
      );
    }
    case FORMULA_RESULT_TYPE.STRING: {
      return (
        <div className={containerClassName}>
          {cellValue.map((value, index) => {
            if (!value) return null;
            return (
              <div key={`link-${displayColumnType}-${index}`} className="dtable-dataset-link-item">
                {value}
              </div>
            );
          })}
        </div>
      );
    }
    default: {
      return props.renderEmptyFormatter();
    }
  }
}

LinkFormatter.propTypes = {
  column: PropTypes.object.isRequired,
  value: PropTypes.any,
  collaborators: PropTypes.array,
  containerClassName: PropTypes.string,
  renderEmptyFormatter: PropTypes.func,
  getOptionColors: PropTypes.func,
  queryUsers: PropTypes.func,
};

export default LinkFormatter;
