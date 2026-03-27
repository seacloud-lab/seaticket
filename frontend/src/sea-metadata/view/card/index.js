import React, { cloneElement, isValidElement, useCallback, useEffect, useRef, useState } from 'react';
import { isFunction } from '@/utils/type-detection';
import { EVENT_BUS_TYPE } from '../../constants';
import context from '../../context';
import { useMetadata } from '../../hooks';
import Main from './main';

const Card = ({ expandRow, children }) => {
  const [isShowRowExpand, setIsShowRowExpand] = useState(false);

  const expandRowRef = useRef(null);

  const {
    metadata,
    insertRow,
    modifyRowByRowExpand,
    modifyColumnWidth,
  } = useMetadata();

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

  useEffect(() => {
    const expandRowSubscribe = context.eventBus.subscribe(EVENT_BUS_TYPE.EXPAND_ROW, (row = null) => {
      expandRowRef.current = row;
      setIsShowRowExpand(true);
    });
    return () => {
      expandRowSubscribe();
    };
  }, []);

  const titleColumnKey = context.getSetting('titleColumnKey');
  const isMultipleSelect = context.getSetting('isMultipleSelect', false);
  const mode = context.getSetting('mode', 'add');

  return (
    <>
      <Main
        modifyColumnWidth={modifyColumnWidth}
        rows={metadata.rows}
        columns={metadata.columns}
        metadata={metadata}
        onRowClick={onRowClick}
        titleColumnKey={titleColumnKey}
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
