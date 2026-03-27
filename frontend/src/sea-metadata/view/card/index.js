import React, { cloneElement, isValidElement, useCallback, useRef, useState } from 'react';
import { isFunction } from '@/utils/type-detection';
import Main from './main';

const Card = ({
  expandRow,
  isMultipleSelect = false,
  mode = 'add',
  metadata,
  insertRow,
  modifyRowByRowExpand,
  modifyColumnWidth,
  children
}) => {
  const [isShowRowExpand, setIsShowRowExpand] = useState(false);

  const expandRowRef = useRef(null);

  const onRowClick = useCallback((row) => {
    if (isFunction(expandRow)) {
      expandRow(row);
      return;
    }
    expandRowRef.current = row || null;
    setIsShowRowExpand(true);
  }, [expandRow, children]);

  const closeRowExpand = useCallback(() => {
    expandRowRef.current = null;
    setIsShowRowExpand(false);
  }, []);

  return (
    <>
      <Main
        modifyColumnWidth={modifyColumnWidth}
        rows={metadata.rows}
        columns={metadata.columns}
        metadata={metadata}
        onRowClick={onRowClick}
        activeRow={expandRowRef.current}
        isMultipleSelect={isMultipleSelect}
        mode={mode}
      />
      {isShowRowExpand && isValidElement(children) && (
        <>
          {cloneElement(children, {
            row: expandRowRef.current,
            onToggle: closeRowExpand,
            onSubmit: expandRowRef.current ? (...params) => modifyRowByRowExpand(expandRowRef.current._id, ...params) : insertRow
          })}
        </>
      )}
    </>
  );
};

export default Card;
