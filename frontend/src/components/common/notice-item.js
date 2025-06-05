import React from 'react';
import PropTypes from 'prop-types';
import dayjs from '../../utils/dayjs';
import { gettext } from '../../utils/constants';
import { NOTIFICATION_TYPE_ARRAY } from '../../constants/notification-constants';
import { getNoticeItemAvatarUrl, getNoticeItemUserName } from '../../utils/utils';
import NoticeItemDetail from './notice-item-detail';

const propTypes = {
  noticeItem: PropTypes.object.isRequired,
  onNoticeItemClick: PropTypes.func.isRequired,
  onOpenWorkflowTaskByNotification: PropTypes.func,
};

class NoticeItem extends React.Component {

  onNoticeItemClick = () => {
    let item = this.props.noticeItem;
    if (item.seen === true) {
      return;
    }
    this.props.onNoticeItemClick(item);
  };

  render() {
    const { noticeItem, onOpenWorkflowTaskByNotification } = this.props;
    if (NOTIFICATION_TYPE_ARRAY.indexOf(noticeItem.type) === -1) {
      return null;
    }
    return (
      <div className="notification-item" onClick={this.onNoticeItemClick}>
        <div className="notification-item-header">
          {!noticeItem.seen &&
            <span className="notification-point" onClick={this.onMarkNotificationRead}></span>
          }
          <div className="notification-header-info">
            <div className="notification-user-detail">
              <img className="notification-user-avatar" src={getNoticeItemAvatarUrl(noticeItem)} alt="" />
              <span className="ml-2 notification-user-name">{getNoticeItemUserName(noticeItem) || gettext('System')}</span>
            </div>
            <span className="notification-time">{dayjs(noticeItem.time).fromNow()}</span>
          </div>
        </div>
        <div className="notification-content-wrapper">
          <NoticeItemDetail
            noticeItem={noticeItem}
            onOpenWorkflowTaskByNotification={onOpenWorkflowTaskByNotification}
          />
        </div>
      </div>
    );
  }
}

NoticeItem.propTypes = propTypes;

export default NoticeItem;
