import React from 'react';
import { mediaUrl } from '../../../../constants';
import { CONNECTION_TYPES } from '../../../constants';

import './index.css';

const ListItem = ({ type, id, title, filename, url, path, server_url, repo_id, repo_name }) => {
  const connectionOption = CONNECTION_TYPES.find(c => c.type === type);
  const folderPath = path.endsWith('/') ? path.slice(0, -1) : path;
  const filePath = folderPath + '/' + filename;

  const onClickListItem = () => {
    if (connectionOption.type === 'seafile') {
      const file_url = server_url + '/lib/' + repo_id + '/file' + filePath;
      window.open(file_url);
    }
  };

  return (
    <div className="list-item" key={id} onClick={onClickListItem}>
      <div className="list-item-icon">
        <img src={`${mediaUrl}img/connection/${connectionOption.icon}.png`} alt={connectionOption.name} className="sea-qa-project-connection-type-icon" />
      </div>
      <div className="list-item-content">
        <div className="list-item-title">{title || filename || ''}</div>
        <div className="list-item-path">{url || repo_name + filePath || ''}</div>
      </div>
    </div>
  );
};

export default ListItem;
