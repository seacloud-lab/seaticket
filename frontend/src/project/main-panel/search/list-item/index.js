import React, { useCallback } from 'react';
import { mediaUrl } from '@/constants';
import { CONNECTION_TYPES } from '../../connections/constants';

import './index.css';

const ListItem = ({ type, id, title, subtitle, url, content = '', bumped_at = '', searchValue }) => {
  const connectionOption = CONNECTION_TYPES.find(c => c.type === type);

  const openOriginalURL = useCallback(() => {
    if (!url) return;
    window.open(url);
  }, [url]);

  const renderDetail = () => {
    const bumpedDate = bumped_at.split(' ')[0];
    if (!content) {
      return bumpedDate;
    }
    const boldContent = content.replace(new RegExp(searchValue, 'ig'), (match) => `<span class="font-weight-bold">${match}</span>`);
    if (!bumped_at) {
      return boldContent;
    }
    return `${bumpedDate} - ${boldContent}`;
  };

  return (
    <div className="list-item" key={id} onClick={openOriginalURL}>
      <div className="list-item-icon">
        <img src={`${mediaUrl}img/connection/${connectionOption.icon}.png`} alt={connectionOption.name} className="sea-qa-project-connection-type-icon" />
      </div>
      <div className="list-item-content">
        <div className="list-item-title">{title || ''}</div>
        <div className="list-item-path">{subtitle || ''}</div>
        <div className="list-item-detail" dangerouslySetInnerHTML={{ __html: renderDetail() }}></div>
      </div>
    </div>
  );
};

export default ListItem;
