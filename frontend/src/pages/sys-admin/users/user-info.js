import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { FormGroup, Label, Input, Button } from 'reactstrap';
import { IconButton, toaster } from '../../../components';
import { Utils } from '../../../utils/utils';
import { loginUrl, gettext, isShowUint, twoFactorAuthEnabled, multiTenancy } from '../../../constants';
import Loading from '../../../components/loading';
import SysAdminSetQuotaDialog from '../../../components/dialog/sysadmin-dialog/set-quota';
import SysAdminUpdateUserDialog from '../../../components/dialog/sysadmin-dialog/update-user';
import MainPanelTopbar from '../main-panel-topbar';
import Nav from './user-nav';
import SetRowLimitDialog from '../../../components/dialog/sysadmin-dialog/set-row-limit';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';
import SetAPICallsLimitPerUser from '../../../components/dialog/sysadmin-dialog/set-api-calls-limit-per-user';

const { lang } = window.app.config;

const contentPropTypes = {
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  userInfo: PropTypes.object,
  updateUser: PropTypes.func.isRequired,
  disable2FA: PropTypes.func.isRequired,
  toggleForce2fa: PropTypes.func.isRequired,
};

class Content extends Component {

  constructor(props) {
    super(props);
    this.state = {
      currentKey: '',
      dialogTitle: '',
      isSetQuotaDialogOpen: false,
      isUpdateUserDialogOpen: false,
      isSetRowLimitDialogOpen: false,
      isSetAPICallsLimitPerUserDialogOpen: false,
    };
  }

  toggleSetQuotaDialog = () => {
    this.setState({ isSetQuotaDialogOpen: !this.state.isSetQuotaDialogOpen });
  };

  toggleSetRowLimitDialog = () => {
    this.setState({ isSetRowLimitDialogOpen: !this.state.isSetRowLimitDialogOpen });
  };

  updateQuota = (value) => {
    this.props.updateUser('asset_quota_mb', value);
  };

  updateRowLimit = (value) => {
    this.props.updateUser('row_limit', value);
  };

  toggleDialog = (key, dialogTitle) => {
    this.setState({
      currentKey: key,
      dialogTitle: dialogTitle,
      isUpdateUserDialogOpen: !this.state.isUpdateUserDialogOpen
    });
  };

  toggleSetNameDialog = () => {
    this.toggleDialog('name', gettext('Set name'));
  };

  toggleSetUserContactEmailDialog = () => {
    this.toggleDialog('contact_email', gettext('Set contact email'));
  };

  toggleSetUserPhoneDialog = () => {
    this.toggleDialog('phone', gettext('Set phone'));
  };

  toggleSetUseIdInOrgTupleDialog = () => {
    this.toggleDialog('id_in_org', gettext('Set ID'));
  };

  toggleSetUserUnitDialog = () => {
    this.toggleDialog('unit', gettext('Set unit'));
  };

  updateValue = (value) => {
    this.props.updateUser(this.state.currentKey, value);
  };

  toggleUpdateUserDialog = () => {
    this.toggleDialog('', '');
  };

  toggleAPICallsLimitPerUserDialog = () => {
    this.setState({ isSetAPICallsLimitPerUserDialogOpen: !this.state.isSetAPICallsLimitPerUserDialogOpen });
  };

  updateAPICallsLimitPerUser = (value) => {
    this.props.updateUser('monthly_api_call_limit_per_user', value);
  };

  showEditIcon = (action) => {
    return (
      <IconButton
        title={gettext('Edit')}
        aria-label={gettext('Edit')}
        icon="rename"
        className="attr-action-icon"
        onClick={action}>
      </IconButton>
    );
  };

  render() {
    const { loading, errorMsg } = this.props;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center mt-4">{errorMsg}</p>;
    } else {
      const user = this.props.userInfo;
      const {
        currentKey, dialogTitle,
        isSetQuotaDialogOpen, isUpdateUserDialogOpen, isSetRowLimitDialogOpen,
        isSetAPICallsLimitPerUserDialogOpen
      } = this.state;
      return (
        <Fragment>
          <dl className="m-0">
            <dt className="info-item-heading">{gettext('Avatar')}</dt>
            <dd className="info-item-content">
              <img src={user.avatar_url} alt={user.name} width="80" className="rounded" />
            </dd>

            <dt className="info-item-heading">ID</dt>
            <dd className="info-item-content">
              {user.id_in_org ? user.id_in_org : '--'}
              {this.showEditIcon(this.toggleSetUseIdInOrgTupleDialog)}
            </dd>

            <dt className="info-item-heading">{gettext('Username')}</dt>
            <dd className="info-item-content">{user.email}</dd>

            {user.org_name &&
              <Fragment>
                <dt className="info-item-heading">{gettext('Organization')}</dt>
                <dd className="info-item-content">{user.org_name}</dd>
              </Fragment>
            }

            <dt className="info-item-heading">{gettext('Name')}</dt>
            <dd className="info-item-content">
              {user.name || '--'}
              {this.showEditIcon(this.toggleSetNameDialog)}
            </dd>
            <dt className="info-item-heading">{gettext('Phone')}</dt>
            <dd className="info-item-content">
              {user.phone || '--'}
              {this.showEditIcon(this.toggleSetUserPhoneDialog)}
            </dd>

            <dt className="info-item-heading">{gettext('Contact email')}</dt>
            <dd className="info-item-content">
              {user.contact_email || '--'}
              {this.showEditIcon(this.toggleSetUserContactEmailDialog)}
            </dd>

            {isShowUint && (
              <Fragment>
                <dt className="info-item-heading">{gettext('Unit')}</dt>
                <dd className="info-item-content">
                  {user.unit || '--'}
                  {this.showEditIcon(this.toggleSetUserUnitDialog)}
                </dd>
              </Fragment>
            )}

            <dt className="info-item-heading">{gettext('API calls count')}</dt>
            <dd className="info-item-content">
              {user.api_calls_count || 0}
            </dd>

            <dt className="info-item-heading">{gettext('API calls limit per user')}</dt>
            <dd className="info-item-content">
              {user.monthly_api_call_limit_per_user > 0 ? user.monthly_api_call_limit_per_user : '--'}
              {this.showEditIcon(this.toggleAPICallsLimitPerUserDialog)}
            </dd>

            {twoFactorAuthEnabled &&
              <Fragment>
                <dt className="info-item-heading">{gettext('Two-Factor Authentication')}</dt>
                <dd className="info-item-content">
                  {user.has_default_device ?
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
                      <Input type="checkbox" checked={user.is_force_2fa} onChange={this.props.toggleForce2fa} />
                      <span>{gettext('Force Two-Factor Authentication')}</span>
                    </Label>
                  </FormGroup>
                </dd>
              </Fragment>
            }

            {(lang === 'zh-cn' && multiTenancy) &&
              <Fragment>
                <dt className="info-item-heading">{'微信'}</dt>
                <dd className="info-item-content">{user.weixin_connected ? '已绑定' : '未绑定'}</dd>
                <dd className="info-item-content">{user.weixin_official_accounts_followed ? '已关注 SeaTable 公众号' : '未关注 SeaTable 公众号'}</dd>
              </Fragment>
            }
            {(lang === 'zh-cn' && multiTenancy && user.org_id && user.corp_bound_work_weixin) &&
              <Fragment>
                <dt className="info-item-heading">{'企业微信'}</dt>
                <dd className="info-item-content">{user.org_work_weixin_connected ? '已绑定' : '未绑定'}</dd>
              </Fragment>
            }
            {(lang === 'zh-cn' && multiTenancy && user.org_id && user.corp_bound_dingtalk) &&
              <Fragment>
                <dt className="info-item-heading">{'钉钉'}</dt>
                <dd className="info-item-content">{user.org_dingtalk_connected ? '已绑定' : '未绑定'}</dd>
              </Fragment>
            }
          </dl>
          {isSetQuotaDialogOpen &&
          <SysAdminSetQuotaDialog
            updateQuota={this.updateQuota}
            toggle={this.toggleSetQuotaDialog}
          />
          }
          {isUpdateUserDialogOpen &&
          <SysAdminUpdateUserDialog
            dialogTitle={dialogTitle}
            value={user[currentKey]}
            updateValue={this.updateValue}
            toggleDialog={this.toggleUpdateUserDialog}
          />
          }
          {isSetRowLimitDialogOpen &&
          <SetRowLimitDialog
            updateRowLimit={this.updateRowLimit}
            toggle={this.toggleSetRowLimitDialog}
          />}
          {isSetAPICallsLimitPerUserDialogOpen &&
            <SetAPICallsLimitPerUser
              updateLimit={this.updateAPICallsLimitPerUser}
              toggle={this.toggleAPICallsLimitPerUserDialog}
            />
          }
        </Fragment>
      );
    }
  }
}

Content.propTypes = contentPropTypes;

const userPropTypes = {
  email: PropTypes.string,
  onCloseSidePanel: PropTypes.func
};

class User extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      userInfo: {}
    };
  }

  componentDidMount() {
    const email = decodeURIComponent(this.props.email);
    sysAdminServiceApi.sysAdminGetUser(email).then((res) => {
      this.setState({
        loading: false,
        userInfo: res.data
      });
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

  updateUser = (key, value) => {
    const email = this.state.userInfo.email;
    sysAdminServiceApi.sysAdminUpdateUser(email, key, value).then(res => {
      let userInfo = this.state.userInfo;
      if (key === 'asset_quota_mb') {
        userInfo['storage_quota'] = res.data['storage_quota'];
      } else {
        userInfo[key] = res.data[key];
      }
      this.setState({
        userInfo: userInfo
      });
      toaster.success(gettext('Edit succeeded'));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  disable2FA = () => {
    const email = this.state.userInfo.email;
    sysAdminServiceApi.sysAdminDeleteTwoFactorAuth(email).then(res => {
      let userInfo = this.state.userInfo;
      userInfo.has_default_device = false;
      this.setState({
        userInfo: userInfo
      });
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  toggleForce2fa = (e) => {
    const email = this.state.userInfo.email;
    const checked = e.target.checked;
    sysAdminServiceApi.sysAdminSetForceTwoFactorAuth(email, checked).then(res => {
      let userInfo = this.state.userInfo;
      userInfo.is_force_2fa = checked;
      this.setState({
        userInfo: userInfo
      });
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  render() {
    const { userInfo } = this.state;
    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel} />
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <Nav currentItem="info" email={this.props.email} userName={userInfo.name} />
            <div className="cur-view-content">
              <Content
                loading={this.state.loading}
                errorMsg={this.state.errorMsg}
                userInfo={this.state.userInfo}
                updateUser={this.updateUser}
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

User.propTypes = userPropTypes;

export default User;
