import React, { useCallback, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { Button, Popover } from 'reactstrap';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { useMetadata } from '../../../hooks';
import { CellType, DEFAULT_DATE_FORMAT } from '../../../constants';
import ObjectUtils from '@/utils/object-utils';
import { ValidateColumnFormColumns } from './utils';
import { COMMON_FORM_COLUMN_TYPE } from './constants';
import ColumnType from './column-type';
import ColumnName from './column-name';
import Data from './data';

import './index.css';

const DEFAULT_POPOVER_INNER_WIDTH = 350;
const COLUMN_TYPE_POPOVER_INNER_WIDTH = {};

const ColumnPopover = ({ target, column, onSelect, onCancel, onSubmit }) => {
  const popoverInnerRef = useRef(null);
  const nameRef = useRef(null);
  const typeRef = useRef(null);
  const dataRef = useRef(null);
  const { metadata } = useMetadata();

  const popoverInnerWidth = useMemo(() => {
    return COLUMN_TYPE_POPOVER_INNER_WIDTH[column.type] || DEFAULT_POPOVER_INNER_WIDTH;
  }, [column]);

  const onColumnChange = useCallback((newColumn) => {
    setTimeout(() => {
      typeRef.current.setPopoverState(false);
    }, 100);
    if (ObjectUtils.isSameObject(column, newColumn)) return;
    onSelect(newColumn);
    if (newColumn.type === column.type) return;
    dataRef.current.setValue({});
  }, [typeRef, column, onSelect]);

  const handleSubmit = useCallback(() => {
    nameRef.current.setError('');
    typeRef.current.setError('');
    let flag = 1;
    const columnName = nameRef.current.getName();
    const columnNameError = ValidateColumnFormColumns[COMMON_FORM_COLUMN_TYPE.COLUMN_NAME]({ columnName, metadata, gettext });
    if (columnNameError) {
      nameRef.current.setError(columnNameError.tips);
      flag = 0;
    }

    const columnTypeError = ValidateColumnFormColumns[COMMON_FORM_COLUMN_TYPE.COLUMN_TYPE]({ column, metadata, gettext });
    if (columnTypeError) {
      typeRef.current.setError(columnTypeError.tips);
      flag = 0;
    }

    if (flag === 0) return;
    let data = dataRef.current.getValue();
    if (Object.keys(data).length === 0) {
      data = null;
      if (!column.unique) {
        if (column.type === CellType.SINGLE_SELECT || column.type === CellType.MULTIPLE_SELECT) {
          data = { options: [] };
        } else if (column.type === CellType.DATE) {
          data = { format: DEFAULT_DATE_FORMAT };
        }
      }
    }
    onSubmit(column.unique ? column.key : columnName, column.type, { key: column.unique ? column.key : '', data });
  }, [nameRef, column, metadata, onSubmit]);

  return (
    <Popover
      target={target}
      isOpen={true}
      placement="bottom-end"
      hideArrow={true}
      fade={false}
      className="sea-metadata-column-popover"
    >
      <div className="sea-metadata-column-popover-inner" ref={popoverInnerRef} style={{ width: popoverInnerWidth }}>
        <div>
          <ColumnName ref={nameRef} readOnly={column?.unique} value={column?.unique ? column.name : ''} />
          <ColumnType ref={typeRef} column={column} onChange={onColumnChange} />
          <Data ref={dataRef} column={column} />
        </div>
        <div className={classnames('sea-metadata-column-popover-footer', { 'sea-metadata-number-column-popover-footer': column.type === CellType.NUMBER })}>
          <Button color="secondary" className="mr-4" onClick={onCancel}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={handleSubmit}>{gettext('Submit')}</Button>
        </div>
      </div>
    </Popover>
  );
};

ColumnPopover.propTypes = {
  target: PropTypes.string.isRequired,
  column: PropTypes.object.isRequired,
  onSelect: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

export default ColumnPopover;
