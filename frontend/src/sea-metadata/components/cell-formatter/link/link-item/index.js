import React from 'react';

import './index.css';

const LinkItem = ({ value, metadata, onClick }) => {
  const { linked_records } = metadata;

  const title = linked_records[value];
  if (!title) return null;

  return (
    <div className="link-item" onClick={onClick}>
      <span className="link-item-name" title={title}>{title}</span>
    </div>
  );
};

export default LinkItem;
