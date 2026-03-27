import React, { useCallback, useRef, useState } from 'react';
import classnames from 'classnames';
import { CellType, COLUMNS_ICON_CONFIG } from '@/sea-metadata/constants';
import { IconButton } from '@/components';
// import ResizeColumn from '@/sea-metadata/view/table/table-main/rows-header/cell/resize-column';

import './index.css';


const getWidthFromMouseEvent = (e, target) => {
  let right = e.pageX || (e.touches && e.touches[0] && e.touches[0].pageX) || (e.changedTouches && e.changedTouches[e.changedTouches.length - 1].pageX);
  if (e.pageX === 0) {
    right = 0;
  }
  const left = target.getBoundingClientRect().left;
  // add 5px is ResizeHandle component DOM width, and the draggable column minimum width is 50px
  return Math.max(right - left + 5, 50);
};

const Cell = ({
  column,
  canResize = true,
  modifyColumnWidth,
}) => {
  const [resizing, setResizing] = useState(false);
  const [width, setWidth] = useState(column.width);

  const cellRef = useRef(null);

  // eslint-disable-next-line no-unused-vars
  const onDrag = useCallback((e) => {
    const width = getWidthFromMouseEvent(e, cellRef.current);
    setWidth(width);
  }, []);

  // eslint-disable-next-line no-unused-vars
  const onDragStart = useCallback(() => {
    setResizing(true);
  }, []);

  // eslint-disable-next-line no-unused-vars
  const onDragEnd = useCallback((e) => {
    const width = getWidthFromMouseEvent(e, cellRef.current);
    setResizing(false);
    if (width > 0) {
      modifyColumnWidth(column, Math.max(width, 50));
    }
  }, [column, modifyColumnWidth]);

  const { name, display_name } = column;

  return (
    <div
      className={classnames('sea-metadata-card-column-name text-truncate position-relative', {
        'sea-metadata-card-column--resizing': resizing,
        'sea-metadata-card-draggable': canResize,
      })}>
      <div
        ref={cellRef}
        className="sea-metadata-card-column-name-content position-relative h-100"
        style={{ width }}
        title={display_name || name}
      >
        {column.type === CellType.PRIORITY ? (
          <IconButton
            icon={COLUMNS_ICON_CONFIG[CellType.PRIORITY]}
            iconClassName="sea-metadata-column-icon"
            className="w-100 h-100 no-hover-bg"
          />
        ) : (<>{display_name || name}</>)}
      </div>
      {/* {canResize && (
        <ResizeColumn onDrag={onDrag} onDragStart={onDragStart} onDragEnd={onDragEnd} />
      )} */}
    </div>
  );

};

export default Cell;
