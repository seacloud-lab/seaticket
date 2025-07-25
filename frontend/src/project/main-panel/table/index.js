import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import Header from './header';
import Body from './body';

import './index.css';

const Table = ({
  isLoading,
  className = 'p-4',
  emptyTip,
  columns = [],
  rows = [],
  children,
  loadMore,
  onDelete,
  onModify
}) => {

  return (
    <div className={classnames('sea-qa-project-table', className)}>
      {children}
      {children && (<div className="sea-qa-project-table-divider"></div>)}
      <Body isLoading={isLoading} emptyTip={emptyTip} columns={columns} rows={rows} loadMore={loadMore} onDelete={onDelete} onModify={onModify} />
    </div>
  );
};

Table.propTypes = {
  isLoading: PropTypes.bool,
  title: PropTypes.any,
  emptyTip: PropTypes.any,
  btns: PropTypes.array,
  columns: PropTypes.array,
  rows: PropTypes.array,
  loadMore: PropTypes.func,
  onDelete: PropTypes.func,
  onModify: PropTypes.func,
};

Table.Header = Header;

export default Table;
