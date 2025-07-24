import React from 'react';
import { createRoot } from 'react-dom/client';
import { toaster } from './components';
import { Utils, isMobile } from './utils/utils';
import { isWorkWeChat } from './utils/wechat-utils';
import { gettext, siteRoot, mediaUrl, logoPath, logoWidth, logoHeight, siteTitle, isOrgContext } from './constants';
import { seaQAAPI } from './api/web-api';
import SideNav from './components/user-settings/side-nav';
import UserAvatarForm from './components/user-settings/user-avatar-form';
import UserBasicInfoForm from './components/user-settings/user-basic-info-form';
import WebdavPassword from './components/user-settings/webdav-password';
import LanguageSetting from './components/user-settings/language-setting';
import TwoFactorAuthentication from './components/user-settings/two-factor-auth';
import SocialLogin from './components/user-settings/social-login';
import DeleteAccount from './components/user-settings/delete-account';
import UserConvertToTeam from './components/user-settings/user-convert-to-team';
import BindPhone from './components/user-settings/bind-phone';
import EmailNotice from './components/user-settings/email-notice';
import Account from './components/account';
import BindContactEmail from './components/user-settings/bind-contact-email';
import LoggedInSessions from './components/user-settings/logged_in_sessions';
import UserSetPassword from './components/dialog/user-password-widgets/user-set-password-dialog';
import UserUpdatePassword from './components/dialog/user-password-widgets/user-update-password-dialog';
import UserRemovePassword from './components/dialog/user-password-widgets/user-remove-password-dialog';
import UserResetPassword from './components/dialog/user-password-widgets/user-reset-password-dialog';

import './css/toolbar.css';
import './css/search.css';
import './css/user-settings.css';
import './css/project-search.css';

const {
  canUpdatePassword,
  userUnusablePassword,
  enableWebdavSecret,
  twoFactorAuthEnabled,
  enableWorkWeixin,
  enableOrgWorkWeixin,
  enableWeixin,
  enableOrgDingtalk,
  enableDingtalk,
  enableDeleteAccount,
  enableBindPhone,
  enableConvertToTeamAccount,
  workWeixinConnected,
  dingtalkConnected,
  orgWorkWeixinConnected,
  weixinConnected,
  orgDingtalkConnected,
  enableSAML,
  enableMultiSAML,
} = window.app.pageOptions;

class Settings extends React.Component {

  isWorkWX = isWorkWeChat(window.navigator.userAgent.toLowerCase());

  constructor(props) {
    super(props);
    this.sideNavItems = [
      { show: true, href: '#user-basic-info', text: gettext('Profile') },
      { show: true, href: '#bind-contact-email', text: gettext('Contact email') },
      { show: canUpdatePassword && !this.isWorkWX, href: '#update-user-passwd', text: gettext('Password') },
      { show: enableBindPhone && !this.isWorkWX, href: '#bind-phone', text: gettext('Bind phone number') },
      { show: enableWebdavSecret, href: '#update-webdav-passwd', text: gettext('WebDav password') },
      { show: true, href: '#lang-setting', text: gettext('Language') },
      { show: true, href: '#email-notice', text: gettext('Email notification') },
      { show: twoFactorAuthEnabled, href: '#two-factor-auth', text: gettext('Two-Factor Authentication') },
      { show: (enableWorkWeixin || enableWeixin || (enableOrgWorkWeixin && isOrgContext) || (enableOrgDingtalk && isOrgContext) || (enableMultiSAML && isOrgContext)) && !this.isWorkWX, href: '#social-auth', text: gettext('Social login') },
      // {show: (cloudMode && !isOrgContext) ? true : false, href: '#migrate-to-organization', text: gettext('Migrate to organization')},
      { show: enableDeleteAccount && !this.isWorkWX, href: '#del-account', text: gettext('Delete account') },
      { show: true, href: '#logged-in-sessions', text: gettext('Session logs') },
    ];

    this.state = {
      curItemID: this.sideNavItems[0].href.substr(1),
      userInfo: null,
      contactEmail: '',
      isSetPasswordDialogOpen: false,
      isUpdatePasswordDialogOpen: false,
      isRemovePasswordDialogOpen: false,
      isResetPasswordDialogOpen: false,
    };
    this.isMobile = isMobile;
  }

  componentDidMount() {
    seaQAAPI.getUserInfo().then((res) => {
      this.setState({
        userInfo: res.data,
        contactEmail: res.data.contact_email
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  }

  updateUserInfo = (data) => {
    seaQAAPI.updateUserInfo(data).then((res) => {
      this.setState({ userInfo: res.data });
      toaster.success(gettext('User info updated'));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  handleContentScroll = (e) => {
    // Mobile does not display the sideNav, so when scrolling don't update curItemID
    if (this.isMobile) return;
    const scrollTop = e.target.scrollTop;
    const scrolled = this.sideNavItems.filter((item, index) => {
      return item.show && document.getElementById(item.href.substr(1)).offsetTop - 45 < scrollTop;
    });
    if (scrolled.length) {
      this.setState({
        curItemID: scrolled[scrolled.length - 1].href.substr(1)
      });
    }
  };

  toggleSetPassword = () => {
    this.setState({ isSetPasswordDialogOpen: !this.state.isSetPasswordDialogOpen });
  };

  toggleUpdatePassword = () => {
    this.setState({ isUpdatePasswordDialogOpen: !this.state.isUpdatePasswordDialogOpen });
  };

  toggleRemovePassword = () => {
    this.setState({
      isRemovePasswordDialogOpen: !this.state.isRemovePasswordDialogOpen
    });
  };

  toggleResetPassword = () => {
    this.setState({
      isResetPasswordDialogOpen: !this.state.isResetPasswordDialogOpen
    });
  };

  render() {
    const canRemovePassword = (enableWorkWeixin && workWeixinConnected) ||
        (enableDingtalk && dingtalkConnected) ||
        (enableOrgWorkWeixin && orgWorkWeixinConnected) ||
        (enableWeixin && weixinConnected) || (enableOrgDingtalk && orgDingtalkConnected) ||
        (enableBindPhone && this.state.userInfo && this.state.userInfo.bind_phone);

    const bindPhone = this.state.userInfo ? this.state.userInfo.bind_phone : '';
    const logoUrl = logoPath.startsWith('http') ? logoPath : mediaUrl + logoPath;
    return (
      <React.Fragment>
        <div className="sea-qa-web-settings h-100 d-flex flex-column">
          <div className="top-header d-flex justify-content-between">
            <a href={siteRoot}>
              <img src={logoUrl} height={logoHeight} width={logoWidth} title={siteTitle} alt="logo" />
            </a>
            <div className="common-toolbar">
              <Account />
            </div>
          </div>
          <div className="flex-auto d-flex o-hidden">
            <div className="side-panel o-auto">
              <SideNav data={this.sideNavItems} curItemID={this.state.curItemID} />
            </div>
            <div className="main-panel d-flex flex-column">
              <h2 className="heading">{gettext('Personal settings')}</h2>
              <div className="content position-relative" onScroll={this.handleContentScroll}>
                <div id="user-basic-info" className="setting-item">
                  <h3 className="setting-item-heading">{gettext('Profile setting')}</h3>
                  <UserAvatarForm />
                  {this.state.userInfo && <UserBasicInfoForm userInfo={this.state.userInfo} updateUserInfo={this.updateUserInfo} />}
                </div>
                <BindContactEmail contactEmail={this.state.contactEmail} />
                {canUpdatePassword && !this.isWorkWX &&
                  <div id="update-user-passwd" className="setting-item">
                    <h3 className="setting-item-heading">{gettext('Password')}</h3>
                    {userUnusablePassword ? (
                      <>
                        <p>{gettext('You have not set a password yet. Setting a password and binding a phone number or an email will enable you to login via phone number or email.')}</p>
                        <button className="btn btn-outline-primary mb-2" onClick={this.toggleSetPassword}>{gettext('Set')}</button>
                      </>
                    ) : (
                      <button className="btn btn-outline-primary mb-2" onClick={this.toggleUpdatePassword}>{gettext('Update')}</button>
                    )}
                    {canRemovePassword && !userUnusablePassword &&
                      <button className="btn btn-outline-primary ml-2 mb-2" onClick={this.toggleRemovePassword}>{gettext('Remove')}</button>
                    }
                    {bindPhone && !userUnusablePassword && <button className="btn btn-outline-primary ml-2 mb-2" onClick={this.toggleResetPassword}>{gettext('Reset')}</button>}
                  </div>
                }
                {enableBindPhone && !this.isWorkWX && this.state.userInfo && (
                  <BindPhone
                    oldBindPhone={this.state.userInfo.bind_phone}
                    sms2fa={this.state.userInfo.sms_2fa}
                    updateUserInfo={this.updateUserInfo}
                    contactEmail={this.state.contactEmail}
                  />
                )}
                {enableWebdavSecret && <WebdavPassword />}
                <LanguageSetting />
                <EmailNotice />
                {twoFactorAuthEnabled && <TwoFactorAuthentication />}
                {(enableWorkWeixin || enableDingtalk || enableWeixin || (enableOrgWorkWeixin && isOrgContext) || (enableOrgDingtalk && isOrgContext) || enableSAML || (enableMultiSAML && isOrgContext)) && !this.isWorkWX && <SocialLogin />}
                {(enableConvertToTeamAccount && !isOrgContext) && <UserConvertToTeam />}
                {enableDeleteAccount && !this.isWorkWX && <DeleteAccount />}
                <div id="logged-in-sessions" className="setting-item">
                  <h3 className="setting-item-heading">{gettext('Session logs')}</h3>
                  <LoggedInSessions />
                </div>
              </div>
            </div>
          </div>
        </div>
        {this.state.isSetPasswordDialogOpen && (
          <UserSetPassword
            toggle={this.toggleSetPassword}
          />
        )}
        {this.state.isUpdatePasswordDialogOpen && (
          <UserUpdatePassword
            toggle={this.toggleUpdatePassword}
          />
        )}
        {this.state.isRemovePasswordDialogOpen && (
          <UserRemovePassword
            toggle={this.toggleRemovePassword}
          />
        )}
        {this.state.isResetPasswordDialogOpen && (
          <UserResetPassword
            toggle={this.toggleResetPassword}
            bindPhone={bindPhone}
          />
        )}
      </React.Fragment>
    );
  }
}
const root = createRoot(document.getElementById('wrapper'));
root.render(<Settings />);
