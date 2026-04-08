import React, { useCallback, useEffect, useRef, useState } from 'react';
import InboxNotificationList from '@/components/common/notification/components/inbox-notification-list';
import { Icon, CustomizeTabs } from '@/components';
import { useNotification } from '@/components/common/notification/hooks/notification';
import { Z_INDEX, gettext } from '@/constants';
import { BAR_TYPE, BAR_TYPE_CONFIG } from '@/project/constants';
import { isNearBottom } from '@/utils/dom.js';
import { NOTIFICATION_TYPE } from '@/components/common/notification/constants';

import './index.css';

const AllInbox = () => {
  const {
    loading, loadingMore, notificationList, allNotificationCount,
    markAsReadByTab, markAllAsReadByTab, fetchAllNotifications,
    unseenByType,
    showInboxDrawer, setShowInboxDrawer, setNotificationList, setAllNotificationCount,
  } = useNotification();
  const [curTab, setCurTab] = useState(NOTIFICATION_TYPE.GENERAL); // general or project
  const page = useRef(1);
  const inboxPanelRef = useRef(null);
  const bar = BAR_TYPE_CONFIG[BAR_TYPE.INBOX];
  const title = bar.name;
  const projectUnreadCount = unseenByType?.[NOTIFICATION_TYPE.PROJECT] || 0;
  const projectUnreadCountText = projectUnreadCount > 99 ? '99+' : projectUnreadCount;

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
        <CustomizeTabs
          value={curTab}
          tabs={[
            { value: NOTIFICATION_TYPE.GENERAL, label: gettext('General') },
            {
              value: NOTIFICATION_TYPE.PROJECT,
              label: (
                <span className="sea-qa-inbox-tab-label">
                  {gettext('Project')}
                  {projectUnreadCount > 0 && (
                    <>
                      {`(${projectUnreadCountText})`}
                      <span className="sea-qa-inbox-tab-badge" />
                    </>
                  )}
                </span>
              ),
            },
          ]}
          onChange={setCurTab}
        />
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
