import React, { useEffect } from 'react';
import { Icon } from '../../../components';
import { useNotification } from '@/components/common/notification/hooks/notification';

import './inbox-nav.css';

const InboxNav = ({ nav, level }) => {
  const { unseen, showInboxDrawer, setShowInboxDrawer, fetchNotifications } = useNotification();
  const { name, icon } = nav;
  const displayCount = unseen > 99 ? '99+' : unseen;

  useEffect(() => {
    fetchNotifications();
  }, []);

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
      {displayCount !== 0 && (
        <div className="sea-qa-project-navigation-item-inbox-count">
          {displayCount}
        </div>
      )}
    </div>
  );
};

export default InboxNav;
