import React, { useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import EmptyTip from '../../../../components/empty-tip';
import EmptyImage from '../../../../assets/image/empty.png';
import IconButton from '../../../../components/icon-button';
import Loading from '../../../../components/loading';
import { gettext } from '../../../../constants';

import './index.css';

const Body = ({ isLoading, emptyTip, columns = [], rows = [], loadMore, onDelete, onModify }) => {
  const ref = useRef(null);

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

  if (!Array.isArray(rows) || rows.length === 0) return (<EmptyTip src={EmptyImage} text={emptyTip} />);

  return (
    <div className="sea-qa-project-table-body" onScroll={onScroll} ref={ref}>
      <div className="sea-qa-project-table-row sea-qa-project-table-row-title">
        {columns.map(column => {
          const { key, name, width } = column;
          return (<div className="sea-qa-project-table-cell" key={key} style={{ width }}>{name}</div>);
        })}
      </div>
      {rows.map(row => {
        return (
          <div className="sea-qa-project-table-row" key={row.id}>
            {columns.map(column => {
              const { key, width } = column;
              if (key === 'op') {
                return (
                  <div className="sea-qa-project-table-cell sea-qa-project-table-op-cell" key={key} style={{ width }}>
                    <div className="sea-qa-project-table-cell-content">
                      {onModify && (<IconButton className="bg-color-deep mr-1" title={gettext('Edit')} icon="rename" onClick={() => onModify(row)} />)}
                      {onDelete && (<IconButton className="bg-color-deep" title={gettext('Delete')} icon="delete" onClick={() => onDelete(row)} />)}
                    </div>
                  </div>
                );
              }
              const value = row[key];
              return (<div className="sea-qa-project-table-cell" key={key} style={{ width }}>{value}</div>);
            })}
          </div>
        );
      })}
      {isLoading && (
        <div className="sea-qa-project-table-row sea-qa-project-table-row-loading">
          <Loading />
        </div>
      )}
    </div>
  );
};

Body.propTypes = {
  emptyTip: PropTypes.string,
  columns: PropTypes.array,
  rows: PropTypes.array,
};

export default Body;
