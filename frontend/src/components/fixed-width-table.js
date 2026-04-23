import React, { useState, useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { isNumber } from '@/utils/type-detection';

const FixedWidthTable = ({ className, columns: propsColumns, theadOptions = {}, children }) => {

  const [containerWidth, setContainerWidth] = useState(0);

  const columns = useMemo(() => {
    return propsColumns.map(c => {
      if (c.isFixed) return c;
      if (isNumber(c.width)) return c;
      if (c.width?.endsWith('%')) return { ...c, width: parseFloat(c.width) / 100 };
      return c;
    });
  }, [propsColumns]);

  const fixedWidth = useMemo(() => columns.reduce((pre, cur) => cur.isFixed ? cur.width + pre : pre, 0), [columns]);

  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const handleResize = () => {
      if (!container) return;
      setContainerWidth(container.offsetWidth);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    container && resizeObserver.observe(container);

    return () => {
      container && resizeObserver.unobserve(container);
    };
  }, []);

  return (
    <table ref={containerRef} className={className}>
      <thead { ...theadOptions }>
        <tr>
          {columns.map((column, index) => {
            const { width, isFixed, className, onClick = () => {}, title = '', ariaLabel = '' } = column;
            let widthStyle = isFixed ? width : (containerWidth - fixedWidth) * width;
            if (Number.isNaN(widthStyle)) {
              widthStyle = 'fit-content';
            }
            return (
              <th
                key={index}
                style={{ width: widthStyle }}
                className={className}
                onClick={onClick}
                title={title}
                aria-label={ariaLabel}
              >
                {column.children || column.name}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {children}
      </tbody>
    </table>
  );
};

FixedWidthTable.propTypes = {
  className: PropTypes.string,
  columns: PropTypes.array,
  theadOptions: PropTypes.object,
  children: PropTypes.oneOfType([PropTypes.string, PropTypes.node, PropTypes.number]),
};

export default FixedWidthTable;
