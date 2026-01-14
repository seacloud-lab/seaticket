import React, { useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import classnames from 'classnames';
import relativeTime from 'dayjs/plugin/relativeTime';
import { gettext, siteRoot, mediaUrl } from '@constants/config';
import { BAR_TYPE } from '@/project/constants';
import { Utils } from '@/utils/utils';
import { removeTextMark } from '@/utils/remove-text-mark';
import { DEFAULT_COLOR } from '@/constants';

import './inbox-notification-item.css';

const propTypes = {
  noticeItem: PropTypes.object.isRequired,
  onNoticeItemClick: PropTypes.func,
  toggleBar: PropTypes.func,
  setShowInboxDrawer: PropTypes.func,
};

const MSG_TYPE_TICKET_ASSIGNEE_ADDED = 'ticket_assignee_added';
const MSG_TYPE_TICKET_COMMENTED = 'ticket_commented';
const MSG_TYPE_ADD_USER_TO_GROUP = 'add_user_to_group';
const MSG_TYPE_PROJECT = 'project_notifications';

dayjs.extend(relativeTime);

const InboxNotificationItem = ({ noticeItem, onNoticeItemClick, toggleBar, setShowInboxDrawer }) => {

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
        ticket_title,
        comment_content,
      } = detail;

      const username = from_user_name || from_user_id || gettext('System');
      const ticketTitle = ticket_title;
      const newCommentContent = removeTextMark(comment_content, false);
      const escapedContent = Utils.HTMLescape(newCommentContent);

      let url = null;
      if (workspace_id && project_name && ticket_id !== undefined && ticket_id !== null) {
        url = siteRoot + 'workspace/' + workspace_id + '/project/' + encodeURIComponent(project_name) + '/tickets/' + ticket_id + '/';
      }
      return { username, title: ticketTitle, url, commentContent: escapedContent };
    }
    if (noticeType === MSG_TYPE_ADD_USER_TO_GROUP) {
      // group name does not support special characters
      const url = siteRoot + 'profile/' + encodeURIComponent(detail.group_staff_email) + '/';
      const username = detail.group_staff_name;
      const groupName = detail.group_name;
      const userLink = '<a class="inbox-text-orange" href=' + url + '>' + Utils.HTMLescape(username) + '</a>';
      const title = gettext('User {user_link} has added you to %a').replace('{user_link}', userLink).replace('%a', groupName);
      return { username, title };
    }

    return { username: null, title: null, url: null, commentContent: '' };
  }, [noticeItem]);

  const { username, title, url, commentContent } = useMemo(() => generatorNoticeInfo(), [generatorNoticeInfo]);

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
    if (noticeType === MSG_TYPE_TICKET_ASSIGNEE_ADDED) {
      return (
        <div className="notification-content-wrapper">
          {gettext('You are added as a assignee for ticket named') + ' '}
          <span class="inbox-text-orange">{title}</span>
          {gettext('.')}
        </div>
      );
    }
    if (noticeType === MSG_TYPE_TICKET_COMMENTED) {
      return (
        <>
          <div className="notification-content-wrapper">
            {gettext('Added a new comment for ticket named') + ' '}
            <span class='inbox-text-orange'>{title}</span>
            {gettext('.')}
          </div>
          <div className="notification-content-wrapper d-flex">
            <span className="notification-content-quotes">"</span>
            <div className="notification-comment-content">
              {commentContent}
            </div>
            <span className="notification-content-quotes text-end">"</span>
          </div>
        </>
      );
    }
    if (noticeType === MSG_TYPE_ADD_USER_TO_GROUP) {
      return <div className="notification-content-wrapper" dangerouslySetInnerHTML={{ __html: title }}/>;
    }
    return null;
  }, [noticeItem, title, commentContent]);

  const renderHead = useCallback(() => {
    const noticeType = noticeItem.msg_type;
    if (noticeType === MSG_TYPE_PROJECT) {
      const iconClass = noticeItem.project_icon || 'icon-worksheet';
      const iconColor = noticeItem.project_color || DEFAULT_COLOR;
      return (
        <div className="inbox-notification-item-header">
          <div className="notification-header-info">
            <div className="notification-user-detail">
              <i className={classnames('notification-user-avatar project-icon', iconClass)} style={{ color: iconColor }} />
              <span className="notification-user-name">{noticeItem.project_name}</span>
            </div>
          </div>
          {!noticeItem.seen && (
            <span className="notification-point project-inbox-count">
              {noticeItem.unseen_count}
            </span>
          )}
        </div>
      );
    }

    return (
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
    );
  }, [noticeItem]);

  return (
    <div
      className="inbox-notification-item"
      onClick={() => handleNoticeItemClick()}
      role="button"
      style={{ cursor: url ? 'pointer' : 'default' }}
    >
      {renderHead()}
      {renderContent()}
    </div>
  );
};

InboxNotificationItem.propTypes = propTypes;

export default InboxNotificationItem;
