import React from 'react';
import classnames from 'classnames';

import './index.css';

const Tag = ({ tag, className }) => {
  if (!tag || !tag.id) return null;
  const { name, color, text_color } = tag;
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
