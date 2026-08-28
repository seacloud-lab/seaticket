import React from 'react';

import './index.css';

const Card = ({ statistic }) => {
  return (
    <div className="sea-metadata-statistic sea-metadata-statistic-card">
      <div className="sea-metadata-statistic-name font-size-16 text-truncate" title={statistic.name}>
        {statistic.name}
      </div>
      <div className="sea-metadata-statistic-value font-weight-600 text-truncate" title={statistic.value}>
        {statistic.value}
      </div>
    </div>
  );
};

export default Card;
