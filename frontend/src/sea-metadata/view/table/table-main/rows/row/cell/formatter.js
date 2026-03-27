import React from 'react';
import PropTypes from 'prop-types';
import CellFormatter from '../../../../../../components/cell-formatter';
import CheckboxEditor from '../../../../../../components/cell-editors/checkbox-editor';
import PriorityEditor from '../../../../../../components/cell-editors/priority-editor';
import { canEditCell } from '../../../../../../utils/cell';
import { CellType } from '../../../../../../constants';
import { useMetadata } from '@/sea-metadata/hooks';

const Formatter = ({ isCellSelected, column, value, onChange, row, ...params }) => {
  const { metadata } = useMetadata();
  const { type } = column;
  const cellEditAble = canEditCell(column, row, true);
  if (type === CellType.CHECKBOX && cellEditAble) {
    return (<CheckboxEditor isCellSelected={isCellSelected} value={value} column={column} onChange={onChange} />);
  }
  if (type === CellType.PRIORITY && cellEditAble) {
    return (<PriorityEditor { ...params } isCellSelected={isCellSelected} value={value} column={column} onChange={onChange} row={row} />);
  }

  return (<CellFormatter { ...params } readonly={true} value={value} column={column} row={row} metadata={metadata} />);
};

Formatter.propTypes = {
  isCellSelected: PropTypes.bool,
  column: PropTypes.object,
  value: PropTypes.any,
  row: PropTypes.object,
  onChange: PropTypes.func,
};

export default Formatter;
