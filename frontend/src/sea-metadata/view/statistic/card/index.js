import React from 'react';
import classnames from 'classnames';

import './index.css';

const Card = ({ statistic }) => {
  const comparison = statistic.comparison;

  return (
    <div className="sea-metadata-statistic sea-metadata-statistic-card">
      <div className="sea-metadata-statistic-name font-size-16 text-truncate" title={statistic.name}>
        {statistic.name}
      </div>
      <div className="sea-metadata-statistic-value font-weight-600 text-truncate" title={statistic.value}>
        {statistic.value}
      </div>
      {comparison && (
        <div className="sea-metadata-statistic-comparison text-truncate font-size-14 font-weight-400" title={`${comparison.value} ${comparison.label}`}>
          <span className={classnames('sea-metadata-statistic-comparison-value', comparison.status)}>
            {comparison.value}
          </span>
          <span className="sea-metadata-statistic-comparison-label font-size-14 font-weight-400">
            {comparison.label}
          </span>
        </div>
      )}
    </div>
  );
};

export default Card;
