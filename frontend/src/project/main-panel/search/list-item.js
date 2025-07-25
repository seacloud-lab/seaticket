import React from 'react';
import Icon from '../../../components/icon';
import './list-item.css';

const ListItem = ({ id, title, filename, url, path }) => {
  return (
    <div className="list-item" key={id}>
      <div className="list-item-icon">
        <Icon symbol={'site'} className="sea-qa-project-navigation-node-icon" />
      </div>
      <div className="list-item-content">
        <div className="list-item-title">{title || filename || ''}</div>
        <div className="list-item-path">{url || path || ''}</div>
      </div>
    </div>
  )
};

export default ListItem;
