import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import EmptyTip from '../../../../components/empty-tip';
import EmptyImage from '../../../../assets/image/empty.png';
import IconButton from '../../../../components/icon-button';
import Loading from '../../../../components/loading';
import { gettext } from '../../../../constants';

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

  if (!Array.isArray(rows) || rows.length === 0) return (<EmptyTip src={EmptyImage} text={emptyTip} />);

  return (
    <div className="sea-qa-project-custom-table" onScroll={onScroll}>
      <div className="sea-qa-project-custom-table-row sea-qa-project-custom-table-row-title">
        {columns.map(column => {
          const { key, name, width } = column;
          return (<div className="sea-qa-project-custom-table-cell" key={key} style={{ width }}>{name}</div>);
        })}
      </div>
      {rows.map(row => {
        return (
          <div className="sea-qa-project-custom-table-row" key={row.id}>
            {columns.map(column => {
              const { key, width, is_custom } = column;
              if (key === 'op') {
                return (
                  <div className="sea-qa-project-custom-table-cell sea-qa-project-custom-table-op-cell" key={key} style={{ width }}>
                    <div className="sea-qa-project-custom-table-op-cell-content">
                      {onModify && (<IconButton className="bg-color-deep mr-1" title={gettext('Edit')} icon="rename" onClick={() => onModify(row)} />)}
                      {onDelete && (<IconButton className="bg-color-deep" title={gettext('Delete')} icon="delete" onClick={() => onDelete(row)} />)}
                    </div>
                  </div>
                );
              }
              const value = is_custom ? row['value']?.[key] : row[key];
              return (<div className="sea-qa-project-custom-table-cell" key={key} style={{ width }}>{value}</div>);
            })}
          </div>
        );
      })}
      {isLoading && (
        <div className="sea-qa-project-custom-table-row sea-qa-project-custom-table-row-loading">
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
