import React, { Component } from 'react';
import UserGuideList from './user-guide/user-guide-list';
import { GUIDE_LIST } from './user-guide/constants';

import '../../css/main-panel-user-guide.css';

class UserGuide extends Component {
  render() {
    return (
      <div className="main-panel-center flex-row">
        <div className="cur-view-container">
          <div className="cur-view-content">
            <div className="main-panel-app-header d-flex align-items-center">
              <div className="main-panel-app-title">
                <span>新手引导</span>
              </div>
            </div>
            <div className="main-panel-user-guides">
              <UserGuideList guideList={GUIDE_LIST}/>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default UserGuide;
