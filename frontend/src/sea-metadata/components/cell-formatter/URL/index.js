import React from 'react';
import classnames from 'classnames';

import './index.css';

const URLFormatter = ({ className, value, children: emptyFormatter }) => {
  if (!value) return emptyFormatter || null;
  const classname = classnames('sea-metadata-ui cell-formatter-container url-formatter', className);
  return (
    <div title={value} className={classname}>{value}</div>
  );
};

export default URLFormatter;
