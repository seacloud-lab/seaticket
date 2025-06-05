import React from 'react';
import PropTypes from 'prop-types';
import dayjs from '../../../../utils/dayjs';
import { NOTIFICATION_TYPE_ARRAY } from '../../../../constants/notification-constants';
import { getNoticeItemAvatarUrl, getNoticeItemUserName, isFunction } from '../../../../utils/utils';
import NoticeItemDetail from '../../../../components/common/notice-item-detail';

const gettext = window.gettext;

class MobileNotificationItem extends React.Component {

  onOpenWorkflowTaskByNotification = () => {
    const { notification, onOpenWorkflowTaskByNotification, toggleNotificationModal } = this.props;
    if (!isFunction(onOpenWorkflowTaskByNotification)) return;
    toggleNotificationModal();
    onOpenWorkflowTaskByNotification(notification);
  };

  onNoticeItemClick = () => {
    const { notification } = this.props;
    if (notification.seen === true) return;
    this.props.onNoticeItemClick(notification);
  };

  render() {
    const notification = this.props.notification;
    if (NOTIFICATION_TYPE_ARRAY.indexOf(notification.type) === -1) return null;
    const avatar_url = getNoticeItemAvatarUrl(notification);
    const name = getNoticeItemUserName(notification) || gettext('System');
    return (
      <div className="mobile-notification-item position-relative" onClick={this.onNoticeItemClick}>
        <div className="mobile-notification-item-header d-flex align-items-center">
          {!notification.seen && <span className="mobile-notification-point position-absolute"></span>}
          <div className="mobile-notification-item-header-content d-flex">
            <div className="mobile-notification-item-user-detail d-flex align-items-center">
              <img src={avatar_url} className="mobile-notification-user-avatar" alt=""/>
              <span className="ml-2 mobile-notification-item-name text-truncate">{name}</span>
            </div>
            <span className="mobile-notification-item-time text-truncate d-flex align-items-center">
              {dayjs(notification.time).fromNow()}
            </span>
          </div>
        </div>
        <div className="mobile-notification-item-content">
          <NoticeItemDetail
            noticeItem={notification}
            onOpenWorkflowTaskByNotification={this.onOpenWorkflowTaskByNotification}
          />
        </div>
      </div>
    );
  }
}

MobileNotificationItem.propTypes = {
  notification: PropTypes.object.isRequired,
  onNoticeItemClick: PropTypes.func.isRequired,
  toggleNotificationModal: PropTypes.func.isRequired,
  onOpenWorkflowTaskByNotification: PropTypes.func,
};

export default MobileNotificationItem;
