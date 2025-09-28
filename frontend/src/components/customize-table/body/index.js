import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import EmptyTip from '../../empty-tip';
import Loading from '../../loading';
import Row from './row';

import './index.css';

const Body = ({ isLoading, emptyTip, columns = [], rows = [], loadMore, ...params }) => {

  const onScroll = useCallback((event) => {
    if (isLoading) return;
    if (!loadMore) return;
    const clientHeight = event.target.clientHeight;
    const scrollHeight = event.target.scrollHeight;
    const scrollTop = event.target.scrollTop;
    const isBottom = (clientHeight + scrollTop + 1) >= scrollHeight;
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
      {rows.map(row => (<Row key={row.id} row={row} columns={columns} { ...params } />))}
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
