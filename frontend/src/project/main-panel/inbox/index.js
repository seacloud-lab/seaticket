import React from 'react';
import NoticeInboxItem from '@/components/common/notice-inbox-item';
import { CenteredLoading, Icon, EmptyTip } from '@/components';
import { useNotification } from '@/sea-metadata';
import { gettext, mediaUrl } from '@/constants';

import './index.css';

const Inbox = ({ title }) => {
  const { loading, notificationList, markAsRead, markAllAsRead, } = useNotification();

  return (
    <div className="sea-qa-inbox-container">
      <div className="sea-qa-inbox-panel">
        <div className="sea-qa-inbox-header">
          <span className="heading">{title}</span>
          <div className="sea-qa-inbox-actions">
            <Icon symbol="mark-all-as-read" />
            <div className="mark-all-as-read" onClick={markAllAsRead}>
              {gettext('Mark all as read')}
            </div>
          </div>
        </div>
        <div className="sea-qa-inbox-list">
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
    </div>
  );
};

export default Inbox;
