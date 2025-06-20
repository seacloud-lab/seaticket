import React from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import { appAvatarURL, gettext, siteRoot } from '../../../constants';
import dayjs from '../../../utils/dayjs';
import { NOTIFICATION_TYPE } from '../../../constants/notification-constants';

const propTypes = {
  notificationItem: PropTypes.object,
  onNoticeItemClick: PropTypes.func,
};

class NotificationDialogItem extends React.Component {

  onNoticeItemClick = () => {
    const { notificationItem } = this.props;
    this.props.onNoticeItemClick(notificationItem);
  };

  getUserLink = (email, name) => {
    return '<a href="' + siteRoot + 'profile/' + email + '/">' + name + '</a>';
  };

  renderInto = (url, notice, isHTML) => {
    return (
      <>
        <td className="pl-3"><img style={{ borderRadius: '50%' }} src={url} alt="" width="30"/></td>
        <td>
          {isHTML ? <span className="brief" dangerouslySetInnerHTML={{ __html: notice }}></span> : <span className="brief">{notice}</span> }
        </td>
      </>
    );
  };

  renderMainInfo = () => {
    const { notificationItem } = this.props;
    const { type, detail } = notificationItem;
    switch (type) {
      case NOTIFICATION_TYPE.SHARE_DTABLE_TO_USER: {
        const avatar_url = detail.share_from.share_from_user_avatar_url;
        const shareFrom = this.getUserLink(detail.share_from.share_from_user_email, detail.share_from.share_from_user_name);
        const dtableName = detail.dtable.name;
        const dtableUrl = siteRoot + 'workspace/' + detail.dtable.workspace_id + '/dtable/' + dtableName + '/';
        const dtableLink = '<a href="' + dtableUrl + '" >' + dtableName + '</a>';
        let notice = gettext('{share_from} has shared a table named {dtable_link} to you.');
        notice = notice.replace('{share_from}', shareFrom);
        notice = notice.replace('{dtable_link}', dtableLink);
        return this.renderInto(avatar_url, notice, true);
      }
      case NOTIFICATION_TYPE.SUBMIT_FORM: {
        const { form, submit_user } = detail;
        const { form_name } = form;
        const { submit_user_avatar_url, submit_user_name, submit_user_email } = submit_user;
        const dtableUrl = siteRoot + 'workspace/' + form.workspace_id + '/dtable/' + form.name + '/?tid=' + form.table_id + '&row-id=' + form.row_id;
        const dtableLink = '<a href="' + dtableUrl + '" class="notification-detail-link">' + gettext('Details') + '</a>';
        let notice;
        if (!submit_user_name) {
          notice = gettext('Anonymous user has submitted form {formName}.');
          notice = notice.replace('{formName}', form_name);
        } else {
          const userLink = this.getUserLink(submit_user_email, submit_user_name);
          notice = gettext('{submitUser} has submitted form {formName}.');
          notice = notice.replace('{submitUser}', userLink).replace('{formName}', form_name);
        }
        notice = notice + '\n' + dtableLink;
        return this.renderInto(submit_user_avatar_url, notice, true);
      }
      case NOTIFICATION_TYPE.ADD_USER_TO_GROUP: {
        const userLink = this.getUserLink(detail.group_staff_email, detail.group_staff_name);
        let notice = gettext('{user_link} has added you to {group}');
        notice = notice.replace('{user_link}', userLink);
        notice = notice.replace('{group}', detail.group_name);
        return this.renderInto(detail.group_staff_avatar_url, notice, true);
      }
      case NOTIFICATION_TYPE.LICENSE_EXPIRING: {
        if (!detail || !detail.days) return null;
        const { mode, days } = detail;
        let days_str;
        if (days > 1) {
          days_str = `${days} days`;
        } else {
          days_str = `${days} day`;
        }
        let notice = '';
        if (mode === 'life-time'){
          notice = gettext('Your service period will end in {days}.').replace('{days}', days_str);
        } else {
          notice = gettext('Your license will expire in {days}.').replace('{days}', days_str);
        }
        return this.renderInto(appAvatarURL, notice, false);
      }
      default: {
        return null;
      }
    }
  };

  render() {
    const mainInfo = this.renderMainInfo();
    if (!mainInfo) return null;
    const { notificationItem } = this.props;

    return (
      <tr onClick={this.onNoticeItemClick}>
        <td>{!notificationItem.seen && <span className="notification-point"></span>}</td>
        {mainInfo}
        <td>{dayjs((new Date(notificationItem.time)).getTime()).fromNow()}</td>
      </tr>
    );
  }

}

NotificationDialogItem.propTypes = propTypes;

export default NotificationDialogItem;
