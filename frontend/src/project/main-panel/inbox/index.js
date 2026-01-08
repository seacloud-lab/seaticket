import React, { useCallback, useEffect, useRef } from 'react';
import NoticeInboxItem from '@/project/main-panel/inbox/components/notice-inbox-item';
import { CenteredLoading, Icon, EmptyTip } from '@/components';
import { useNotification } from '@/sea-metadata';
import { gettext, mediaUrl } from '@/constants';
import { isNearBottom } from '@/utils/dom.js';
import { Utils } from '@/utils/utils';

import './index.css';

const Inbox = ({ title }) => {
  const { loading, loadingMore, notificationList, allNotificationCount, markAsRead, markAllAsRead, fetchNotifications, setShowInboxDrawer } = useNotification();
  const page = useRef(1);
  const inboxPanelRef = useRef(null);

  const onScroll = useCallback((e) => {
    const hasMore = notificationList.length < allNotificationCount;
    if (loadingMore || !hasMore) return;

    // Load more notifications when near bottom
    if (isNearBottom(e.target)) {
      page.current = page.current + 1;
      fetchNotifications(page.current, 20, true);
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

  return (
    <div className="sea-qa-inbox-panel" ref={inboxPanelRef}>
      <div className="sea-qa-inbox-header">
        <span className="heading">{title}</span>
        <div className="sea-qa-inbox-actions">
          <Icon symbol="mark-all-as-read" />
          <div className="mark-all-as-read" onClick={markAllAsRead}>
            {gettext('Mark all as read')}
          </div>
        </div>
      </div>
      <div className="sea-qa-inbox-list" onScroll={Utils.debounce(onScroll)}>
        {loading && <CenteredLoading />}
        {!loading && notificationList.length === 0 && (
          <EmptyTip
            src={`${mediaUrl}img/no-nitification.png`}
            title={gettext('No notifications')}
            text={gettext('You will receive collaboration notifications for tickets here')}
          />
        )}
        {!loading && notificationList.length > 0 && (
          <>
            {notificationList.map(item => (
              <NoticeInboxItem key={item.id} noticeItem={item} onNoticeItemClick={() => markAsRead(item.id)} />
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default Inbox;
