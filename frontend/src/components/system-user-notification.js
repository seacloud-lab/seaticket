import React from 'react';
import '../css/system-notification.css';
import SystemUserNotificationItem from './system-user-notification-item';
import { dtableWebAPI } from '../api/dtable-web-api';

class SystemUserNotification extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      userNoteMsgs: []
    };
  }

  componentDidMount() {
    dtableWebAPI.listSysUserUnseenNotifications().then((res) => {
      this.setState({
        userNoteMsgs: res.data.notifications
      });
    });
  }

  render() {
    let { userNoteMsgs } = this.state;
    if (!userNoteMsgs) {
      return null;
    }
    const userNoteMsgItem = userNoteMsgs.map((item, index) => {
      return (
        <SystemUserNotificationItem
          key={index}
          notificationItem={item}
          msg={item.msg_format}
          notificationID={item.id}
        />
      );
    });
    return userNoteMsgItem;
  }
}

export default SystemUserNotification;
