import React, { useEffect } from 'react';
import { Icon } from '../../../components';
import { useNotification } from '@/components/common/notification/hooks/notification';
import InboxCount from '@/components/common/notification/components/inbox-count';
import { NAVIGATION_BASE_PADDING, NAVIGATION_LEVEL_INDENT } from '@/constants';

import './inbox-nav.css';

const InboxNav = ({ nav, level }) => {
  const { unseen, showInboxDrawer, setShowInboxDrawer, fetchNotifications } = useNotification();
  const { name, icon } = nav;

  useEffect(() => {
    fetchNotifications();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="seaqa-project-navigation-item"
      style={{ paddingLeft: level > 1 ? (level - 1) * NAVIGATION_LEVEL_INDENT + NAVIGATION_BASE_PADDING : NAVIGATION_BASE_PADDING }}
      onClick={(e) => {
        e.stopPropagation();
        setShowInboxDrawer(!showInboxDrawer);
      }}
      title={name}
    >
      {icon && (<Icon symbol={icon} className="seaqa-project-navigation-item-icon" />)}
      <span className="seaqa-project-navigation-item-name">{name}</span>
      <InboxCount unseen={unseen} />
    </div>
  );
};

export default InboxNav;
