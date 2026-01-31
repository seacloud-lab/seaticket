import React, { Component } from 'react';
import PropTypes from 'prop-types';
import toaster from '../toaster';
import { Utils } from '@/utils/utils';
import { isEnter, isEsc } from '@/utils/hotkey';
import { isWorkWeChat } from '@/utils/wechat-utils';
import userAPI from '@/api/user-api';
import { siteRoot, gettext, avatarURL, useExternalTeamAdmin } from '@/constants';
import IconBtn from '../icon-button';
import Icon from '../icon';

import './account.css';

const propTypes = {
  isAdminPanel: PropTypes.bool,
};

class Account extends Component {

  isWorkWX = isWorkWeChat(window.navigator.userAgent.toLowerCase());

  constructor(props) {
    super(props);
    this.state = {
      showInfo: false,
      userName: '',
      contactEmail: '',
      isStaff: false,
      isOrgStaff: false,
    };
    this.isFirstMounted = true;
  }

  componentDidMount() {
    document.addEventListener('keydown', this.onDocumentKeydown);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onDocumentKeydown);
  }

  componentDidUpdate() {
    if (this.state.showInfo) {
      this.addEvents();
    } else {
      this.removeEvents();
    }
  }

  onDocumentKeydown = (e) => {
    if (isEnter(e)) {
      if (document.activeElement && document.activeElement.id === 'my-info') {
        this.onClickAccount();
      }
    } else if (isEsc(e)) {
      this.setState({ showInfo: false });
    }
  };

  getContainer = () => {
    return this.containerRef;
  };

  addEvents = () => {
    ['click', 'touchstart', 'keyup'].forEach(event =>
      document.addEventListener(event, this.handleDocumentClick, true)
    );
  };

  removeEvents = () => {
    ['click', 'touchstart', 'keyup'].forEach(event =>
      document.removeEventListener(event, this.handleDocumentClick, true)
    );
  };

  handleDocumentClick = (e) => {
    if (e && (e.which === 3 || (e.type === 'keyup' && e.which !== Utils.keyCodes.tab))) return;
    const container = this.getContainer();

    if (container.contains(e.target) && container !== e.target && (e.type !== 'keyup' || e.which === Utils.keyCodes.tab)) {
      return;
    }

    this.setState({
      showInfo: !this.state.showInfo,
    });
  };

  onClickAccount = () => {
    if (this.isFirstMounted) {
      userAPI.getAccountInfo().then(resp => {
        this.setState({
          userName: resp.data.name,
          contactEmail: resp.data.email,
          isStaff: resp.data.is_staff,
          isInstAdmin: resp.data.is_inst_admin,
          isOrgStaff: resp.data.is_org_staff === 1 ? true : false,
          showInfo: !this.state.showInfo,
          bigDataTotalRows: resp.data.big_data_total_rows,
          bigDataRowLimit: resp.data.big_data_row_limit > 0 ? resp.data.big_data_row_limit : '--',
          bigDataRowUsageRate: resp.data.big_data_row_usage_rate,
          bigDataTotalStorage: Utils.bytesToSize(resp.data.big_data_total_storage),
          bigDataStorageQuota: Utils.bytesToSize(resp.data.big_data_storage_quota),
          bigDataStorageUsageRate: resp.data.big_data_storage_usage_rate,
          scriptsRunningCount: resp.data.scripts_running_count > 0 ? resp.data.scripts_running_count : '--',
          scriptsRunningTotal: resp.data.scripts_running_total > 0 ? resp.data.scripts_running_total : '--',
          scriptsRunningUsageRate: resp.data.scripts_running_usage_rate,
          apiCallsCount: resp.data.api_calls_count,
          apiCallsLimit: resp.data.api_calls_limit,
          apiCallsUsageRate: resp.data.api_calls_usage_rate,
          aiCredit: resp.data.ai_credit,
          aiCost: resp.data.ai_cost,
          aiUsageRate: resp.data.ai_usage_rate
        });
      }).catch(error => {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
      });
      this.isFirstMounted = false;
    } else {
      this.setState({
        showInfo: !this.state.showInfo,
      });
    }
  };

  setContainer = (ref) => {
    this.containerRef = ref;
  };

  renderMenu = () => {
    let data;
    const { isStaff, isOrgStaff, isInstAdmin } = this.state;
    const { isAdminPanel = false } = this.props;

    if (isAdminPanel) {
      if (isStaff) {
        data = {
          icon: 'exit-admin',
          url: siteRoot,
          text: gettext('Exit system admin')
        };
      } else if (isOrgStaff) {
        data = {
          icon: 'exit-admin',
          url: siteRoot,
          text: gettext('Exit team admin')
        };
      } else if (isInstAdmin) {
        data = {
          icon: 'exit-admin',
          url: siteRoot,
          text: gettext('Exit institution admin')
        };
      }
    } else {
      if (isStaff) {
        data = {
          icon: 'system-admin',
          url: `${siteRoot}sys/info/`,
          text: gettext('System admin')
        };
      } else if (isOrgStaff) {
        data = {
          icon: 'team-admin',
          url: useExternalTeamAdmin ? `${siteRoot}external-team-admin/` : `${siteRoot}org/manage/`,
          text: gettext('Team admin')
        };
      } else if (isInstAdmin) {
        data = {
          icon: 'institution-admin',
          url: `${siteRoot}inst/users/`,
          text: gettext('Institution admin')
        };
      }
    }
    if (!data) {
      return null;
    }
    return (
      <a href={data.url} title={data.text} className="item">
        <Icon symbol={data.icon} />
        {data.text}
      </a>
    );
  };

  render() {
    return (
      <div id="account" ref={this.setContainer}>
        <span
          id="my-info"
          onClick={this.onClickAccount}
          className="account-toggle no-deco d-none d-md-block"
          aria-label={gettext('View profile and more')}
          title={gettext('View profile and more')}
          tabIndex={0}
        >
          <span>
            <img src={avatarURL} width="36" height="36" className="avatar" alt={gettext('Avatar')} />
          </span>
        </span>
        <IconBtn
          icon="more-vertical"
          className="account-toggle mobile-icon d-md-none"
          aria-label={gettext('View profile and more')}
          title={gettext('View profile and more')}
          onClick={this.onClickAccount}
        />
        <div id="user-info-popup" className={`account-popup sf-popover ${this.state.showInfo ? '' : 'hide'}`}>
          <div className="sf-popover-con">
            <div className="item o-hidden">
              <img src={avatarURL} width="32" height="32" className="avatar" alt={gettext('Avatar')} />
              <div className="txt text-truncate">{this.state.userName}</div>
            </div>
            <div className="item pt-3 pb-0">
              {this.state.aiCredit !== undefined && (
                <div className="account-info-card">
                  <p className='account-info-card-title'>{gettext('AI credit used')}</p>
                  <p>
                    <span className='account-info-card-used'>{this.state.aiCost || 0}</span>
                    <span className='account-info-card-total'> / {this.state.aiCredit > 0 ? this.state.aiCredit : '--'}</span>
                  </p>
                </div>
              )}
            </div>
            <a href={siteRoot + 'profile/'} className="item">
              <Icon symbol="personal-settings" />
              {gettext('Personal settings')}
            </a>
            {this.renderMenu()}
            {!this.isWorkWX &&
              <a href={siteRoot + 'accounts/logout/'} className="item">
                <Icon symbol="logout" />
                {gettext('Log out')}
              </a>
            }
          </div>
        </div>
      </div>
    );
  }
}

Account.propTypes = propTypes;

export default Account;
