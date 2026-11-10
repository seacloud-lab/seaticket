import React from 'react';
import classnames from 'classnames';

import './index.css';

const StatisticItem = ({ title, className, children }) => {
  return (
    <div className={classnames('seaqa-statistic-item', className)}>
      <div className="seaqa-statistic-item-title text-truncate">
        {title}
      </div>
      {children}
    </div>
  );
};

export default StatisticItem;
