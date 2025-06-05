import React from 'react';
import PropTypes from 'prop-types';
import { CellType, FORMULA_RESULT_TYPE, getDurationDisplayString, getNumberDisplayString, getDateDisplayString } from 'dtable-utils';
import { MultipleSelectFormatter } from 'dtable-ui-component';
import CollaboratorItemFormatter from './collaborator-item-formatter';
import { getFormulaArrayValue, isArrayFormalColumn, getFormulaDisplayString } from '../../utils/widget-utils';

function LinkFormatter(props) {
  const { column, value, containerClassName, collaborators, tables } = props;
  if (!column) return null;
  if (!Array.isArray(value) || value.length === 0) return null;
  const { type: displayColumnType, data: displayColumnData } = column;
  const cellValue = getFormulaArrayValue(value, !isArrayFormalColumn(displayColumnType));
  if (!Array.isArray(cellValue) || cellValue.length === 0) return null;
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
              <div key={`link-${displayColumnType}-${index}`} className="link-item">
                <div className="link-name">{value}</div>
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
            return (
              <div key={`link-${displayColumnType}-${index}`} className="link-item">
                <div className="link-name">{getNumberDisplayString(value, displayColumnData || {})}</div>
              </div>
            );
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
              <div key={`link-${displayColumnType}-${index}`} className="link-item">
                <div className="link-name">{getDateDisplayString(value, format)}</div>
              </div>
            );
          })}
        </div>
      );
    }
    case CellType.CTIME:
    case CellType.MTIME: {
      return (
        <div className={containerClassName}>
          {cellValue.map((value, index) => {
            if (!value) return null;
            return (
              <div key={`link-${displayColumnType}-${index}`} className="link-item">
                <div className="link-name">{getDateDisplayString(value, 'YYYY-MM-DD HH:mm:ss')}</div>
              </div>
            );
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
              <div key={`link-${displayColumnType}-${index}`} className="link-item">
                <div className="link-name">{getDurationDisplayString(value, displayColumnData)}</div>
              </div>
            );
          })}
        </div>
      );
    }
    case CellType.CREATOR:
    case CellType.LAST_MODIFIER: {
      return (
        <div className="dtable-ui cell-formatter-container collaborator-formatter page-design-collaborator-formatter">
          {cellValue.map((value, index) => {
            if (!value) return null;
            return <CollaboratorItemFormatter
              key={`link-${displayColumnType}-${index}`}
              cellValue={value}
              collaborators={collaborators}
            />;
          })}
        </div>
      );
    }
    case CellType.SINGLE_SELECT: {
      if (!cellValue || cellValue.length === 0) return null;
      const options = displayColumnData && Array.isArray(displayColumnData.options) ? displayColumnData.options : [];
      return <MultipleSelectFormatter value={cellValue} options={options || []} containerClassName={`page-design-${displayColumnType}-formatter`} />;
    }
    case CellType.FORMULA: {
      return (
        <div className={containerClassName}>
          {cellValue.map((value, index) => {
            if (!value) return null;
            return (
              <div key={`link-${displayColumnType}-${index}`} className="sql-query-link-item">
                {getFormulaDisplayString(value, column, { collaborators, tables })}
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
              <div key={`link-${displayColumnType}-${index}`} className="link-item">
                <div className="link-name">{value + ''}</div>
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
              <div key={`link-${displayColumnType}-${index}`} className="link-item">
                <div className="link-name">{value}</div>
              </div>
            );
          })}
        </div>
      );
    }
    default: {
      return null;
    }
  }
}

LinkFormatter.propTypes = {
  column: PropTypes.object.isRequired,
  value: PropTypes.any,
  collaborators: PropTypes.array,
  containerClassName: PropTypes.string,
  tables: PropTypes.array,
};

export default LinkFormatter;
