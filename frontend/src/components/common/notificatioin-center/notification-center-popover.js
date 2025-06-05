import React from 'react';
import PropTypes from 'prop-types';
import { Popover } from 'reactstrap';
import IconButton from 'dtable-ui-component/lib/IconButton';
import { gettext } from '../../../utils/constants';
import NoticeItem from '../notice-item';
import DTableNotices from './dtable-notices';
import AppNotices from './app-notices';
import { NOTIFICATION_TAB_TYPES_MAP } from '../../../constants/notification-constants';

import '../../../css/notification-center.css';

const USER_NOTICE_MAX_NUMBER = 25;

class NotificationCenterPopover extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      currentTab: NOTIFICATION_TAB_TYPES_MAP.USER,
    };
  }

  componentDidMount() {
    document.addEventListener('mousedown', this.handleOutsideClick);
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleOutsideClick);
  }

  handleOutsideClick = (e) => {
    if (!this.notificationContainerRef.contains(e.target)) {
      document.removeEventListener('mousedown', this.handleOutsideClick);
      if (e.target.className === 'tool notification' || e.target.parentNode.className === 'tool notification') {
        return;
      }
      this.props.onNotificationListToggle();
    }
  };

  onNotificationDialogToggle = () => {
    this.props.onNotificationDialogToggle();
    this.props.onNotificationListToggle();
  };

  onMarkAllNotifications = () => {
    const { currentTab } = this.state;
    this.props.onMarkAllNotifications(currentTab);
  };

  tabItemClick = (tab) => {
    const { currentTab } = this.state;
    if (currentTab === tab) return;
    this.setState({ currentTab: tab });
  };

  renderEmptyTip = () => {
    return (
      <div className="notification-empty">{gettext('No notifications')}</div>
    );
  };

  renderUserNotices = () => {
    const { userNotices } = this.props;
    if (!userNotices.details || userNotices.details.length === 0) {
      return this.renderEmptyTip();
    }
    return userNotices.details.map(item => {
      return (
        <NoticeItem
          key={item.id}
          noticeItem={item}
          onNoticeItemClick={this.props.onNoticeItemClick}
          onOpenWorkflowTaskByNotification={this.props.onOpenWorkflowTaskByNotification}
        />
      );
    });
  };

  renderDTableNotices = () => {
    const { dtableNotices } = this.props;
    if (!dtableNotices.details || dtableNotices.details.length === 0) {
      return this.renderEmptyTip();
    }
    return (
      <DTableNotices
        dtableNoticeDetails={dtableNotices.details}
      />
    );
  };

  renderAppNotices = () => {
    const { appNotices } = this.props;
    if (!appNotices.details || appNotices.details.length === 0) {
      return this.renderEmptyTip();
    }
    return (
      <AppNotices
        appNoticeDetails={appNotices.details}
      />
    );
  };

  render() {
    const { userNotices, appNotices, dtableNotices } = this.props;
    const { currentTab } = this.state;
    return (
      <Popover
        className="notification-wrapper"
        target="notification-popover"
        isOpen={true}
        fade={false}
        hideArrow={true}
        placement="bottom"
      >
        <div className="notification-container notification-center" ref={ref => this.notificationContainerRef = ref}>
          <div className="notification-header">
            {gettext('Notification')}
            <div className='notification-close-icon'>
              <IconButton icon="x" onClick={this.props.onNotificationListToggle} />
            </div>
          </div>
          <div className="notification-body">
            <div className="mark-notifications">
              <ul className="nav dtable-external-links-tab">
                <li className="nav-item" onClick={() => this.tabItemClick(NOTIFICATION_TAB_TYPES_MAP.USER)}>
                  <span className={`nav-link ${currentTab === NOTIFICATION_TAB_TYPES_MAP.USER ? 'active' : ''}`}>
                    {gettext('General')}
                    {userNotices.unseen_count > 0 && userNotices.unseen_count <= USER_NOTICE_MAX_NUMBER && ('(' + userNotices.unseen_count + ')')}
                    {userNotices.unseen_count > USER_NOTICE_MAX_NUMBER && '(25+)'}
                  </span>
                </li>
                <li className="nav-item" onClick={() => this.tabItemClick(NOTIFICATION_TAB_TYPES_MAP.BASE)}>
                  <span className={`nav-link ${currentTab === NOTIFICATION_TAB_TYPES_MAP.BASE ? 'active' : ''}`}>
                    {gettext('Bases')}
                    {dtableNotices.unseen_count > 0 && ('(' + dtableNotices.unseen_count + ')')}
                  </span>
                </li>
                <li className="nav-item" onClick={() => this.tabItemClick(NOTIFICATION_TAB_TYPES_MAP.APP)}>
                  <span className={`nav-link ${currentTab === NOTIFICATION_TAB_TYPES_MAP.APP ? 'active' : ''}`}>
                    {gettext('Apps')}
                    {appNotices.unseen_count > 0 && ('(' + appNotices.unseen_count + ')')}
                  </span>
                </li>
              </ul>
              <span className="mark-all-read" onClick={this.onMarkAllNotifications}>
                {gettext('Mark all as read')}
              </span>
            </div>
            <div className={`notification-list-container ${currentTab !== NOTIFICATION_TAB_TYPES_MAP.USER && 'no-footer'}`}>
              {currentTab === NOTIFICATION_TAB_TYPES_MAP.USER && this.renderUserNotices()}
              {currentTab === NOTIFICATION_TAB_TYPES_MAP.BASE && this.renderDTableNotices()}
              {currentTab === NOTIFICATION_TAB_TYPES_MAP.APP && this.renderAppNotices()}
            </div>
            {currentTab === NOTIFICATION_TAB_TYPES_MAP.USER && userNotices.details && userNotices.details.length !== 0 &&
              <div className="notification-footer" onClick={this.onNotificationDialogToggle}>{gettext('View all notifications')}</div>
            }
          </div>
        </div>
      </Popover>
    );
  }
}

NotificationCenterPopover.propTypes = {
  enableWeixin: PropTypes.bool,
  userNotices: PropTypes.object,
  dtableNotices: PropTypes.object,
  appNotices: PropTypes.object,
  onNotificationListToggle: PropTypes.func,
  onNotificationDialogToggle: PropTypes.func,
  onOpenWorkflowTaskByNotification: PropTypes.func,
  onNoticeItemClick: PropTypes.func,
  onMarkAllNotifications: PropTypes.func,
};

export default NotificationCenterPopover;
