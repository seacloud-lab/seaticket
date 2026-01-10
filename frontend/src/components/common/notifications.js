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
    if (this.state.showNotice) {
      this.setState({ showNotice: false });
    } else {
      this.setState({ showNotice: true });
    }
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
    if (this.state.currentTab === 'project') {
      let noticeList = this.state.projectNoticeList.map(item => {
        if (item.id === noticeItem.id) {
          item.seen = true;
        }
        return item;
      });
      let totalUnseenCount = this.state.totalUnseenCount === 0 ? 0 : this.state.totalUnseenCount - 1;
      let projectNoticeListUnseen = this.state.projectNoticeListUnseen === 0 ? 0 : this.state.projectNoticeListUnseen - 1;
      this.setState({
        projectNoticeList: noticeList,
        totalUnseenCount: totalUnseenCount,
        projectNoticeListUnseen: projectNoticeListUnseen
      });
      notificationAPI.markProjectNoticeAsRead(noticeItem.id);
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
    let generalNoticeListUnseen = this.state.generalNoticeListUnseen;
    let projectNoticeListUnseen = this.state.projectNoticeListUnseen;
    if (this.state.currentTab === 'general') {
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
    } else if (this.state.currentTab === 'project') {
      if (!this.state.activeProject) {
        const unreadProjects = (this.state.projectList || []).filter(item => item.unseen_count > 0);
        if (unreadProjects.length === 0) return;
        Promise.all(unreadProjects.map(item => notificationAPI.markAllProjectRead(item.project_uuid))).then(() => {
          this.setState({
            projectList: [],
            projectNoticeList: [],
            projectNoticeListUnseen: 0,
            totalUnseenCount: generalNoticeListUnseen
          });
        });
        return;
      }
      notificationAPI.markAllProjectRead(this.state.activeProject.project_uuid).then(() => {
        this.setState({
          projectNoticeList: this.state.projectNoticeList.map(item => {
            item.seen = true;
            return item;
          }),
          projectNoticeListUnseen: 0,
          totalUnseenCount: generalNoticeListUnseen
        });
      });
    }
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

  updateTotalUnseenCount = (noticeType) => {
    if (noticeType === 'general') {
      this.setState({
        generalNoticeListUnseen: 0,
        totalUnseenCount: this.state.projectNoticeListUnseen
      });
    } else if (noticeType === 'project') {
      this.setState({
        projectNoticeListUnseen: 0,
        totalUnseenCount: this.state.generalNoticeListUnseen
      });
    }
  };

  render() {
    const { totalUnseenCount, currentTab, generalNoticeList, projectList, projectNoticeList, activeProject, generalNoticeListUnseen, projectNoticeListUnseen } = this.state;
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
            {currentTab === 'project' &&
              <ul className="notice-list list-unstyled" id="notice-popover">
                {!activeProject && (projectList || []).filter(item => item.unseen_count > 0).map(item => {
                  return (
                    <li
                      key={item.project_uuid}
                      className='notification-item'
                      onClick={() => this.onProjectClick(item)}
                      tabIndex={0}
                      role="button"
                      aria-label={gettext('View project notifications')}
                      onKeyDown={Utils.onKeyDown}
                    >
                      <div className="notification-project-item">
                        <div className="project-item-icon">
                          <i className={`project-icon project-icon-style ${item.project_icon || 'icon-worksheet'}`} style={{ color: item.project_color || DEFAULT_COLOR }}></i>
                        </div>
                        <div className="notification-project-name" title={item.project_name}>{item.project_name}</div>
                        {item.unseen_count > 0 && (
                          <div className="notification-project-unseen">{item.unseen_count < 100 ? item.unseen_count : '99+'}</div>
                        )}
                      </div>
                    </li>
                  );
                })}
                {activeProject && (
                  <>
                    <li
                      className='notification-item'
                      onClick={this.onBackToProjectList}
                      tabIndex={0}
                      role="button"
                      aria-label={gettext('Back')}
                      onKeyDown={Utils.onKeyDown}
                    >
                      <div className="notification-content-wrapper">
                        <span>{gettext('Back')}</span>
                      </div>
                    </li>
                    {projectNoticeList.map(item => {
                      return (
                        <NoticeItem key={item.id} noticeItem={item} onNoticeItemClick={this.onNoticeItemClick}/>
                      );
                    })}
                  </>
                )}
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
