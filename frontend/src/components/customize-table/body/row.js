import React, { cloneElement, isValidElement, useCallback, useState } from 'react';

const Row = ({ row, columns, onModify, onDelete, onMore, expandRow, onManualSync }) => {
  const [isActive, setActive] = useState(false);

  const onMouseEnter = useCallback(() => {
    setActive(true);
  }, []);

  const onMouseLeave = useCallback(() => {
    setActive(false);
  }, []);

  return (
    <div className="sea-custom-table-row" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} >
      {columns.map(column => {
        const { key, width, is_custom, type, formatter } = column;
        const value = is_custom ? row['config']?.[key] : row[key];
        const valueFormatter = isValidElement(formatter) && cloneElement(formatter, {
          isRowActive: isActive,
          value, column, row,
          onModify, onDelete, onMore, expandRow, onManualSync,
          cancelActive: onMouseLeave,
        });
        return (
          <div className={`sea-custom-table-cell sea-custom-table-${type}-cell`} key={key} style={{ width }} title={value}>
            {valueFormatter}
          </div>
        );
      })}
    </div>
  );
};

export default Row;
