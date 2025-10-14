import React from 'react';
import classnames from 'classnames';
import { Progress } from '@/components';

import './index.css';

const UsageCard = ({ className, title, percent, tip }) => {
  return (
    <div className={classnames('usage-card w-100 d-flex justify-content-between mt-3', className)}>
      <div className="usage-card-content h-100 d-flex">
        <p>{title}</p>
        <p>{`${percent}%`}</p>
        <Progress position="unset" percent={percent} />
        {tip && (
          <span className="mt-1">
            {tip}
          </span>
        )}
      </div>
    </div>
  );
};

export default UsageCard;
