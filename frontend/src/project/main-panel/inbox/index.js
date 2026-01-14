import React, { useCallback, useEffect, useRef } from 'react';
import InboxNotificationItem from '@/components/common/notification/components/inbox-notification-item';
import { CenteredLoading, Icon, EmptyTip } from '@/components';
import { useNotification } from '@/components/common/notification/hooks/notification';
import { gettext, mediaUrl } from '@/constants';
import { BAR_TYPE, BAR_TYPE_CONFIG } from '@/project/constants';
import { isNearBottom } from '@/utils/dom.js';
import { Utils } from '@/utils/utils';
import { Z_INDEX } from '@/constants';

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
      fetchNotifications(page.current, 20);
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
              <InboxNotificationItem
                key={item.id}
                noticeItem={item}
                onNoticeItemClick={() => markAsRead(item.id)}
                toggleBar={toggleBar}
                setShowInboxDrawer={setShowInboxDrawer}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default Inbox;
