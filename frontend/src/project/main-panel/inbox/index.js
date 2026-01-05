import React, { useEffect, useState, useCallback } from 'react';
import { notificationAPI } from '../../api';
import NoticeInboxItem from '@/components/common/notice-inbox-item';
import { CenteredLoading, Icon, toaster, EmptyTip } from '@/components';
import { gettext, mediaUrl } from '@/constants';
import { Utils } from '@/utils/utils';

import './index.css';

const { projectUuid } = window.app.pageOptions;
const Inbox = ({ title }) => {
  const [notificationList, setNotificationList] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback((page = 1, perPage = 20, signal) => {
    if (!projectUuid) return;
    return notificationAPI.listProjectNotifications(projectUuid, page, perPage, { signal })
      .then(res => {
        const list = res.data.notification_list || [];
        setNotificationList(list);
      }).catch(err => {
        const errorMsg = Utils.getErrorMsg(err);
        toaster.danger(errorMsg);
      }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(1, 20, controller.signal);
    return () => controller.abort();
  }, [load]);

  const onNoticeClick = (noticeItem) => {
    if (!noticeItem.seen) {
      notificationAPI.markProjectNoticeAsRead(noticeItem.id).then(() => {
        setNotificationList(prev => prev.map(it => it.id === noticeItem.id ? { ...it, seen: true } : it));
      }).catch((err) => {
        const errorMsg = Utils.getErrorMsg(err);
        toaster.danger(errorMsg);
      });
    }
  };

  const onMarkAll = () => {
    if (!projectUuid) return;
    notificationAPI.markAllProjectRead(projectUuid).then(() => {
      setNotificationList(prev => prev.map(it => ({ ...it, seen: true })));
    }).catch(err => {
      const errorMsg = Utils.getErrorMsg(err);
      toaster.danger(errorMsg);
    });
  };

  return (
    <div className="sea-qa-inbox-container">
      <div className="sea-qa-inbox-panel">
        <div className="sea-qa-inbox-header">
          <span className="heading">{title}</span>
          <div className="sea-qa-inbox-actions">
            <Icon symbol="mark-all-as-read" />
            <div className="mark-all-as-read" onClick={onMarkAll}>
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
                <NoticeInboxItem key={item.id} noticeItem={item} onNoticeItemClick={onNoticeClick} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Inbox;
