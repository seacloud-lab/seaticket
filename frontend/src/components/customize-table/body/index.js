import React, { cloneElement, isValidElement, useCallback } from 'react';
import PropTypes from 'prop-types';
import EmptyTip from '../../empty-tip';
import Loading from '../../loading';

import './index.css';

const Body = ({ isLoading, emptyTip, columns = [], rows = [], loadMore, onDelete, onModify }) => {

  const onScroll = useCallback((event) => {
    if (isLoading) return;
    if (!loadMore) return;
    const clientHeight = event.target.clientHeight;
    const scrollHeight = event.target.scrollHeight;
    const scrollTop = event.target.scrollTop;
    const isBottom = (clientHeight + scrollTop + 1 >= scrollHeight);
    if (!isBottom) return;
    loadMore();
  }, [isLoading, loadMore]);

  if (!Array.isArray(rows) || rows.length === 0) {
    if (typeof(emptyTip) === 'string') return (<EmptyTip text={emptyTip} />);
    return (emptyTip);
  }

  return (
    <div className="sea-custom-table" onScroll={onScroll}>
      <div className="sea-custom-table-row sea-custom-table-row-title">
        {columns.map(column => {
          const { key, name, width } = column;
          return (<div className="sea-custom-table-cell" key={key} style={{ width }}>{name}</div>);
        })}
      </div>
      {rows.map(row => {
        return (
          <div className="sea-custom-table-row" key={row.id}>
            {columns.map(column => {
              const { key, width, is_custom, type, formatter } = column;
              const value = is_custom ? row['config']?.[key] : row[key];
              const valueFormatter = isValidElement(formatter) && cloneElement(formatter, { value, column, row, onModify, onDelete });
              return (
                <div className={`sea-custom-table-cell sea-custom-table-${type}-cell`} key={key} style={{ width }} title={value}>
                  {valueFormatter}
                </div>
              );
            })}
          </div>
        );
      })}
      {isLoading && (
        <div className="sea-custom-table-row sea-custom-table-row-loading">
          <Loading />
        </div>
      )}
    </div>
  );
};

Body.propTypes = {
  emptyTip: PropTypes.any,
  columns: PropTypes.array,
  rows: PropTypes.array,
};

export default Body;
