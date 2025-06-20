import React from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../utils/constants';
import { seaQAAPI } from '../api/web-api';
import '../css/system-notification.css';

const propTypes = {
  notificationID: PropTypes.string.isRequired,
  msg: PropTypes.string.isRequired,
};

class SystemUserNotificationItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isClosed: false
    };
  }

  close = () => {
    this.setState({ isClosed: true });
    seaQAAPI.setSysUserNotificationToSeen(this.props.notificationID);
  };

  render() {
    if (this.state.isClosed) {
      return null;
    }
    return (
      <div className="info-bar m-4" aria-label={gettext('System user information')}>
        <div className="info-bar-info m-0">
          <span className="dtable-font dtable-icon-system-message mr-3" aria-hidden="true"></span>
          <div dangerouslySetInnerHTML={{ __html: this.props.msg }}></div>
        </div>
        <span className="close" title={gettext('Close')} aria-label={gettext('Close')} onClick={this.close}>×</span>
      </div>
    );
  }
}

SystemUserNotificationItem.propTypes = propTypes;

export default SystemUserNotificationItem;
