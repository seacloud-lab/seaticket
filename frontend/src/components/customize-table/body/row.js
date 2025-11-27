import React, { cloneElement, isValidElement, useCallback, useState } from 'react';

const Row = ({ row, columns, rowHeight, onUpdate, ...params }) => {
  const [isActive, setActive] = useState(false);

  const onMouseEnter = useCallback(() => {
    setActive(true);
  }, []);

  const onMouseLeave = useCallback(() => {
    setActive(false);
  }, []);

  const handleUpdate = useCallback((update) => {
    onUpdate && onUpdate(row.id, update);
  }, [row, onUpdate]);

  return (
    <div className="sea-custom-table-row" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} style={{ height: rowHeight }}>
      {columns.map(column => {
        const { key, width, is_custom, type, formatter } = column;
        const value = is_custom ? row['config']?.[key] : row[key];
        const valueFormatter = isValidElement(formatter) && cloneElement(formatter, {
          isRowActive: isActive,
          value, column, row,
          ...params,
          onUpdate: handleUpdate,
          cancelActive: onMouseLeave,
        });
        return (
          <div className={`sea-custom-table-cell sea-custom-table-${type}-cell`} key={key} style={{ width }}>
            {valueFormatter}
          </div>
        );
      })}
    </div>
  );
};

export default Row;
