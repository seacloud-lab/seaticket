import React from 'react';
import classnames from 'classnames';

import './index.css';

const Type = ({ type, className }) => {
  if (!type) return null;
  const { name, color, text_color } = type;
  return (
    <div
      className={classnames('sea-qa-type', className)}
      style={{ backgroundColor: color, color: text_color }}
      title={name}
    >
      {name}
    </div>
  );
};

export default Type;
