import React from 'react';
import PropTypes from 'prop-types';
import { CellType, COLLABORATOR_COLUMN_TYPES, FORMULA_RESULT_TYPE } from 'dtable-utils';
import { FormulaFormatter } from 'dtable-ui-component';
import { convertValueToDtableLongTextValue } from './dataset-utils';

function DtableFormulaFormatter(props) {
  const { value, column, collaborators, containerClassName } = props;
  if (!value && value !== 0 && value !== false) {
    return props.renderEmptyFormatter();
  }
  const { result_type, array_type } = column.data || {};
  let cellValue = value;
  if (Array.isArray(cellValue)) {
    if (array_type === CellType.LONG_TEXT) {
      cellValue = cellValue.map(item => convertValueToDtableLongTextValue(item));
    }
  }

  if (result_type === FORMULA_RESULT_TYPE.ARRAY && COLLABORATOR_COLUMN_TYPES.includes(array_type)) {
    // need query user which not loaded
    props.queryUsers(Array.isArray(cellValue) ? cellValue : [cellValue]);
  }

  return (
    <FormulaFormatter
      value={cellValue}
      column={column}
      collaborators={collaborators}
      containerClassName={containerClassName}
    />
  );
}

DtableFormulaFormatter.propTypes = {
  column: PropTypes.object.isRequired,
  value: PropTypes.any,
  collaborators: PropTypes.array,
  containerClassName: PropTypes.string,
  queryUsers: PropTypes.func,
  renderEmptyFormatter: PropTypes.func,
};

export default DtableFormulaFormatter;
