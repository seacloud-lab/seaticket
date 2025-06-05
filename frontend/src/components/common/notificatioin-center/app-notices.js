import React from 'react';
import PropTypes from 'prop-types';
import getAppIconUrl from '../../../pages/dtable/universal-apps/utils/get-app-icon';

import '../../../css/notices.css';

class AppNotices extends React.Component {

  render() {
    const { appNoticeDetails } = this.props;
    return (
      <div className="notification-apps">
        {appNoticeDetails.map((item, index) => {
          const { app_link, app_name, app_icon, use_custom_icon, icon_class_name, unseen_count } = item;
          if (unseen_count === 0) return null;
          return (
            <div className="notification-app-item d-flex align-items-center justify-content-between" key={index}>
              <div className="d-flex align-items-center">
                <div className="app-item-icon d-flex align-items-center justify-content-center">
                  <img className="app-custom-icon" src={getAppIconUrl(icon_class_name, use_custom_icon, app_icon)} alt=""/>
                </div>
                <span className="app-name text-truncate">
                  <a href={app_link} target="_blank" rel="noopener noreferrer">{app_name}</a>
                </span>
              </div>
              <span className="unseen">{unseen_count}</span>
            </div>
          );
        })}
      </div>
    );
  }
}

AppNotices.propTypes = {
  appNoticeDetails: PropTypes.array,
};

export default AppNotices;
