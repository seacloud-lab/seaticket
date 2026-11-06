import React from 'react';
import classnames from 'classnames';

import './index.css';

export default function Loading({ className, ...props }) {
  return (
    <span
      className={classnames('seaqa-loading-icon seaqa-loading-tip', className)}
      { ...props }
    >
    </span>
  );
}
