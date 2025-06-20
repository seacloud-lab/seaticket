import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import { enableUserSetContactEmail, gettext, loginUrl } from '../../constants';
import { Utils } from '../../utils/utils';
import Loading from '../../components/loading';
import OrgAdminUserNav from '../../components/org-admin-user-nav';
import SetOrgUserName from '../../components/dialog/set-org-user-name';
import SetOrgUserContactEmail from '../../components/dialog/set-org-user-contact-email';
import SetOrgUserQuota from '../../components/dialog/set-org-user-quota';
import SetOrgUserIdInOrg from '../../components/dialog/set-org-user-id-in-org';
import MainPanelTopbar from './main-panel-topbar';
import { orgAdminServiceApi } from '../../api/org-admin-service-api';

import '../../css/org-admin-user.css';

const { orgID, twoFactorAuthEnabled } = window.org.pageOptions;
const { lang } = window.app.config;

const orgUserProfilePropTypes = {
  email: PropTypes.string,
  onCloseSidePanel: PropTypes.func,
};

class OrgUserProfile extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: ''
    };
  }

  componentDidMount() {
    const email = decodeURIComponent(this.props.email);
    orgAdminServiceApi.orgAdminGetOrgUserInfo(orgID, email).then((res) => {
      this.setState(Object.assign({
        loading: false
      }, res.data));
    }).catch((error) => {
      if (error.response) {
        if (error.response.status === 403) {
          this.setState({
            loading: false,
            errorMsg: gettext('Permission denied')
          });
          location.href = `${loginUrl}?next=${encodeURIComponent(location.href)}`;
        } else if (error.response.status === 404) {
          this.setState({
            loading: false,
            errorMsg: gettext('User not found')
          });
        } else {
          this.setState({
            loading: false,
            errorMsg: gettext('Error')
          });
        }
      } else {
        this.setState({
          loading: false,
          errorMsg: gettext('Please check the network.')
        });
      }
    });
  }

  updateName = (name) => {
    this.setState({
      name: name
    });
  };

  updateIdInOrg = (id_in_org) => {
    this.setState({
      id_in_org: id_in_org
    });
  };

  updateContactEmail = (contactEmail) => {
    this.setState({
      contact_email: contactEmail
    });
  };

  updateQuota = (quota) => {
    this.setState({
      quota_total: quota
    });
  };

  disable2FA = () => {
    const email = decodeURIComponent(this.props.email);
    orgAdminServiceApi.orgAdminDeleteTwoFactorAuth(orgID, email).then(res => {
      this.setState({
        has_default_device: false
      });
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  toggleForce2fa = (e) => {
    const email = decodeURIComponent(this.props.email);
    const checked = e.target.checked;
    orgAdminServiceApi.orgAdminSetForceTwoFactorAuth(orgID, email, checked).then(res => {
      this.setState({
        is_force_2fa: checked
      });
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  render() {
    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel}/>
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <OrgAdminUserNav email={this.props.email} currentItem='profile' />
            <div className="cur-view-content">
              <Content
                data={this.state}
                updateName={this.updateName}
                updateIdInOrg={this.updateIdInOrg}
                updateContactEmail={this.updateContactEmail}
                updateQuota={this.updateQuota}
                disable2FA={this.disable2FA}
                toggleForce2fa={this.toggleForce2fa}
              />
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

OrgUserProfile.propTypes = orgUserProfilePropTypes;

const contentPropTypes = {
  data: PropTypes.object.isRequired,
  updateName: PropTypes.func.isRequired,
  updateContactEmail: PropTypes.func.isRequired,
  updateQuota: PropTypes.func.isRequired,
  updateIdInOrg: PropTypes.func.isRequired,
  disable2FA: PropTypes.func.isRequired,
  toggleForce2fa: PropTypes.func.isRequired,
};

class Content extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isSetNameDialogOpen: false,
      isSetContactEmailDialogOpen: false,
      isSetQuotaDialogOpen: false,
      isSetIdInOrgDialogOpen: false,
    };
  }

  toggleSetIdInOrgDialog = () => {
    this.setState({
      isSetIdInOrgDialogOpen: !this.state.isSetIdInOrgDialogOpen
    });
  };

  toggleSetNameDialog = () => {
    this.setState({
      isSetNameDialogOpen: !this.state.isSetNameDialogOpen
    });
  };

  toggleSetContactEmailDialog = () => {
    this.setState({
      isSetContactEmailDialogOpen: !this.state.isSetContactEmailDialogOpen
    });
  };

  toggleSetQuotaDialog = () => {
    this.setState({
      isSetQuotaDialogOpen: !this.state.isSetQuotaDialogOpen
    });
  };

  render() {
    const {
      loading, errorMsg,
      avatar_url, email, contact_email,
      name, quota_total, quota_usage, id_in_org, has_default_device, is_force_2fa,
      weixin_connected, weixin_official_accounts_followed,
      corp_bound_work_weixin, org_work_weixin_connected, corp_bound_dingtalk, org_dingtalk_connected,
    } = this.props.data;
    const { isSetNameDialogOpen, isSetContactEmailDialogOpen, isSetQuotaDialogOpen, isSetIdInOrgDialogOpen } = this.state;

    if (loading) {
      return <Loading />;
    }
    if (errorMsg) {
      return <p className="error text-center">{errorMsg}</p>;
    }
    return (
      <Fragment>
        <dl className="mt-0">
          <dt className="info-item-heading">{gettext('Avatar')}</dt>
          <dd>
            <img src={avatar_url} width="80" height="80" className="rounded" alt="" />
          </dd>

          <dt className="info-item-heading">ID</dt>
          <dd>
            {id_in_org || '--'}
            <span title={gettext('Edit')} aria-label={gettext('Edit')} className="attr-action-icon dtable-font dtable-icon-rename" onClick={this.toggleSetIdInOrgDialog}></span>
          </dd>

          <dt className="info-item-heading">{gettext('Name')}</dt>
          <dd>
            {name || '--'}
            <span title={gettext('Edit')} aria-label={gettext('Edit')} className="attr-action-icon dtable-font dtable-icon-rename" onClick={this.toggleSetNameDialog}></span>
          </dd>

          <dt className="info-item-heading">{gettext('Contact email')}</dt>
          <dd>
            {contact_email || '--'}
            {enableUserSetContactEmail &&
              <span title={gettext('Edit')} aria-label={gettext('Edit')} className="attr-action-icon dtable-font dtable-icon-rename" onClick={this.toggleSetContactEmailDialog}></span>
            }
          </dd>

          <dt className="info-item-heading">{gettext('Space used / Quota')}</dt>
          <dd>
            {`${Utils.bytesToSize(quota_usage)}${quota_total > 0 ? ' / ' + Utils.bytesToSize(quota_total) : ''}`}
            <span title={gettext('Edit')} aria-label={gettext('Edit')} className="attr-action-icon dtable-font dtable-icon-rename" onClick={this.toggleSetQuotaDialog}></span>
          </dd>

          {twoFactorAuthEnabled &&
            <Fragment>
              <dt className="info-item-heading">{gettext('Two-Factor Authentication')}</dt>
              <dd className="info-item-content">
                {has_default_device ?
                  <FormGroup>
                    <p className="mb-1">{gettext('Enabled')}</p>
                    <Button onClick={this.props.disable2FA}>{gettext('Disable Two-Factor Authentication')}</Button>
                  </FormGroup> :
                  <FormGroup>
                    <p className="mb-1">{gettext('Disabled')}</p>
                    <Button disabled={true}>{gettext('Disable Two-Factor Authentication')}</Button>
                  </FormGroup>
                }
                <FormGroup check>
                  <Label check className="position-relative">
                    <Input type="checkbox" checked={is_force_2fa} onChange={this.props.toggleForce2fa} />
                    <span>{gettext('Force Two-Factor Authentication')}</span>
                  </Label>
                </FormGroup>
              </dd>
            </Fragment>
          }

          {lang === 'zh-cn' &&
            <Fragment>
              <dt className="info-item-heading">{'微信'}</dt>
              <dd className="info-item-content">{weixin_connected ? '已绑定' : '未绑定'}</dd>
              <dd className="info-item-content">{weixin_official_accounts_followed ? '已关注 SeaTable 公众号' : '未关注 SeaTable 公众号'}</dd>
            </Fragment>
          }
          {(lang === 'zh-cn' && corp_bound_work_weixin) &&
            <Fragment>
              <dt className="info-item-heading">{'企业微信'}</dt>
              <dd className="info-item-content">{org_work_weixin_connected ? '已绑定' : '未绑定'}</dd>
            </Fragment>
          }
          {(lang === 'zh-cn' && corp_bound_dingtalk) &&
            <Fragment>
              <dt className="info-item-heading">{'钉钉'}</dt>
              <dd className="info-item-content">{org_dingtalk_connected ? '已绑定' : '未绑定'}</dd>
            </Fragment>
          }

        </dl>
        {isSetNameDialogOpen &&
        <SetOrgUserName
          orgID={orgID}
          email={email}
          name={name}
          updateName={this.props.updateName}
          toggleDialog={this.toggleSetNameDialog}
        />
        }
        {isSetContactEmailDialogOpen &&
        <SetOrgUserContactEmail
          orgID={orgID}
          email={email}
          contactEmail={contact_email}
          updateContactEmail={this.props.updateContactEmail}
          toggleDialog={this.toggleSetContactEmailDialog}
        />
        }
        {isSetQuotaDialogOpen &&
        <SetOrgUserQuota
          orgID={orgID}
          email={email}
          quotaTotal={quota_total}
          updateQuota={this.props.updateQuota}
          toggleDialog={this.toggleSetQuotaDialog}
        />
        }
        {isSetIdInOrgDialogOpen &&
        <SetOrgUserIdInOrg
          orgID={orgID}
          email={email}
          idInOrg={id_in_org}
          updateIdInOrg={this.props.updateIdInOrg}
          toggleDialog={this.toggleSetIdInOrgDialog}
        />
        }
      </Fragment>
    );
  }
}

Content.propTypes = contentPropTypes;

export default OrgUserProfile;
