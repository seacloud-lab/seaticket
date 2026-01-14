import React, { useCallback, useEffect, useRef, useState } from 'react';
import classnames from 'classnames';
import InboxNotificationItem from '@/components/common/notification/components/inbox-notification-item';
import { CenteredLoading, Icon, EmptyTip } from '@/components';
import { useNotification } from '@/components/common/notification/hooks/notification';
import { gettext, mediaUrl, siteRoot } from '@/constants';
import { BAR_TYPE, BAR_TYPE_CONFIG } from '@/project/constants';
import { isNearBottom } from '@/utils/dom.js';
import { Utils } from '@/utils/utils';
import { Z_INDEX } from '@/constants';
import { NOTIFICATION_TYPE } from '@/components/common/notification/constants';

import './index.css';

const AllInbox = ({ toggleBar }) => {
  const { loading, loadingMore, notificationList, allNotificationCount, markAsRead, markAllAsRead, fetchNotifications, fetchAllNotifications, showInboxDrawer, setShowInboxDrawer } = useNotification();
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
      fetchNotifications(page.current, 20);
    }
  }, [loadingMore, notificationList]);

  const onHandleClick = useCallback((e) => {
    if (inboxPanelRef.current.contains(e.target)) return;
    setShowInboxDrawer(false);
  }, []);

  const onNoticeItemClick = useCallback((item) => {
    if (curTab === NOTIFICATION_TYPE.GENERAL) {
      markAsRead(item.id);
    } else if (curTab === NOTIFICATION_TYPE.PROJECT) {
      const projectName = item.project_name || item.name || '';
      const projectHref = siteRoot + 'workspace/' + item.workspace_id + '/project/' + encodeURIComponent(projectName) + '/tickets/?view=open';
      setShowInboxDrawer(false);
      window.location.href = projectHref;
    }
  }, [curTab]);

  useEffect(() => {
    document.addEventListener('click', onHandleClick);
    return () => {
      document.removeEventListener('click', onHandleClick);
    };
  }, [onHandleClick]);

  // Mount
  useEffect(() => {
    if (showInboxDrawer) {
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
        <div className="sea-qa-inbox-actions" onClick={markAllAsRead} title={gettext('mark all as read')}>
          <Icon symbol="mark-all-as-read" />
        </div>
      </div>
      <div className="sea-qa-inbox-list" onScroll={Utils.debounce(onScroll)}>
        {loading && <CenteredLoading />}
        {!loading && notificationList.length === 0 && (
          <EmptyTip
            src={`${mediaUrl}img/no-nitification.png`}
            title={gettext('No notifications')}
            text={gettext('You will receive collaboration notifications for here')}
          />
        )}
        {!loading && notificationList.length > 0 && (
          <>
            {notificationList.map(item => (
              <InboxNotificationItem
                key={item.id}
                noticeItem={item}
                onNoticeItemClick={() => onNoticeItemClick(item)}
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

export default AllInbox;
