import React, { useCallback, useEffect, useRef, useState } from 'react';
import classnames from 'classnames';
import InboxNotificationList from '@/components/common/notification/components/inbox-notification-list';
import { Icon } from '@/components';
import { useNotification } from '@/components/common/notification/hooks/notification';
import { gettext } from '@/constants';
import { BAR_TYPE, BAR_TYPE_CONFIG } from '@/project/constants';
import { isNearBottom } from '@/utils/dom.js';
import { Z_INDEX } from '@/constants';
import { NOTIFICATION_TYPE } from '@/components/common/notification/constants';

import './index.css';

const AllInbox = () => {
  const {
    loading, loadingMore, notificationList, allNotificationCount,
    markAsReadByTab, markAllAsReadByTab, fetchAllNotifications,
    showInboxDrawer, setShowInboxDrawer, setNotificationList, setAllNotificationCount,
  } = useNotification();
  const [curTab, setCurTab] = useState(NOTIFICATION_TYPE.GENERAL); // general or project
  const page = useRef(1);
  const inboxPanelRef = useRef(null);
  const bar = BAR_TYPE_CONFIG[BAR_TYPE.INBOX];
  const title = bar.name;

  const onScroll = useCallback((e) => {
    const hasMore = notificationList.length < allNotificationCount;
    if (loadingMore || !hasMore) return;

    // Load more notifications when near bottom
    if (isNearBottom(e.target)) {
      page.current = page.current + 1;
      fetchAllNotifications(page.current, 20, curTab);
    }
  }, [loadingMore, notificationList, allNotificationCount, curTab]);

  const onHandleClick = useCallback((e) => {
    if (!showInboxDrawer) return;
    if (inboxPanelRef.current.contains(e.target)) return;
    setShowInboxDrawer(false);
  }, [showInboxDrawer]);

  useEffect(() => {
    document.addEventListener('click', onHandleClick);
    return () => {
      document.removeEventListener('click', onHandleClick);
    };
  }, [onHandleClick]);

  useEffect(() => {
    const { search } = location;
    const params = new URLSearchParams(search);
    const notifications = params.get('notifications');
    // Email notification to open the panel
    if (notifications === 'all') {
      setShowInboxDrawer(true);
    }
  }, []);

  useEffect(() => {
    if (showInboxDrawer) {
      setNotificationList([]);
      setAllNotificationCount(0);
      page.current = 1;
      fetchAllNotifications(1, 20, curTab);
    }
  }, [showInboxDrawer, curTab]);

  if (!showInboxDrawer) return null;

  return (
    <div className="sea-qa-all-inbox-panel" ref={inboxPanelRef} style={{ zIndex: Z_INDEX.INBOX }}>
      <div className="sea-qa-all-inbox-header">
        <span className="heading">{title}</span>
      </div>
      <div className="sea-qa-all-inbox-tabs-wrapper">
        <div className="sea-qa-tabs">
          <div className={classnames('sea-qa-tab-item', { 'active': curTab === NOTIFICATION_TYPE.GENERAL })} onClick={() => setCurTab(NOTIFICATION_TYPE.GENERAL)}>
            {gettext('General')}
          </div>
          <div className={classnames('sea-qa-tab-item', { 'active': curTab === NOTIFICATION_TYPE.PROJECT })} onClick={() => setCurTab(NOTIFICATION_TYPE.PROJECT)}>
            {gettext('Project')}
          </div>
        </div>
        <div className="sea-qa-inbox-actions" onClick={() => markAllAsReadByTab(curTab)} title={gettext('mark all as read')}>
          <Icon symbol="mark-all-as-read" />
        </div>
      </div>
      <InboxNotificationList
        loading={loading}
        onScroll={onScroll}
        notificationList={notificationList}
        markAsRead={(noticeItem) => { markAsReadByTab(noticeItem, curTab);}}
        setShowInboxDrawer={setShowInboxDrawer}
      />
    </div>
  );
};

export default AllInbox;
