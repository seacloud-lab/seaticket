import React from 'react';
import PropTypes from 'prop-types';
import CellFormatter from '../../../../../../components/cell-formatter';
import CheckboxEditor from '../../../../../../components/cell-editors/checkbox-editor';
import RateEditor from '../../../../../../components/cell-editors/rate-editor';
import { canEditCell } from '../../../../../../utils/cell';
import { CellType } from '../../../../../../constants';

const Formatter = ({ isCellSelected, column, value, onChange, row, ...params }) => {
  const { type } = column;
  const cellEditAble = canEditCell(column, row, true);
  if (type === CellType.CHECKBOX && cellEditAble) {
    return (<CheckboxEditor isCellSelected={isCellSelected} value={value} column={column} onChange={onChange} />);
  }
  if (type === CellType.RATE && cellEditAble) {
    return (<RateEditor { ...params } isCellSelected={isCellSelected} value={value} column={column} onChange={onChange} row={row} />);
  }

  return (<CellFormatter { ...params } readonly={true} value={value} column={column} row={row} />);
};

Formatter.propTypes = {
  isCellSelected: PropTypes.bool,
  column: PropTypes.object,
  value: PropTypes.any,
  row: PropTypes.object,
  onChange: PropTypes.func,
};

export default Formatter;
