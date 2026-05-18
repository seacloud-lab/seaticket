import React from 'react';
import InboxNotificationItem from '@/components/common/notification/components/inbox-notification-item';
import { CenteredLoading, EmptyTip } from '@/components';
import { gettext, mediaUrl } from '@/constants';
import { Utils } from '@/utils/utils';

import './inbox-notification-list.css';

const InboxNotificationList = ({
  loading, onScroll, notificationList, markAsRead,
  setShowInboxDrawer, toggleBar,
}) => {

  return (
    <div className="seaqa-inbox-list" onScroll={Utils.debounce(onScroll)}>
      {loading && <CenteredLoading />}
      {!loading && notificationList.length === 0 && (
        <EmptyTip
          src={`${mediaUrl}img/no-nitification.png`}
          title={gettext('No notifications')}
        />
      )}
      {!loading && notificationList.length > 0 && (
        <>
          {notificationList.map(item => (
            <InboxNotificationItem
              key={item.id}
              noticeItem={item}
              onNoticeItemClick={() => markAsRead(item)}
              toggleBar={toggleBar}
              setShowInboxDrawer={setShowInboxDrawer}
            />
          ))}
        </>
      )}
    </div>
  );
};

export default InboxNotificationList;
