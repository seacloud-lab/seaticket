import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import { isEnter, isEsc } from '../../utils/hotkey';
import { dtableWebAPI } from '../../api/dtable-web-api';
import { gettext } from '../../utils/constants';
import NotificationDialog from '../dialog/notification-dialog';
import { isFunction, Utils } from '../../utils/utils';
import NotificationCenterPopover from './notificatioin-center/notification-center-popover';
import { NOTIFICATION_TAB_TYPES_MAP } from '../../constants/notification-constants';

import '../../css/main-panel-notifications.css';

class Notification extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      showNotice: false,
      unseenCount: 0,
      noticeList: [],
      isShowNotificationDialog: this.getInitDialogState(),
      notificationListPage: 1,
      notificationListPerPage: 25,
      canGetNotificationList: true,
      dtableNotices: {},
      appNotices: {},
      userNotices: {},
    };
  }

  componentDidMount() {
    this.loadNotices();
    this.loadNotificationsCenter();
    document.addEventListener('keydown', this.onDocumentKeydown);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onDocumentKeydown);
  }

  onDocumentKeydown = (e) => {
    if (isEnter(e)) {
      if (document.activeElement && document.activeElement.id === 'notification-popover') {
        this.initNotificationList();
        this.setState({ showNotice: true });
      }
    } else if (isEsc(e)) {
      this.setState({ showNotice: false });
    }
  };

  toggleNotice = (e) => {
    if (e) e.stopPropagation();
    if (this.state.showNotice) {
      this.setState({
        showNotice: false,
      });
    } else {
      this.initNotificationList();
      this.setState({ showNotice: true });
    }
  };

  initNotificationList = () => {
    const { notificationListPage } = this.state;
    if (notificationListPage === 1) return;
    const options = {
      canGetNotificationList: true,
      notificationListPage: 1,
      notificationListPerPage: 25,
      noticeList: []
    };
    this.loadNotices(options);
  };

  loadNotificationsCenter = () => {
    dtableWebAPI.listNotificationsCenter().then(res => {
      const { unseen_count, user_notifications, dtable_notifications, app_notifications } = res.data;
      this.setState({
        unseenCount: unseen_count,
        dtableNotices: dtable_notifications,
        appNotices: app_notifications,
        userNotices: user_notifications,
      });
    }).catch(error => {
      let errorMsg = Utils.getErrorMsg(error);
      toaster.danger(errorMsg);
    });
  };

  loadNotices = (options) => {
    let { noticeList, canGetNotificationList, notificationListPage, notificationListPerPage } = this.state;
    if (options) {
      ({ noticeList, canGetNotificationList, notificationListPage, notificationListPerPage } = options);
    }
    let newNoticeList = noticeList.slice(0);
    if (canGetNotificationList) {
      dtableWebAPI.listNotifications(notificationListPage, notificationListPerPage).then(res => {
        const { count, notification_list } = res.data;
        newNoticeList = [...noticeList, ...notification_list];
        if (newNoticeList.length < count) {
          canGetNotificationList = true;
          notificationListPage = notificationListPage + 1;
        } else {
          canGetNotificationList = false;
        }
        this.setState({
          noticeList: newNoticeList,
          notificationListPage,
          canGetNotificationList
        });
      }).catch(error => {
        let errorMsg = Utils.getErrorMsg(error);
        toaster.danger(errorMsg);
      });
    }
  };

  onDeleteAllNotifications = () => {
    const { unseenCount, userNotices } = this.state;
    dtableWebAPI.deleteNotifications().then(res => {
      const { unseen_count: userNoticesUnseenCount } = userNotices;
      let newUnseenCount = unseenCount - userNoticesUnseenCount;
      this.setState({
        noticeList: [],
        userNotices: { details: [], total_count: 0, unseen_count: 0 },
        unseenCount: newUnseenCount,
        notificationListPage: 1,
        notificationListPerPage: 25,
      });
    }).catch(error => {
      let errorMsg = Utils.getErrorMsg(error);
      toaster.danger(errorMsg);
    });
  };

  onMarkAllNotifications = (noticeType) => {
    dtableWebAPI.updateNotifications(noticeType).then((res) => {
      const { unseenCount, noticeList, userNotices, appNotices, dtableNotices } = this.state;
      if (noticeType === NOTIFICATION_TAB_TYPES_MAP.USER) {
        const { unseen_count: userNoticesUnseenCount, details } = userNotices;
        let newDetails = details.slice(0);
        newDetails.forEach(noticeItem => {
          noticeItem.seen = true;
        });
        let newNoticeList = noticeList.slice(0);
        newNoticeList.forEach(noticeItem => {
          noticeItem.seen = true;
        });
        const newUnseenCount = unseenCount - userNoticesUnseenCount;
        const newUserNotices = { ...userNotices, details: newDetails, unseen_count: 0 };
        this.setState({
          unseenCount: newUnseenCount,
          noticeList: newNoticeList,
          userNotices: newUserNotices,
        });
      } else if (noticeType === NOTIFICATION_TAB_TYPES_MAP.BASE) {
        const { unseen_count: baseNoticesUnseenCount } = dtableNotices;
        const newUnseenCount = unseenCount - baseNoticesUnseenCount;
        this.setState({ unseenCount: newUnseenCount, dtableNotices: {} });
      } else {
        const { unseen_count: appNoticesUnseenCount } = appNotices;
        const newUnseenCount = unseenCount - appNoticesUnseenCount;
        this.setState({ unseenCount: newUnseenCount, appNotices: {} });
      }
    }).catch(error => {
      let errorMsg = Utils.getErrorMsg(error);
      toaster.danger(errorMsg);
    });
  };

  onNoticeItemClick = (noticeItem) => {
    if (!noticeItem || noticeItem.seen) return;
    const { userNotices, noticeList, unseenCount } = this.state;
    const { unseen_count: userNoticesUnseenCount, details } = userNotices;
    const newDetails = details.map(item => {
      if (item.id === noticeItem.id) {
        item.seen = true;
      }
      return item;
    });
    const newNoticeList = noticeList.map(item => {
      if (item.id === noticeItem.id) {
        item.seen = true;
      }
      return item;
    });
    dtableWebAPI.markNoticeAsRead(noticeItem.id).then(res => {
      const newUnseenCount = unseenCount === 0 ? 0 : this.state.unseenCount - 1;
      const newUserNoticesUnseenCount = userNoticesUnseenCount === 0 ? 0 : userNoticesUnseenCount - 1;
      const newUserNotices = { ...userNotices, unseen_count: newUserNoticesUnseenCount, details: newDetails };
      this.setState({
        unseenCount: newUnseenCount,
        noticeList: newNoticeList,
        userNotices: newUserNotices,
      });
    }).catch(error => {
      let errorMsg = Utils.getErrorMsg(error);
      toaster.danger(errorMsg);
    });
  };

  getInitDialogState = () => {
    const searchParams = Utils.getUrlSearches();
    return searchParams.notifications === 'all';
  };

  onNotificationDialogToggle = () => {
    let newSearch = this.state.isShowNotificationDialog ? null : 'all';
    Utils.updateSearchParameter('notifications', newSearch);
    this.setState({ isShowNotificationDialog: !this.state.isShowNotificationDialog });
  };

  onOpenWorkflowTaskByNotification = (notification) => {
    const { onOpenWorkflowTaskByNotification } = this.props;
    if (!isFunction(onOpenWorkflowTaskByNotification)) return;
    this.setState({ isShowNotificationDialog: false, showNotice: false }, () => {
      onOpenWorkflowTaskByNotification(notification);
    });
  };

  render() {
    const { isShowNotificationDialog, noticeList, showNotice, unseenCount, dtableNotices, appNotices, userNotices } = this.state;
    return (
      <Fragment>
        <div id="notifications">
          <span
            onMouseDown={this.toggleNotice}
            className="no-deco a-simulate"
            id="notification-popover"
            title={gettext('Notifications')}
            aria-label={gettext('Notifications')}
            role="button"
            tabIndex={0}
          >
            <span className="dtable-font dtable-icon-notice" aria-hidden="true"></span>
            <span className={`num ${unseenCount ? '' : 'hide'}`} aria-label={gettext('Notification count') + ' ' + unseenCount}>
              {unseenCount}
            </span>
          </span>
          {showNotice && (
            <NotificationCenterPopover
              onNotificationListToggle={this.toggleNotice}
              onNotificationDialogToggle={this.onNotificationDialogToggle}
              dtableNotices={dtableNotices}
              appNotices={appNotices}
              userNotices={userNotices}
              onMarkAllNotifications={this.onMarkAllNotifications}
              onOpenWorkflowTaskByNotification={this.onOpenWorkflowTaskByNotification}
              onNoticeItemClick={this.onNoticeItemClick}
            />
          )}
        </div>
        {isShowNotificationDialog &&
          <NotificationDialog
            onNotificationDialogToggle={this.onNotificationDialogToggle}
            noticeList={noticeList}
            onMarkAllNotifications={this.onMarkAllNotifications}
            loadNotices={this.loadNotices}
            onOpenWorkflowTaskByNotification={this.onOpenWorkflowTaskByNotification}
            onDeleteAllNotifications={this.onDeleteAllNotifications}
            onNoticeItemClick={this.onNoticeItemClick}
          />
        }
      </Fragment>
    );
  }
}

Notification.propTypes = {
  onOpenWorkflowTaskByNotification: PropTypes.func,
};

export default Notification;
