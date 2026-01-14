import React, { useCallback, useEffect } from 'react';
import classNames from 'classnames';
import { Icon } from '@/components';
import { useNotification } from '@/components/common/notification/hooks/notification';
import { gettext } from '@/constants';

import './all-inbox-nav.css';

const AllInboxNav = ({ onTabClick, isOpenGroupExpanded }) => {
  const { unseen, fetchAllNotifications, showInboxDrawer, setShowInboxDrawer } = useNotification();
  const displayCount = unseen > 99 ? '99+' : unseen;

  const handleClick = useCallback((event) => {
    onTabClick(event);
    setShowInboxDrawer(!showInboxDrawer);
  }, [showInboxDrawer]);

  useEffect(() => {
    fetchAllNotifications();
  }, []);

  return (
    <div
      className={classNames('all-inbox-nav-wrapper nav-item sea-qa-nav-item projects-nav', { 'mt-3': isOpenGroupExpanded })}
      onClick={handleClick}
    >
      <div aria-label={gettext('Inbox')} className="nav-link sea-qa-nav-link">
        <Icon symbol="inbox-navbar" className="nav-icon" />
        <span className="nav-text">{gettext('Inbox')}</span>
        {displayCount !== 0 && (
          <div className="all-inbox-count">
            {displayCount}
          </div>
        )}
      </div>
    </div>
  );
};

export default AllInboxNav;
