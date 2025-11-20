import React, { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import EmptyTip from '../../empty-tip';
import Loading from '../../loading';
import Rows from './rows';
import { Utils } from '@/utils/utils';

import './index.css';

const ROW_HEIGHT = 40;
const RENDER_MORE_NUMBER = 10;

const Body = ({ isLoading, emptyTip, columns = [], rows = [], loadMore, rowHeight = ROW_HEIGHT, ...params }) => {
  const [startRenderIndex, setStartRenderIndex] = useState(0);
  const [endRenderIndex, setEndRenderIndex] = useState(Math.min(Math.ceil(window.innerHeight / rowHeight) + RENDER_MORE_NUMBER, rows.length));

  const tableRef = useRef(null);
  const rowsCountRef = useRef(0);
  const rowHeightRef = useRef(0);

  const onScroll = useCallback(Utils.throttle(() => {
    if (isLoading) return;
    if (!loadMore) return;
    const clientHeight = tableRef.current.clientHeight;
    const scrollHeight = tableRef.current.scrollHeight;
    const scrollTop = tableRef.current.scrollTop;

    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - RENDER_MORE_NUMBER);
    const end = Math.min(Math.ceil((scrollTop + clientHeight) / rowHeight) + RENDER_MORE_NUMBER, rows.length);

    if (Math.abs(start - startRenderIndex) > 5 || start < 5) {
      setStartRenderIndex(start);
    }
    if (Math.abs(end - endRenderIndex) > 5 || end > rows.length - 5) {
      setEndRenderIndex(end);
    }

    const isBottom = (clientHeight + scrollTop + 1) >= scrollHeight;
    if (!isBottom) return;
    loadMore();
  }, 100), [isLoading, loadMore, rows.length, rowHeight]);

  useEffect(() => {
    if (!tableRef.current) return;
    if (!Array.isArray(rows)) return;
    if (rowsCountRef.current === rows.length && rowHeightRef.current === rowHeight) return;
    rowsCountRef.current = rows.length;
    rowHeightRef.current = rowHeight;
    const contentScrollTop = tableRef.current.scrollTop;
    const start = Math.max(0, Math.floor(contentScrollTop / rowHeight) - RENDER_MORE_NUMBER);
    const height = tableRef.current.clientHeight;
    const end = Math.min(Math.ceil((contentScrollTop + height) / rowHeight) + RENDER_MORE_NUMBER, rowsCountRef.current);
    if (start !== startRenderIndex) {
      setStartRenderIndex(start);
    }
    if (end !== endRenderIndex) {
      setEndRenderIndex(end);
    }
  }, [rows, rowHeight]);

  if (!Array.isArray(rows) || rows.length === 0) {
    if (typeof(emptyTip) === 'string') return (<EmptyTip text={emptyTip} />);
    return (emptyTip);
  }

  return (
    <div className="sea-custom-table" onScroll={onScroll} ref={tableRef}>
      <div className="sea-custom-table-row sea-custom-table-row-title">
        {columns.map(column => {
          const { key, name, width } = column;
          return (<div className="sea-custom-table-cell" key={key} style={{ width }}>{name}</div>);
        })}
      </div>
      {startRenderIndex > 0 && (
        <div style={{ height: startRenderIndex * rowHeight, width: '100%', flexShrink: 0 }}></div>
      )}
      <Rows rows={rows.slice(startRenderIndex, endRenderIndex)} columns={columns} rowHeight={rowHeight} { ...params } />
      {(rows.length - endRenderIndex) > 0 && (
        <div style={{ height: (rows.length - endRenderIndex) * rowHeight, width: '100%', flexShrink: 0 }}></div>
      )}
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
