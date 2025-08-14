import React, { Component } from 'react';
import PropTypes from 'prop-types';
import toaster from '../toaster';
import { Utils } from '../../utils/utils';
import { isEnter, isEsc } from '../../utils/hotkey';
import { isWorkWeChat } from '../../utils/wechat-utils';
import { seaQAAPI } from '../../api/web-api';
import { siteRoot, gettext, avatarURL, isOrgContext, useExternalTeamAdmin } from '../../constants';
import IconBtn from '../icon-button';

import './index.css';

const propTypes = {
  isAdminPanel: PropTypes.bool,
};

class Account extends Component {

  isWorkWX = isWorkWeChat(window.navigator.userAgent.toLowerCase());

  constructor(props) {
    super(props);
    this.state = {
      showInfo: false,
      enableSubscription: false,
      userName: '',
      contactEmail: '',
      isStaff: false,
      isOrgStaff: false,
      quotaTotal: '',
      quotaUsage: '',
      usageRate: ''
    };
    this.isFirstMounted = true;
  }

  componentDidMount() {
    document.addEventListener('keydown', this.onDocumentKeydown);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onDocumentKeydown);
  }

  componentDidUpdate(prevProps) {
    this.handleProps();
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

  handleProps = () => {
    if (this.state.showInfo) {
      this.addEvents();
    } else {
      this.removeEvents();
    }
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
      seaQAAPI.getAccountInfo().then(resp => {
        this.setState({
          userName: resp.data.name,
          contactEmail: resp.data.email,
          isStaff: resp.data.is_staff,
          isInstAdmin: resp.data.is_inst_admin,
          isOrgStaff: resp.data.is_org_staff === 1 ? true : false,
          showInfo: !this.state.showInfo,
          enableSubscription: resp.data.enable_subscription,
          quotaUsage: Utils.bytesToSize(resp.data.usage),
          quotaTotal: Utils.bytesToSize(resp.data.total),
          usageRate: resp.data.space_usage,
          rowUsage: resp.data.row_usage,
          rowTotal: resp.data.row_total > 0 ? resp.data.row_total : '--',
          rowUsageRate: resp.data.row_usage_rate,
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

    if (this.props.isAdminPanel) {
      if (isStaff) {
        data = {
          url: siteRoot,
          text: gettext('Exit system admin')
        };
      } else if (isOrgStaff) {
        data = {
          url: siteRoot,
          text: gettext('Exit team admin')
        };
      } else if (isInstAdmin) {
        data = {
          url: siteRoot,
          text: gettext('Exit institution admin')
        };
      }
    } else {
      if (isStaff) {
        data = {
          url: `${siteRoot}sys/info/`,
          text: gettext('System admin')
        };
      } else if (isOrgStaff) {
        data = {
          url: useExternalTeamAdmin ? `${siteRoot}external-team-admin/` : `${siteRoot}org/orgmanage/`,
          text: gettext('Team admin')
        };
      } else if (isInstAdmin) {
        data = {
          url: `${siteRoot}inst/useradmin/`,
          text: gettext('Institution admin')
        };
      }
    }

    return data && <a href={data.url} title={data.text} className="item">{data.text}</a>;
  };

  renderAvatar = () => {
    return (<img src={avatarURL} width="36" height="36" className="avatar" alt={gettext('Avatar')} />);
  };

  renderDefaultAccount = () => {
    return (
      <div className="sf-popover-con">
        <div className="item o-hidden">
          {this.renderAvatar()}
          <div className="txt">{this.state.userName}</div>
        </div>
        <div className="item">
          <div className="account-info">
            <p>{gettext('Storage used')}{': '}{this.state.quotaUsage} / {this.state.quotaTotal}</p>
            <div id="quota-bar">
              <span id="quota-usage" className="usage sea-qa-bg-orange" style={{ width: this.state.usageRate }}></span>
            </div>
          </div>
          <div className="account-info">
            <p>{gettext('Rows used')}{': '}{this.state.rowUsage} / {this.state.rowTotal}</p>
            <div id="quota-bar">
              <span id="quota-usage" className="usage sea-qa-bg-orange" style={{ width: this.state.rowUsageRate }}></span>
            </div>
          </div>
          <div className="account-info row-used">
            <p>{gettext('API calls count')}{': '}{this.state.apiCallsCount} / {this.state.apiCallsLimit > 0 ? this.state.apiCallsLimit : '--'} </p>
            <div id="quota-bar">
              <span id="quota-usage" className="usage sea-qa-bg-orange" style={{ width: this.state.apiCallsUsageRate }}></span>
            </div>
          </div>
        </div>
        <a href={siteRoot + 'profile/'} className="item">{gettext('Personal settings')}</a>
        {(this.state.enableSubscription && !isOrgContext) && <a href={siteRoot + 'subscription/'} className="item">{'付费管理'}</a>}
        {this.renderMenu()}
        {!this.isWorkWX && <a href={siteRoot + 'accounts/logout/'} className="item">{gettext('Log out')}</a>}
      </div>
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
          <span>{this.renderAvatar()}</span>
        </span>
        <IconBtn
          icon="more-vertical"
          className="account-toggle mobile-icon d-md-none"
          aria-label={gettext('View profile and more')}
          title={gettext('View profile and more')}
          onClick={this.onClickAccount}
        />
        <div id="user-info-popup" className={`account-popup sf-popover ${this.state.showInfo ? '' : 'hide'}`}>
          <div className="outer-caret up-outer-caret">
            <div className="inner-caret"></div>
          </div>
          {this.renderDefaultAccount()}
        </div>
      </div>
    );
  }
}

Account.defaultProps = {
  isAdminPanel: false
};

Account.propTypes = propTypes;

export default Account;
