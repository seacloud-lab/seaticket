import React from 'react';
import PropTypes from 'prop-types';
import { DTableEmptyTip } from 'dtable-ui-component';
import { gettext, mediaUrl } from '../../../../utils/constants';
import MobileNotificationItem from './mobile-notification-item';

class MobileNotificationList extends React.Component {

  onNoticeItemClick = (noticeItem) => {
    this.props.onNoticeItemClick(noticeItem);
  };

  onHandleScroll = () => {
    if (this.notificationListRef.offsetHeight + this.notificationListRef.scrollTop + 1 >= this.notificationsWrapperRef.offsetHeight) {
      this.props.loadNotifications();
    }
  };

  render() {
    const { notifications, toggleNotificationModal, onOpenWorkflowTaskByNotification } = this.props;
    if (!Array.isArray(notifications) || notifications.length === 0) {
      return (
        <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No notification')} />
      );
    }

    return (
      <div
        className="mobile-notification-list"
        onScroll={this.onHandleScroll}
        ref={ref => this.notificationListRef = ref}
      >
        <div ref={ref => this.notificationsWrapperRef = ref}>
          {notifications.map((notification) => {
            return (
              <MobileNotificationItem
                key={notification.id}
                notification={notification}
                onNoticeItemClick={this.onNoticeItemClick}
                toggleNotificationModal={toggleNotificationModal}
                onOpenWorkflowTaskByNotification={onOpenWorkflowTaskByNotification}
              />
            );
          })}
        </div>
      </div>
    );
  }
}

MobileNotificationList.propTypes = {
  notifications: PropTypes.array,
  count: PropTypes.number,
  toggleNotificationModal: PropTypes.func.isRequired,
  onOpenWorkflowTaskByNotification: PropTypes.func,
  loadNotifications: PropTypes.func.isRequired,
  onNoticeItemClick: PropTypes.func.isRequired,
};

export default MobileNotificationList;
