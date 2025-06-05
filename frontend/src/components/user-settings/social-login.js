import React, { Fragment } from 'react';
import { gettext, siteRoot, isOrgContext } from '../../utils/constants';
import ModalPortal from '../modal-portal';
import ConfirmDisconnectWechat from '../dialog/confirm-disconnect-wechat';

const {
  csrfToken,
  langCode,
  orgID,
  enableWorkWeixin,
  enableDingtalk,
  enableOrgWorkWeixin,
  enableWeixin,
  workWeixinConnected,
  dingtalkConnected,
  orgWorkWeixinConnected,
  orgWorkWeixinLicenseStatus,
  weixinConnected,
  weixinOfficialAccountsFollowed,
  enableOrgDingtalk,
  orgDingtalkConnected,
  enableSAML,
  samlConnected,
  enableMultiSAML,
  orgSamlConnected,
  orgCorpBindType,
  socialNextPage
} = window.app.pageOptions;

class SocialLogin extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isConfirmDialogOpen: false,
      disconnectType: '',
    };
    this.disconnectUrlMap = {
      'orgWorkWeixin': `${siteRoot}org-work-weixin/oauth-disconnect/?next=${encodeURIComponent(socialNextPage)}`,
      'workWeixin': `${siteRoot}work-weixin/oauth-disconnect/?next=${encodeURIComponent(socialNextPage)}`,
      'weixin': `${siteRoot}weixin/oauth-disconnect/?next=${encodeURIComponent(socialNextPage)}`,
      'orgDingtalk': `${siteRoot}org-dingtalk/oauth-disconnect/?next=${encodeURIComponent(socialNextPage)}`,
      'dingtalk': `${siteRoot}dingtalk/oauth-disconnect/?next=${encodeURIComponent(socialNextPage)}`,
      'saml': (orgSamlConnected && isOrgContext) ?
        `${siteRoot}org/custom/${orgID}/saml/disconnect/?next=${encodeURIComponent(socialNextPage)}` :
        `${siteRoot}saml/disconnect/?next=${encodeURIComponent(socialNextPage)}`,
    };
  }

  confirmDisconnect = (disconnectType) => {
    this.setState({
      isConfirmDialogOpen: true,
      disconnectType: disconnectType,
    });
  };

  toggleDialog = () => {
    this.setState({
      isConfirmDialogOpen: !this.state.isConfirmDialogOpen
    });
  };

  render() {
    const disconnectUrl = this.disconnectUrlMap[this.state.disconnectType];
    let samlConnectUrl = (enableMultiSAML && isOrgContext) ? `${siteRoot}org/custom/${orgID}/saml/connect/?next=${encodeURIComponent(socialNextPage)}` : `${siteRoot}saml/connect/?next=${encodeURIComponent(socialNextPage)}`;

    return (
      <Fragment>
        <div className="setting-item" id="social-auth">
          <h3 className="setting-item-heading">{gettext('Social login')}</h3>
          {enableWorkWeixin &&
            <div className="mb-4">
              <p className="mb-2">{langCode === 'zh-cn' ? '企业微信' : 'Work Weixin'}</p>
              {workWeixinConnected ?
                <button className="btn btn-outline-primary" onClick={this.confirmDisconnect.bind(this, 'workWeixin')}>{gettext('Disconnect')}</button> :
                <a href={`${siteRoot}work-weixin/oauth-connect/?next=${encodeURIComponent(socialNextPage)}`} className="btn btn-outline-primary">{gettext('Connect')}</a>}
            </div>
          }
          {enableDingtalk &&
            <div className="mb-4">
              <p className="mb-2">{langCode === 'zh-cn' ? '钉钉' : 'Dingtalk'}</p>
              {dingtalkConnected ?
                <button className="btn btn-outline-primary" onClick={this.confirmDisconnect.bind(this, 'dingtalk')}>{gettext('Disconnect')}</button> :
                <a href={`${siteRoot}dingtalk/oauth-connect/?next=${encodeURIComponent(socialNextPage)}`} className="btn btn-outline-primary">{gettext('Connect')}</a>}
            </div>
          }
          {(enableOrgWorkWeixin && isOrgContext && orgCorpBindType === 'org-work-weixin') &&
            <div className="mb-4">
              <p className="mb-2">{langCode === 'zh-cn' ? '企业微信' : 'Work Weixin'}</p>
              {orgWorkWeixinConnected ?
                <button className="btn btn-outline-primary" onClick={this.confirmDisconnect.bind(this, 'orgWorkWeixin')}>{gettext('Disconnect')}</button> :
                <a href={`${siteRoot}org-work-weixin/oauth-connect/?next=${encodeURIComponent(socialNextPage)}`} className="btn btn-outline-primary">{gettext('Connect')}</a>}
              {orgWorkWeixinConnected && <p className="mt-2" style={{ 'fontSize': '14px' }}>{'企业微信接口许可: '}{orgWorkWeixinLicenseStatus === 0 ? '未激活' : '已激活' }</p>}
            </div>
          }
          {enableWeixin &&
            <div className="mb-4">
              <p className="mb-2">{langCode === 'zh-cn' ? '微信' : 'WeChat'}</p>
              {(weixinConnected && weixinOfficialAccountsFollowed) && <p className="mt-2" style={{ 'fontSize': '14px' }}>{'已关联公众号订阅，可以通过公众号收取通知'}</p>}
              {weixinConnected ?
                <button className="btn btn-outline-primary" onClick={this.confirmDisconnect.bind(this, 'weixin')}>{gettext('Disconnect')}</button> :
                <a href={`${siteRoot}weixin/oauth-connect/?next=${encodeURIComponent(socialNextPage)}`} className="btn btn-outline-primary">{gettext('Connect')}</a>}
            </div>
          }
          {(enableOrgDingtalk && isOrgContext && orgCorpBindType === 'org-dingtalk') &&
            <div className="mb-4">
              <p className="mb-2">{langCode === 'zh-cn' ? '钉钉' : 'Dingtalk'}</p>
              {orgDingtalkConnected ?
                <button className="btn btn-outline-primary" onClick={this.confirmDisconnect.bind(this, 'orgDingtalk')}>{gettext('Disconnect')}</button> :
                <a href={`${siteRoot}org-dingtalk/oauth-connect/?next=${encodeURIComponent(socialNextPage)}`} className="btn btn-outline-primary">{gettext('Connect')}</a>}
            </div>
          }
          {(enableSAML || (enableMultiSAML && isOrgContext)) && (
            <div className="mb-4">
              <p className="mb-2">{'SAML'}</p>
              {(samlConnected || orgSamlConnected) ?
                <button className="btn btn-outline-primary" onClick={this.confirmDisconnect.bind(this, 'saml')}>{gettext('Disconnect')}</button> :
                <a href={samlConnectUrl} className="btn btn-outline-primary">{gettext('Connect')}</a>}
            </div>
          )}
        </div>
        {this.state.isConfirmDialogOpen && (
          <ModalPortal>
            <ConfirmDisconnectWechat
              formActionURL={disconnectUrl}
              csrfToken={csrfToken}
              toggle={this.toggleDialog}
            />
          </ModalPortal>
        )}
      </Fragment>
    );
  }
}

export default SocialLogin;
