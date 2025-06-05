import React, { Component } from 'react';
import UserGuideList from './user-guide/user-guide-list';
import { GUIDE_LIST } from './user-guide/constants';

import '../../css/main-panel-user-guide.css';

export default class DtablesUserGuide extends Component {

  constructor(props) {
    super(props);
    let isShowUserGuide = !(localStorage.getItem('dtables_hide_user_guide') === 'true');
    this.state = {
      isShowUserGuide,
    };
  }

  closeUserGuide = () => {
    this.setState({ isShowUserGuide: false });
    window.localStorage.setItem('dtables_hide_user_guide', 'true');
  };

  render() {
    if (!this.state.isShowUserGuide) return null;
    return (
      <div className="dtables-user-guide main-panel-center flex-row">
        <div className="cur-view-container">
          <div className="cur-view-content">
            <div className="main-panel-app-header d-flex align-items-center">
              <div className="main-panel-app-title">
                <span>新手引导</span>
              </div>
              <span className="dtable-font dtable-icon-x" onClick={this.closeUserGuide}></span>
            </div>
            <div className="main-panel-user-guides">
              <UserGuideList guideList={GUIDE_LIST.slice(0, 3)}/>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
