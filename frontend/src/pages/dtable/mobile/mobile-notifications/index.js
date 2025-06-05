import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Modal } from 'antd-mobile';
import { toaster, DTableEmptyTip } from 'dtable-ui-component';
import MobileNotificationList from './mobile-notification-list';
import Icon from '../../../../components/icon';
import DTableNotices from '../../../../components/common/notificatioin-center/dtable-notices';
import AppNotices from '../../../../components/common/notificatioin-center/app-notices';
import { dtableWebAPI } from '../../../../api/dtable-web-api';
import { Utils } from '../../../../utils/utils';
import { mediaUrl } from '../../../../utils/constants';
import { NOTIFICATION_TAB_TYPES_MAP } from '../../../../constants/notification-constants';

import './index.css';

const gettext = window.gettext;

class MobileNotifications extends Component {

  constructor(props) {
    super(props);
    this.state = {
      unseenCount: 0,
      notifications: [],
      notificationListPage: 1,
      notificationListPerPage: 25,
      canGetNotificationList: true,
      count: 0,
      currentTab: NOTIFICATION_TAB_TYPES_MAP.USER,
      dtableNotices: {},
      appNotices: {},
      userNotices: {},
    };
  }

  componentDidMount() {
    this.loadNotifications();
    this.loadNotificationsCenter();
  }

  loadNotifications = () => {
    let { notifications, canGetNotificationList, notificationListPage, notificationListPerPage } = this.state;
    let newNoticeList = notifications.slice(0);
    if (canGetNotificationList) {
      dtableWebAPI.listNotifications(notificationListPage, notificationListPerPage).then(res => {
        const { count, notification_list } = res.data;
        newNoticeList = [...notifications, ...notification_list];
        if (newNoticeList.length < count) {
          canGetNotificationList = true;
          notificationListPage = notificationListPage + 1;
        } else {
          canGetNotificationList = false;
        }
        this.setState({
          notifications: newNoticeList,
          notificationListPage,
          canGetNotificationList,
          count
        });
      }).catch(error => {
        let errorMsg = Utils.getErrorMsg(error);
        toaster.danger(errorMsg);
      });
    }
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
      const errorMsg = Utils.getErrorMsg(error);
      toaster.danger(errorMsg);
    });
  };

  onMarkAllNotifications = () => {
    const { currentTab, notifications, unseenCount, userNotices, dtableNotices, appNotices } = this.state;
    const noticeType = currentTab;
    dtableWebAPI.updateNotifications(noticeType).then(() => {
      if (noticeType === NOTIFICATION_TAB_TYPES_MAP.USER) {
        const newNotifications = notifications.map(item => ({ ...item, seen: true }));
        const newDetails = userNotices.details.map(item => ({ ...item, seen: true }));
        const newUserNotices = { ...userNotices, details: newDetails, unseen_count: 0 };
        const newUnseenCount = unseenCount - userNotices.unseen_count;
        this.setState({
          notifications: newNotifications,
          userNotices: newUserNotices,
          unseenCount: newUnseenCount,
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
    let { notifications } = this.state;
    notifications = notifications.map(item => {
      if (item.id === noticeItem.id) {
        item.seen = true;
      }
      return item;
    });
    dtableWebAPI.markNoticeAsRead(noticeItem.id).then(() => {
      let unseenCount = this.state.unseenCount === 0 ? 0 : this.state.unseenCount - 1;
      this.setState({
        notifications,
        unseenCount,
      });
    }).catch(error => {
      let errorMsg = Utils.getErrorMsg(error);
      toaster.danger(errorMsg);
    });
  };

  toggleNotificationModal = () => {
    this.setState({ isShowNotificationModal: !this.state.isShowNotificationModal });
  };

  tabItemClick = (tab) => {
    if (this.state.currentTab !== tab) {
      this.setState({ currentTab: tab });
    }
  };

  renderNotifications = () => {
    const { count, currentTab, dtableNotices, appNotices, notifications } = this.state;
    switch (currentTab) {
      case NOTIFICATION_TAB_TYPES_MAP.USER:
        return (
          <MobileNotificationList
            notifications={notifications}
            count={count}
            loadNotifications={this.loadNotifications}
            onNoticeItemClick={this.onNoticeItemClick}
            toggleNotificationModal={this.toggleNotificationModal}
            onOpenWorkflowTaskByNotification={this.props.onOpenWorkflowTaskByNotification}
          />
        );
      case NOTIFICATION_TAB_TYPES_MAP.BASE: {
        const { details } = dtableNotices;
        return details && details.length > 0 ? (
          <DTableNotices dtableNoticeDetails={details} />
        ) : (
          <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No notification')} />
        );
      }
      case NOTIFICATION_TAB_TYPES_MAP.APP: {
        const { details } = appNotices;
        return details && details.length > 0 ? (
          <AppNotices appNoticeDetails={details} />
        ) : (
          <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No notification')} />
        );
      }
      default:
        return null;
    }
  };

  render() {
    const { unseenCount, isShowNotificationModal, userNotices, dtableNotices, appNotices, currentTab } = this.state;
    const tabs = [
      { id: NOTIFICATION_TAB_TYPES_MAP.USER, title: gettext('General'), notices: userNotices },
      { id: NOTIFICATION_TAB_TYPES_MAP.BASE, title: gettext('Bases'), notices: dtableNotices },
      { id: NOTIFICATION_TAB_TYPES_MAP.APP, title: gettext('Apps'), notices: appNotices },
    ];

    return (
      <>
        <div
          className="mobile-notifications-icon-container search-icon-container position-relative"
          onClick={this.toggleNotificationModal}
        >
          <i className="search-icon dtable-font dtable-icon-notice"></i>
          {unseenCount > 0 && (
            <div className="unseen-notifications-count position-absolute">{unseenCount}</div>
          )}
        </div>
        <Modal
          popup
          visible={isShowNotificationModal}
          onClose={this.toggleNotificationModal}
          animationType="slide-up"
          className="mobile-notification-modal"
        >
          <div>
            <div className="mobile-notification-header">
              <span className="mobile-notification-title">{gettext('Notification')}</span>
              <i
                className="dtable-font dtable-icon-x mobile-notification-close"
                onClick={this.toggleNotificationModal}
              >
              </i>
            </div>
            <div className="mobile-notification-body">
              <div className="mobile-notification-tool d-flex justify-content-between align-items-center">
                <div className="notification-type-tabs d-flex">
                  {tabs.map(({ id, title, notices }) => (
                    <span
                      key={id}
                      className={`tab-item ${currentTab === id ? 'active' : ''}`}
                      onClick={() => this.tabItemClick(id)}
                    >
                      {title}
                      {notices.unseen_count > 0 && (`(${notices.unseen_count})`)}
                    </span>
                  ))}
                </div>
                <div
                  className="mobile-mark-notifications"
                  onClick={this.onMarkAllNotifications}
                >
                  <Icon symbol='set-as-read' />
                </div>
              </div>
              <div className="mobile-notification-content">
                {this.renderNotifications()}
              </div>
            </div>
          </div>
        </Modal>
      </>
    );
  }
}

MobileNotifications.propTypes = {
  onOpenWorkflowTaskByNotification: PropTypes.func,
};

export default MobileNotifications;
