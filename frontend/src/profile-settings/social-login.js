import React, { Fragment } from 'react';
import { gettext, siteRoot, isOrgContext } from '../constants';
import ModalPortal from '../components/modal-portal';
import ConfirmDisconnectWechat from '../components/dialog/confirm-disconnect-wechat';

const {
  csrfToken,
  orgID,
  enableSAML,
  samlConnected,
  enableMultiSAML,
  canUseSAML,
  orgSamlConnected,
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
    let samlConnectUrl = (enableMultiSAML && isOrgContext && canUseSAML) ? `${siteRoot}org/custom/${orgID}/saml/connect/?next=${encodeURIComponent(socialNextPage)}` : `${siteRoot}saml/connect/?next=${encodeURIComponent(socialNextPage)}`;

    return (
      <Fragment>
        <div className="setting-item" id="social-auth">
          <h3 className="setting-item-heading">{gettext('SSO')}</h3>
          {(enableSAML || (enableMultiSAML && isOrgContext && canUseSAML)) && (
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
