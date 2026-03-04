import React from 'react';
import classnames from 'classnames';
import { PRIORITY_MAP } from '@/sea-metadata/constants';
import { Icon } from '@/components';

import './index.css';

const PriorityFormatter = ({ value, className, showName = false, children: emptyFormatter }) => {
  const priority = PRIORITY_MAP[value];
  if (!priority) return emptyFormatter || null;

  return (
    <div className={classnames('sea-metadata-ui cell-formatter-container priority-formatter', className, { 'w-auto': showName })}>
      {priority.icon && (
        <Icon className="sea-metadata-icon" symbol={priority.icon} title={priority.name}/>
      )}
      {showName && (
        <span className="ml-2">{priority.name}</span>
      )}
    </div>
  );
};

export default PriorityFormatter;
