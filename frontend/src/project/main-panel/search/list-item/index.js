import React from 'react';
import { mediaUrl } from '../../../../constants';
import { CONNECTION_TYPES } from '../../../constants';

import './index.css';

const ListItem = ({ type, id, title, filename, url, path }) => {
  const connectionOption = CONNECTION_TYPES.find(c => c.type === type);
  return (
    <div className="list-item" key={id}>
      <div className="list-item-icon">
        <img src={`${mediaUrl}img/connection/${connectionOption.icon}.png`} alt={connectionOption.name} className="sea-qa-project-connection-type-icon" />
      </div>
      <div className="list-item-content">
        <div className="list-item-title">{title || filename || ''}</div>
        <div className="list-item-path">{url || path || ''}</div>
      </div>
    </div>
  );
};

export default ListItem;
