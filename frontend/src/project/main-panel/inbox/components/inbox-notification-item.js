import React, { useMemo, useCallback, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { processor } from '@seafile/seafile-editor';
import { Trans } from 'react-i18next';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { gettext, siteRoot, mediaUrl } from '@constants/config';
import { BAR_TYPE } from '@/project/constants';

import './inbox-notification-item.css';

const propTypes = {
  noticeItem: PropTypes.object.isRequired,
  onNoticeItemClick: PropTypes.func,
  toggleBar: PropTypes.func,
  setShowInboxDrawer: PropTypes.func,
};

const MSG_TYPE_TICKET_ASSIGNEE_ADDED = 'ticket_assignee_added';
const MSG_TYPE_TICKET_COMMENTED = 'ticket_commented';

dayjs.extend(relativeTime);

const InboxNotificationItem = ({ noticeItem, onNoticeItemClick, toggleBar, setShowInboxDrawer }) => {
  const [notificationContent, setNotificationContent] = useState(null);

  const convertNotification = useCallback(() => {
    const detail = noticeItem.detail || {};
    const { comment_content } = detail;
    processor.process(comment_content).then((result) => {
      const newNotificationContent = String(result);
      setNotificationContent(newNotificationContent);
    });
  }, []);

  useEffect(() => {
    convertNotification();
  }, []);

  const generatorNoticeInfo = useCallback(() => {
    const noticeType = noticeItem.msg_type;
    const detail = noticeItem.detail || {};

    if (noticeType === MSG_TYPE_TICKET_ASSIGNEE_ADDED || noticeType === MSG_TYPE_TICKET_COMMENTED) {
      const {
        from_user_name,
        from_user_id,
        ticket_id,
        workspace_id,
        project_name,
        ticket_title
      } = detail;

      const username = from_user_name || from_user_id || gettext('System');
      const ticketTitle = ticket_title;

      let ticketUrl = null;
      if (workspace_id && project_name && ticket_id !== undefined && ticket_id !== null) {
        ticketUrl = siteRoot + 'workspace/' + workspace_id + '/project/' + encodeURIComponent(project_name) + '/tickets/' + ticket_id + '/';
      }
      return { username, title: ticketTitle, ticketUrl };
    }
    return { username: null, title: null, ticketUrl: null };
  }, [noticeItem]);

  const { username, title, ticketUrl } = useMemo(() => generatorNoticeInfo(), [generatorNoticeInfo]);

  const handleMarkNotificationRead = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    onNoticeItemClick(noticeItem);
  }, [noticeItem, onNoticeItemClick]);

  const handleNoticeItemClick = useCallback(() => {
    onNoticeItemClick(noticeItem);
    const { msg_type, detail } = noticeItem;
    if (msg_type === MSG_TYPE_TICKET_ASSIGNEE_ADDED || msg_type === MSG_TYPE_TICKET_COMMENTED) {
      setShowInboxDrawer(false);
      toggleBar([BAR_TYPE.TICKET, detail.ticket_id]);
    }
  }, [noticeItem, onNoticeItemClick]);

  const renderContent = useCallback(() => {
    const noticeType = noticeItem.msg_type;

    if (noticeType === MSG_TYPE_TICKET_ASSIGNEE_ADDED || noticeType === MSG_TYPE_TICKET_COMMENTED) {
      return (
        <>
          <div className="notification-content-wrapper">
            <Trans i18nKey="notification-text-1">
              Added a new comment for ticket
              <span className="inbox-text-orange">{title}</span>
            </Trans>
          </div>
          <div className="notification-content-wrapper d-flex">
            <span className="notification-content-quotes">"</span>
            <div
              dangerouslySetInnerHTML={{ __html: notificationContent }}
              className="notification-comment-content"
            >
            </div>
            <span className="notification-content-quotes text-end">"</span>
          </div>
        </>
      );
    }
    return null;
  }, [noticeItem, title, notificationContent]);

  return (
    <div
      className="inbox-notification-item"
      onClick={() => handleNoticeItemClick()}
      role="button"
      style={{ cursor: ticketUrl ? 'pointer' : 'default' }}
    >
      <div className="inbox-notification-item-header">
        <div className="notification-header-info">
          <div className="notification-user-detail">
            <img className="notification-user-avatar" src={`${mediaUrl}/avatars/default.png`} alt="" />
            <span className="notification-user-name">{username}</span>
          </div>
          <span className="notification-time">{dayjs(noticeItem.time).fromNow()}</span>
        </div>
        {!noticeItem.seen && (
          <span className="notification-point" onClick={handleMarkNotificationRead} />
        )}
      </div>
      {renderContent()}
    </div>
  );
};

InboxNotificationItem.propTypes = propTypes;

export default InboxNotificationItem;
