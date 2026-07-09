import classNames from 'classnames';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { getColumnByKey } from '@/sea-metadata/utils/column';
import CellFormatter from '@/sea-metadata/components/cell-formatter';
import { IconButton } from '@/components';

import './index.css';

const RowCard = forwardRef(({
  row,
  isSelected,
  mode,
  highlight,
  columns,
  renderColumns,
  titleColumnKey,
  scrollLeft,
  metadata,
  setItemScrollLeft,
  onClick,
  onStatusClick,
}, ref) => {
  const rowBodyRef = useRef(null);
  const scrollActiveRef = useRef(false);

  const selectedIcon = useMemo(() => {
    if (mode === 'add') return 'check-circle';
    if (mode === 'remove') return 'close-circle-filled';
    return '';
  }, [mode]);

  const onScroll = useCallback((event) => {
    event.stopPropagation();
    if (scrollActiveRef.current) {
      scrollActiveRef.current = false;
      return;
    }
    if (setItemScrollLeft) setItemScrollLeft(rowBodyRef.current.scrollLeft, row._id);
  }, [row, setItemScrollLeft]);

  const handleIconClick = useCallback((event) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    if (mode === 'add') return;
    if (!mode) return;
    onStatusClick && onStatusClick(row);
  }, [mode, row, onStatusClick]);

  useImperativeHandle(ref, () => ({
    setScrollLeft: (scrollLeft) => {
      scrollActiveRef.current = true;
      rowBodyRef.current.scrollLeft = scrollLeft;
    },
    getScrollLeft: () => rowBodyRef.current.scrollLeft,
  }), []);

  useEffect(() => {
    if (scrollLeft !== 0) {
      scrollActiveRef.current = true;
      rowBodyRef.current.scrollLeft = scrollLeft;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const titleColumn = getColumnByKey(columns, titleColumnKey);
  const rowName = getCellValueByColumn(row, titleColumn);

  return (
    <div
      className={classNames('sea-metadata-card-row', { 'sea-metadata-card-row-highlight': highlight })}
      onClick={() => onClick(row)}
    >
      <div className="sea-metadata-card-row-container">
        <div className="sea-metadata-card-row-header">
          <div className="sea-metadata-card-row-name">
            {rowName}
          </div>
          {isSelected && selectedIcon && (
            <IconButton
              className="sea-metadata-card-row-header-status-icon-btn no-hover-bg"
              icon={selectedIcon}
              onClick={handleIconClick}
            />
          )}
        </div>
        <div className="sea-metadata-card-row-body d-flex" onScroll={onScroll} ref={rowBodyRef}>
          {renderColumns.map(column => {
            const value = getCellValueByColumn(row, column);
            return (
              <div className="sea-metadata-card-row-cell-value text-truncate" style={{ width: column.width }} key={column.key}>
                <CellFormatter readonly={true} value={value} column={column} row={row} metadata={metadata} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

const Row = ({
  row,
  initRowDom,
  removeRowDom,
  ...rest
}) => {
  const rowDom = useRef(null);

  useEffect(() => {
    initRowDom(row._id, rowDom.current);
    return () => {
      removeRowDom(row._id);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <RowCard
      ref={rowDom}
      row={row}
      { ...rest }
    />
  );
};

export default Row;
