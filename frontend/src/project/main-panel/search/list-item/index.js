import React, { useCallback } from 'react';
import { mediaUrl } from '../../../../constants';
import { CONNECTION_TYPES } from '../../../constants';

import './index.css';

const ListItem = ({ type, id, title, subtitle, url }) => {
  const connectionOption = CONNECTION_TYPES.find(c => c.type === type);

  const openOriginalURL = useCallback(() => {
    if (!url) return;
    window.open(url);
  }, [url]);

  return (
    <div className="list-item" key={id} onClick={openOriginalURL}>
      <div className="list-item-icon">
        <img src={`${mediaUrl}img/connection/${connectionOption.icon}.png`} alt={connectionOption.name} className="sea-qa-project-connection-type-icon" />
      </div>
      <div className="list-item-content">
        <div className="list-item-title">{title || ''}</div>
        <div className="list-item-path">{subtitle || ''}</div>
      </div>
    </div>
  );
};

export default ListItem;
