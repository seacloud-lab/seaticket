import React, { useCallback, useEffect, useRef } from 'react';
import InboxNotificationList from '@/components/common/notification/components/inbox-notification-list';
import { Icon } from '@/components';
import { useNotification } from '@/components/common/notification/hooks/notification';
import { Z_INDEX, gettext } from '@/constants';
import { BAR_TYPE, BAR_TYPE_CONFIG } from '@/project/constants';
import { isNearBottom } from '@/utils/dom.js';

import './index.css';

const Inbox = ({ toggleBar }) => {
  const { loading, loadingMore, notificationList, allNotificationCount, markAsRead, markAllAsRead, fetchNotifications, setShowInboxDrawer } = useNotification();
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
      fetchNotifications(page.current, 50);
    }
  }, [loadingMore, notificationList]);

  const onHandleClick = useCallback((e) => {
    if (inboxPanelRef.current.contains(e.target)) return;
    setShowInboxDrawer(false);
  }, []);

  useEffect(() => {
    document.addEventListener('click', onHandleClick);
    return () => {
      document.removeEventListener('click', onHandleClick);
    };
  }, [onHandleClick]);

  useEffect(() => {
    fetchNotifications();
  }, []);

  return (
    <div className="sea-qa-inbox-panel" ref={inboxPanelRef} style={{ zIndex: Z_INDEX.INBOX }}>
      <div className="sea-qa-inbox-header">
        <span className="heading">{title}</span>
        <div className="sea-qa-inbox-actions" onClick={markAllAsRead}>
          <Icon symbol="mark-all-as-read" />
          <div className="mark-all-as-read">{gettext('Mark all as read')}</div>
        </div>
      </div>
      <InboxNotificationList
        loading={loading}
        onScroll={onScroll}
        notificationList={notificationList}
        markAsRead={(noticeItem) => { markAsRead(noticeItem.id);}}
        setShowInboxDrawer={setShowInboxDrawer}
        toggleBar={toggleBar}
      />
    </div>
  );
};

export default Inbox;
