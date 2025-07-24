import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import EmptyTip from '../../../../components/empty-tip';
import IconButton from '../../../../components/icon-button';
import Loading from '../../../../components/loading';
import { gettext } from '../../../../constants';
import { TABLE_COLUMN_TYPE } from '../../../constants';
import Formatter from './cell-formatter';

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
              const { key, width, is_custom, type } = column;
              if (type === TABLE_COLUMN_TYPE.OP) {
                return (
                  <div className="sea-qa-project-custom-table-cell sea-qa-project-custom-table-op-cell" key={key} style={{ width }}>
                    <div className="sea-qa-project-custom-table-op-cell-content">
                      {onModify && (<IconButton className="bg-color-deep mr-1" title={gettext('Edit')} icon="rename" onClick={() => onModify(row)} />)}
                      {onDelete && (<IconButton className="bg-color-deep" title={gettext('Delete')} icon="delete" onClick={() => onDelete(row)} />)}
                    </div>
                  </div>
                );
              }
              if (type === TABLE_COLUMN_TYPE.EMPTY) {
                return (<div className="sea-qa-project-custom-table-cell" style={{ width }}></div>);
              }
              const value = is_custom ? row['config']?.[key] : row[key];
              if (type === TABLE_COLUMN_TYPE.URL || type === TABLE_COLUMN_TYPE.LONG_TEXT) {
                return (
                  <div className={`sea-qa-project-custom-table-cell sea-qa-project-custom-table-${type}-cell`} key={key} style={{ width }}>
                    <Formatter type={type} value={value} />
                  </div>
                );
              }
              if (type === TABLE_COLUMN_TYPE.CONNECTION_NAME) {
                return (
                  <div className={`sea-qa-project-custom-table-cell sea-qa-project-custom-table-${type}-cell`} key={key} style={{ width }} title={value}>
                    <Formatter type={type} value={value} connectionType={row['type']} />
                  </div>
                );
              }

              return (<div className="sea-qa-project-custom-table-cell" key={key} style={{ width }} title={value}>{value}</div>);
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
  emptyTip: PropTypes.any,
  columns: PropTypes.array,
  rows: PropTypes.array,
};

export default Body;
