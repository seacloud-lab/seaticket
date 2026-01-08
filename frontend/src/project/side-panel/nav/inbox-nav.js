import React from 'react';
import { Icon } from '../../../components';
import { useNotification } from '@/sea-metadata';

import './index.css';

const InboxNav = ({ nav, level }) => {
  const { unseen, showInboxDrawer, setShowInboxDrawer } = useNotification();
  const { name, icon } = nav;
  const displayCount = unseen > 99 ? '99+' : unseen;

  return (
    <div
      className="sea-qa-project-navigation-item"
      style={{ paddingLeft: level > 1 ? (level - 1) * 20 + 8 : 8 }}
      onClick={(e) => {
        e.stopPropagation();
        setShowInboxDrawer(!showInboxDrawer);
      }}
      title={name}
    >
      {icon && (<Icon symbol={icon} className="sea-qa-project-navigation-item-icon" />)}
      <span className="sea-qa-project-navigation-item-name">{name}</span>
      {displayCount && (
        <div className="sea-qa-project-navigation-item-inbox-count">
          {displayCount}
        </div>
      )}
    </div>
  );
};

export default InboxNav;
