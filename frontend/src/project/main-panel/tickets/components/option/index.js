import React from 'react';
import classnames from 'classnames';

import './index.css';

const Tag = ({ option, className }) => {
  if (!option) return null;
  const { name, color, text_color } = option;
  return (
    <div
      className={classnames('sea-qa-tag', className)}
      style={{ backgroundColor: color, color: text_color }}
      title={name}
    >
      {name}
    </div>
  );
};

export default Tag;
