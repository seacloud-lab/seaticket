import React, { useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { gettext, siteRoot, mediaUrl } from '@constants/config';
import { BAR_TYPE, EVENT_BUS_TYPE } from '@/project/constants';
import { Utils } from '../../../../utils/utils';
import eventBus from '@/utils/event-bus';

import './notice-inbox-item.css';

const propTypes = {
  noticeItem: PropTypes.object.isRequired,
  onNoticeItemClick: PropTypes.func
};

const MSG_TYPE_ADD_USER_TO_GROUP = 'add_user_to_group';
const MSG_TYPE_TICKET_ASSIGNEE_ADDED = 'ticket_assignee_added';
const MSG_TYPE_TICKET_COMMENTED = 'ticket_commented';

dayjs.extend(relativeTime);

const NoticeItem = ({ noticeItem, onNoticeItemClick, toggleBar, setShowInboxDrawer }) => {
  const generatorNoticeInfo = useCallback(() => {
    const noticeType = noticeItem.msg_type;
    const detail = noticeItem.detail || {};

    if (noticeType === MSG_TYPE_TICKET_ASSIGNEE_ADDED || noticeType === MSG_TYPE_TICKET_COMMENTED) {
      const {
        from_user_name,
        from_user_id,
        ticket_id,
        ticket_title,
        workspace_id,
        project_name,
        comment_content,
      } = detail;

      const avatar_url = null;
      const username = from_user_name || from_user_id || gettext('System');

      let ticketUrl = null;
      if (workspace_id && project_name && ticket_id !== undefined && ticket_id !== null) {
        ticketUrl = siteRoot + 'workspace/' + workspace_id + '/project/' + encodeURIComponent(project_name) + '/tickets/' + ticket_id + '/';
      }

      let notice = '';
      if (noticeType === MSG_TYPE_TICKET_ASSIGNEE_ADDED) {
        notice = gettext('{user} added you as an assignee in ticket {ticket}.');
        notice = notice.replace('{user}', username);
        notice = notice.replace('{ticket}', `{tagA}${ticket_title || ('#' + ticket_id)}{/tagA}`);
        notice = Utils.HTMLescape(notice);
        if (ticketUrl) {
          notice = notice.replace('{tagA}', `<a href='${Utils.encodePath(ticketUrl)}'>`);
        } else {
          notice = notice.replace('{tagA}', '<span>');
        }
        notice = notice.replace('{/tagA}', ticketUrl ? '</a>' : '</span>');
      } else {
        notice = gettext('Added a new comment in the row.');
        if (comment_content) {
          const escapedContent = Utils.HTMLescape(comment_content);
          notice = notice + `<br/><span class="comment-content-preview">"${escapedContent}"</span>`;
        }
      }

      return { avatar_url, notice, username, ticketUrl };
    }

    if (noticeType === MSG_TYPE_ADD_USER_TO_GROUP) {
      const avatar_url = null;
      const groupStaff = detail.group_staff_name;
      const userHref = siteRoot + 'profile/' + encodeURIComponent(detail.group_staff_email) + '/';
      const groupName = detail.group_name;
      const username = detail.group_staff_name;
      let notice = gettext('User {user_link} has added you to {group_name}');
      const userLink = '<a href=' + userHref + '>' + Utils.HTMLescape(groupStaff) + '</a>';
      notice = notice.replace('{user_link}', userLink);
      notice = notice.replace('{group_name}', groupName);
      return { avatar_url, notice, username };
    }

    return { avatar_url: null, notice: null, username: null };
  }, [noticeItem]);

  const { username, notice, ticketUrl } = useMemo(() => generatorNoticeInfo(), [generatorNoticeInfo]);

  const handleMarkNotificationRead = useCallback((e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    onNoticeItemClick(noticeItem);
  }, [noticeItem, onNoticeItemClick]);

  const handleNoticeItemClick = useCallback((url) => {
    onNoticeItemClick(noticeItem);
    if (url) {
      setShowInboxDrawer(false);
      toggleBar([BAR_TYPE.TICKET]);
      setTimeout(() => {
        eventBus.dispatch(EVENT_BUS_TYPE.TICKET_PAGE, noticeItem.detail.ticket_id);
      }, 0);
    }
  }, [noticeItem, onNoticeItemClick]);

  const defaultAvatarUrl = `${mediaUrl}/avatars/default.png`;

  if (!notice) {
    return null;
  }

  return (
    <div
      className="inbox-notification-item"
      onClick={() => handleNoticeItemClick(ticketUrl)}
      tabIndex={0}
      role="button"
      aria-label={gettext('View notification')}
      onKeyDown={Utils.onKeyDown}
      style={{ cursor: ticketUrl ? 'pointer' : 'default' }}
    >
      <div className="inbox-notification-item-header">
        <div className="notification-header-info">
          <div className="notification-user-detail">
            <img className="notification-user-avatar" src={defaultAvatarUrl} alt="" />
            <span className="notification-user-name">{username || gettext('System')}</span>
          </div>
          <span className="notification-time">{dayjs(noticeItem.time).fromNow()}</span>
        </div>
        {!noticeItem.seen && (
          <span className="notification-point" onClick={handleMarkNotificationRead} />
        )}
      </div>
      <div className="notification-content-wrapper">
        <div dangerouslySetInnerHTML={{ __html: notice }} />
      </div>
    </div>
  );
};

NoticeItem.propTypes = propTypes;

export default NoticeItem;
