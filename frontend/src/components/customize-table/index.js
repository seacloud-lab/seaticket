import React, { useMemo, useRef, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import Header from './header';
import Body from './body';

import './index.css';

const CustomizeTable = ({
  isLoading,
  className = 'p-4',
  emptyTip,
  columns = [],
  rows = [],
  children,
  loadMore,
  ...params
}) => {
  const [containerWidth, setContainerWidth] = useState(0);

  const customizeColumns = useMemo(() => {
    const fixedWidth = columns.reduce((pre, cur) => cur.isFixed ? cur.width + pre : pre, 0);
    return columns.map(c => {
      const width = c.isFixed ? c.width : (containerWidth - fixedWidth) * c.width;
      return { ...c, width: width };
    });
  }, [containerWidth, columns]);

  const ref = useRef(null);

  useEffect(() => {
    const container = ref.current;
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
    <div className={classnames('seaqa-customize-table-wrapper', className)} ref={ref}>
      {children}
      {children && (<div className="seaqa-customize-table-wrapper-divider"></div>)}
      <Body isLoading={isLoading} emptyTip={emptyTip} columns={customizeColumns} rows={rows} loadMore={loadMore} { ...params } />
    </div>
  );
};

CustomizeTable.propTypes = {
  isLoading: PropTypes.bool,
  title: PropTypes.any,
  emptyTip: PropTypes.any,
  btns: PropTypes.array,
  columns: PropTypes.array,
  rows: PropTypes.array,
  loadMore: PropTypes.func,
};

CustomizeTable.Header = Header;

export default CustomizeTable;
