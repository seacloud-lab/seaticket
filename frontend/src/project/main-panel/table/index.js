import React from 'react';
import PropTypes from 'prop-types';
import Header from './header';
import Body from './body';

import './index.css';

const Table = ({ isLoading, title, btns, showHeader = true, emptyTip, columns = [], rows = [], loadMore, onDelete, onModify }) => {

  return (
    <div className="sea-qa-project-table p-4">
      {showHeader && (
        <>
          <Header title={title} btns={btns} />
          <div className="sea-qa-project-table-divider"></div>
        </>
      )}
      <Body isLoading={isLoading} emptyTip={emptyTip} columns={columns} rows={rows} loadMore={loadMore} onDelete={onDelete} onModify={onModify} />
    </div>
  );
};

Table.propTypes = {
  isLoading: PropTypes.bool,
  title: PropTypes.any,
  emptyTip: PropTypes.string,
  btns: PropTypes.array,
  columns: PropTypes.array,
  rows: PropTypes.array,
  loadMore: PropTypes.func,
  onDelete: PropTypes.func,
  onModify: PropTypes.func,
};

export default Table;
