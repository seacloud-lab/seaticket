import React from 'react';
import NotificationPopover from './notification-popover';
import { gettext, siteRoot } from '@constants/config';
import { DEFAULT_COLOR } from '@/constants/project-icon';
import NoticeItem from './notice-item';
import UserNotificationsDialog from '../../user-notifications';
import { Utils } from '../../utils/utils';
import IconBtn from '../icon-button';
import { notificationAPI } from '../../project/api';

import '../../css/notification.css';

class Notification extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showNotice: false,
      totalUnseenCount: 0,
      generalNoticeList: [],
      projectList: [],
      projectNoticeList: [],
      activeProject: null,
      currentTab: 'general',
      isShowNotificationDialog: this.getInitDialogState(),
    };
  }

  getTriggerId = () => {
    return (this.props && this.props.triggerId) ? this.props.triggerId : 'notice-icon';
  };

  getTargetId = () => {
    return (this.props && this.props.targetId) ? this.props.targetId : 'notification-popover';
  };

  componentDidMount() {
    notificationAPI.listAllNotifications(1, 25).then(res => {
      this.setState({
        totalUnseenCount: res.data.total_unseen_count,
        generalNoticeList: res.data.general.notification_list || [],
        generalNoticeListUnseen: res.data.general.unseen_count,
        projectNoticeListUnseen: res.data.project.unseen_count,
        projectList: res.data.project.project_list || [],
      });
    });
  }

  onClick = (e) => {
    e.preventDefault();
    this.setState({ showNotice: !this.state.showNotice });
  };

  loadProjectNotices = (projectUuid) => {
    notificationAPI.listProjectNotifications(projectUuid, 1, 20).then(res => {
      const notificationList = res.data.notification_list || [];
      const unseenCount = res.data.unseen_count || 0;
      const count = res.data.count || 0;
      this.setState({
        projectNoticeList: notificationList,
        projectNoticeListUnseen: unseenCount,
        totalUnseenCount: unseenCount,
        generalNoticeListUnseen: 0,
        projectList: count ? [{ project_uuid: projectUuid, unseen_count: unseenCount, count: count }] : [],
      });
    });
  };

  tabItemClick = (tab) => {
    const { currentTab } = this.state;
    if (currentTab === tab) return;
    this.setState({
      showNotice: true,
      currentTab: tab
    });
  };

  loadNotices = () => {
    let page = 1;
    let perPage = 25;
    notificationAPI.listAllNotifications(page, perPage).then(res => {
      let generalNoticeList = res.data.general.notification_list;
      let generalNoticeListUnseen = res.data.general.unseen_count;
      let projectNoticeListUnseen = res.data.project.unseen_count;
      let projectList = res.data.project.project_list || [];
      this.setState({
        generalNoticeList: generalNoticeList,
        generalNoticeListUnseen: generalNoticeListUnseen,
        projectNoticeListUnseen: projectNoticeListUnseen,
        projectList: projectList,
        activeProject: null,
        projectNoticeList: [],
        totalUnseenCount: res.data.total_unseen_count
      });
    });
  };

  onNoticeItemClick = (noticeItem) => {
    if (this.state.currentTab === 'general') {
      let noticeList = this.state.generalNoticeList.map(item => {
        if (item.id === noticeItem.id) {
          item.seen = true;
        }
        return item;
      });
      let totalUnseenCount = this.state.totalUnseenCount === 0 ? 0 : this.state.totalUnseenCount - 1;
      let generalNoticeListUnseen = this.state.generalNoticeListUnseen === 0 ? 0 : this.state.generalNoticeListUnseen - 1;
      this.setState({
        generalNoticeList: noticeList,
        totalUnseenCount: totalUnseenCount,
        generalNoticeListUnseen: generalNoticeListUnseen
      });
      notificationAPI.markNoticeAsRead(noticeItem.id);
    }
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

  onNotificationListToggle = () => {
    this.setState({ showNotice: false });
  };

  onMarkAllNotifications = () => {
    let projectNoticeListUnseen = this.state.projectNoticeListUnseen;
    notificationAPI.markAllRead().then(() => {
      this.setState({
        generalNoticeList: this.state.generalNoticeList.map(item => {
          item.seen = true;
          return item;
        }),
        generalNoticeListUnseen: 0,
        totalUnseenCount: projectNoticeListUnseen
      });
    });
  };

  onProjectClick = (project) => {
    const projectName = project.project_name || project.name || '';
    const projectHref = siteRoot + 'workspace/' + project.workspace_id + '/project/' + encodeURIComponent(projectName) + '/tickets/?view=open';
    this.setState({ showNotice: false }, () => {
      window.location.href = projectHref;
    });
  };

  onBackToProjectList = () => {
    this.setState({ activeProject: null, projectNoticeList: [] });
  };

  updateTotalUnseenCount = () => {
    this.setState({
      generalNoticeListUnseen: 0,
      totalUnseenCount: this.state.projectNoticeListUnseen
    });
  };

  render() {
    const { totalUnseenCount, currentTab, generalNoticeList, generalNoticeListUnseen, projectNoticeListUnseen } = this.state;
    const triggerId = this.getTriggerId();
    const targetId = this.getTargetId();
    return (
      <div id="notifications">
        <a href="#" onClick={this.onClick} className="no-deco" id={triggerId} title={gettext('Notifications')} aria-label={gettext('Notifications')}>
          <IconBtn id={targetId} icon="send" size={32} className="sf-icon-bell" />
          <span style={{ top: '0px' }} className='num'>{totalUnseenCount < 1000 ? totalUnseenCount : '999+'}</span>
        </a>
        {this.state.showNotice &&
          <NotificationPopover
            headerText={gettext('Notification')}
            bodyText={gettext('Mark all as read')}
            footerText={gettext('View all notifications')}
            currentTab={currentTab}
            triggerId={triggerId}
            targetId={targetId}
            onNotificationListToggle={this.onNotificationListToggle}
            onNotificationDialogToggle={this.onNotificationDialogToggle}
            onMarkAllNotifications={this.onMarkAllNotifications}
            tabItemClick={this.tabItemClick}
            generalNoticeListUnseen={generalNoticeListUnseen}
            projectNoticeListUnseen={projectNoticeListUnseen}
          >
            {currentTab === 'general' &&
              <ul className="notice-list list-unstyled" id="notice-popover">
                {generalNoticeList.map(item => {
                  return (
                    <NoticeItem key={item.id} noticeItem={item} onNoticeItemClick={this.onNoticeItemClick}/>
                  );
                })}
              </ul>
            }
          </NotificationPopover>
        }
        {this.state.isShowNotificationDialog &&
          <UserNotificationsDialog
            onNotificationDialogToggle={this.onNotificationDialogToggle}
            generalNoticeListUnseen={generalNoticeListUnseen}
            discussionNoticeListUnseen={projectNoticeListUnseen}
            updateTotalUnseenCount={this.updateTotalUnseenCount}
          />
        }
      </div>
    );
  }
}

export default Notification;
