import React from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { gettext, siteRoot } from '@constants/config';
import { Utils } from '../../utils/utils';
import '../../css/notice-item.css';

const propTypes = {
  noticeItem: PropTypes.object.isRequired,
  tr: PropTypes.any,
  onNoticeItemClick: PropTypes.func
};

const MSG_TYPE_ADD_USER_TO_GROUP = 'add_user_to_group';

const MSG_TYPE_TICKET_ASSIGNEE_ADDED = 'ticket_assignee_added';
const MSG_TYPE_TICKET_COMMENTED = 'ticket_commented';

dayjs.extend(relativeTime);

class NoticeItem extends React.Component {

  generatorNoticeInfo() {
    let noticeItem = this.props.noticeItem;
    let noticeType = noticeItem.msg_type;
    let detail = noticeItem.detail || {};

    if (noticeType === MSG_TYPE_TICKET_ASSIGNEE_ADDED || noticeType === MSG_TYPE_TICKET_COMMENTED) {
      const {
        from_user_avatar,
        from_user_name,
        from_user_email,
        ticket_id,
        ticket_title,
        workspace_id,
        project_name,
        comment_content,
      } = detail;

      const avatar_url = from_user_avatar || null;
      const username = from_user_name || from_user_email || gettext('System');

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
      let avatar_url = detail.group_staff_avatar_url;
      let groupStaff = detail.group_staff_name;
      // group name does not support special characters
      let userHref = siteRoot + 'profile/' + encodeURIComponent(detail.group_staff_email) + '/';
      let groupName = detail.group_name;
      let username = detail.group_staff_name;
      let notice = gettext('User {user_link} has added you to {group_name}');
      let userLink = '<a href=' + userHref + '>' + Utils.HTMLescape(groupStaff) + '</a>';
      notice = notice.replace('{user_link}', userLink);
      notice = notice.replace('{group_name}', groupName);
      return { avatar_url, notice, username };
    }

    return { avatar_url: null, notice: null, username: null };
  }

  onMarkNotificationRead = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    let item = this.props.noticeItem;
    if (this.props.onNoticeItemClick) {
      this.props.onNoticeItemClick(item);
    }
  };

  onNoticeItemClick = (ticketUrl) => {
    let item = this.props.noticeItem;
    if (this.props.onNoticeItemClick) {
      this.props.onNoticeItemClick(item);
    }
    if (ticketUrl) {
      window.location.href = ticketUrl;
    }
  };

  render() {
    let noticeItem = this.props.noticeItem;
    let { avatar_url, username, notice, ticketUrl } = this.generatorNoticeInfo();
    if (!avatar_url && !notice) {
      return '';
    }

    return this.props.tr ? (
      <tr className='notification-item' onClick={() => this.onNoticeItemClick(ticketUrl)} style={{ cursor: ticketUrl ? 'pointer' : 'default' }}>
        <td className="text-center">
          {!noticeItem.seen &&
          <span
            className="notification-point"
            onClick={this.onMarkNotificationRead}
            tabIndex={0}
            role="button"
            aria-label={gettext('Mark notification as read')}
            onKeyDown={Utils.onKeyDown}
          >
          </span>
          }
        </td>
        <td>
          <img src={avatar_url} width="32" height="32" className="avatar" alt="" />
          <span className="ml-2 notification-user-name">{username || gettext('System')}</span>
        </td>
        <td className="pr-1 pr-md-8">
          <p className="m-0" dangerouslySetInnerHTML={{ __html: notice }}></p>
        </td>
        <td>
          {dayjs(noticeItem.time).fromNow()}
        </td>
      </tr>
    ) : (
      <li
        className='notification-item'
        onClick={() => this.onNoticeItemClick(ticketUrl)}
        tabIndex={0}
        role="button"
        aria-label={gettext('View notification')}
        onKeyDown={Utils.onKeyDown}
        style={{ cursor: ticketUrl ? 'pointer' : 'default' }}
      >
        <div className="notification-item-header">
          {!noticeItem.seen &&
            <span className="notification-point" onClick={this.onMarkNotificationRead}></span>
          }
          <div className="notification-header-info">
            <div className="notification-user-detail">
              <img className="notification-user-avatar" src={avatar_url} alt="" />
              <span className="ml-2 notification-user-name">{username || gettext('System')}</span>
            </div>
            <span className="notification-time">{dayjs(noticeItem.time).fromNow()}</span>
          </div>
        </div>
        <div className="notification-content-wrapper">
          <div dangerouslySetInnerHTML={{ __html: notice }}></div>
        </div>
      </li>
    );
  }
}

NoticeItem.propTypes = propTypes;

export default NoticeItem;
