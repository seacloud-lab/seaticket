import React from 'react';
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
  onDelete,
  onModify,
  showStatus,
  onManualCrawl,
}) => {

  return (
    <div className={classnames('sea-customize-table-wrapper', className)}>
      {children}
      {children && (<div className="sea-customize-table-wrapper-divider"></div>)}
      <Body isLoading={isLoading} emptyTip={emptyTip} columns={columns} rows={rows} loadMore={loadMore} onDelete={onDelete} onModify={onModify} showStatus={showStatus} onManualCrawl={onManualCrawl} />
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
  onDelete: PropTypes.func,
  onModify: PropTypes.func,
  showStatus: PropTypes.func,
  onManualCrawl: PropTypes.func,
};

CustomizeTable.Header = Header;

export default CustomizeTable;
