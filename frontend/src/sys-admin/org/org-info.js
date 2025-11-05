import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { toaster, Loading, IconButton } from '@/components';
import { Utils } from '@/utils/utils';
import { validateName } from '@/utils/validate';
import { loginUrl, gettext } from '@/constants';
import SysAdminSetOrgNameDialog from '@/sys-admin/dialog/sysadmin-set-org-name-dialog';
import SysAdminSetOrgMaxUserNumberDialog from '@/sys-admin/dialog/sysadmin-set-org-max-user-number-dialog';
import OrgNav from './org-nav';
import OrgTitle from './org-title';
import { Main, TopBar } from '../main-panel';
import SetQuotaDialog from '@/sys-admin/dialog/set-quota';
import SetAPICallsLimitPerUser from '@/sys-admin/dialog/set-api-calls-limit-per-user';
import sysAdminAPI from '@/sys-admin/api';

const contentPropTypes = {
  orgID: PropTypes.string.isRequired,
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  orgInfo: PropTypes.object.isRequired,
  updateQuota: PropTypes.func.isRequired,
  updateName: PropTypes.func.isRequired,
  updateMaxUserNumber: PropTypes.func.isRequired,
  updateAPICallsLimitPerUser: PropTypes.func,
};

class Content extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isSetNameDialogOpen: false,
      isSetMaxUserNumberDialogOpen: false,
      isSetQuotaDialogOpen: false,
      isSetAPICallsLimitPerUserDialogOpen: false
    };
  }

  toggleSetNameDialog = () => {
    this.setState({ isSetNameDialogOpen: !this.state.isSetNameDialogOpen });
  };

  toggleSetMaxUserNumberDialog = () => {
    this.setState({ isSetMaxUserNumberDialogOpen: !this.state.isSetMaxUserNumberDialogOpen });
  };

  toggleSetQuotaDialog = () => {
    this.setState({ isSetQuotaDialogOpen: !this.state.isSetQuotaDialogOpen });
  };

  toggleAPICallsLimitPerUserDialog = () => {
    this.setState({ isSetAPICallsLimitPerUserDialogOpen: !this.state.isSetAPICallsLimitPerUserDialogOpen });
  };

  showEditIcon = (action) => {
    return (
      <IconButton
        title={gettext('Edit')}
        aria-label={gettext('Edit')}
        className="attr-action-icon"
        icon="rename"
        onClick={action}
        style={{ display: 'inline-flex' }}
      />
    );
  };

  updateQuota = (value) => {
    this.props.updateQuota(value);
  };

  updateAPICallsLimitPerUser = (value) => {
    this.props.updateAPICallsLimitPerUser(value);
  };

  render() {
    const { loading, errorMsg, orgInfo } = this.props;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center">{errorMsg}</p>;
    } else {
      const { org_name, users_count, max_user_number, groups_count,
        api_calls_count, monthly_api_call_limit_per_user } = orgInfo;
      const { isSetNameDialogOpen, isSetMaxUserNumberDialogOpen, isSetQuotaDialogOpen,
        isSetAPICallsLimitPerUserDialogOpen } = this.state;
      return (
        <Fragment>
          <dl className="m-0">
            <dt className="info-item-heading">{gettext('Name')}</dt>
            <dd className="info-item-content">
              {org_name}
              {this.showEditIcon(this.toggleSetNameDialog)}
            </dd>

            <dt className="info-item-heading">{gettext('Number of members')}</dt>
            <dd className="info-item-content">{users_count}</dd>

            {max_user_number &&
              <Fragment>
                <dt className="info-item-heading">{gettext('Max number of members')}</dt>
                <dd className="info-item-content">
                  {max_user_number}
                  {this.showEditIcon(this.toggleSetMaxUserNumberDialog)}
                </dd>
              </Fragment>
            }

            <dt className="info-item-heading">{gettext('Number of groups')}</dt>
            <dd className="info-item-content">{groups_count}</dd>

            <dt className="info-item-heading">{gettext('API calls count')}</dt>
            <dd className="info-item-content">
              {api_calls_count}
            </dd>

            <dt className="info-item-heading">{gettext('API calls limit per user')}</dt>
            <dd className="info-item-content">
              {monthly_api_call_limit_per_user > 0 ? monthly_api_call_limit_per_user : '--'}
              {this.showEditIcon(this.toggleAPICallsLimitPerUserDialog)}
            </dd>
          </dl>
          {isSetNameDialogOpen &&
            <SysAdminSetOrgNameDialog
              name={org_name}
              updateName={this.props.updateName}
              toggle={this.toggleSetNameDialog}
            />
          }
          {isSetMaxUserNumberDialogOpen &&
            <SysAdminSetOrgMaxUserNumberDialog
              value={max_user_number}
              updateValue={this.props.updateMaxUserNumber}
              toggle={this.toggleSetMaxUserNumberDialog}
            />
          }
          {isSetQuotaDialogOpen && (
            <SetQuotaDialog
              toggle={this.toggleSetQuotaDialog}
              updateQuota={this.updateQuota}
            />
          )}
          {isSetAPICallsLimitPerUserDialogOpen && (
            <SetAPICallsLimitPerUser
              toggle={this.toggleAPICallsLimitPerUserDialog}
              updateLimit={this.updateAPICallsLimitPerUser}
            />
          )}

        </Fragment>
      );
    }
  }
}

Content.propTypes = contentPropTypes;

const orgInfoPropTypes = {
  orgID: PropTypes.string,
  onCloseSidePanel: PropTypes.func
};

class OrgInfo extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      orgInfo: {}
    };
  }

  componentDidMount() {
    sysAdminAPI.sysAdminGetOrg(this.props.orgID).then((res) => {
      this.setState({
        loading: false,
        orgInfo: res.data
      });
    }).catch((error) => {
      if (error.response) {
        if (error.response.status === 403) {
          this.setState({
            loading: false,
            errorMsg: gettext('Permission denied')
          });
          location.href = `${loginUrl}?next=${encodeURIComponent(location.href)}`;
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

  updateQuota = (quota) => {
    const data = { assetQuotaMb: quota };
    sysAdminAPI.sysAdminUpdateOrg(this.props.orgID, data).then(res => {
      const newOrgInfo = Object.assign(this.state.orgInfo, {
        storage_quota: res.data.storage_quota
      });
      this.setState({ orgInfo: newOrgInfo });
      toaster.success(gettext('Successfully set quota.'));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  updateName = (orgName) => {
    let response = validateName(orgName);
    if (!response.isValid) {
      toaster.danger(response.message);
      return;
    }
    const data = { orgName: response.message };
    sysAdminAPI.sysAdminUpdateOrg(this.props.orgID, data).then(res => {
      const newOrgInfo = Object.assign(this.state.orgInfo, {
        org_name: res.data.org_name
      });
      this.setState({ orgInfo: newOrgInfo });
      toaster.success(gettext('Successfully set name.'));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  updateMaxUserNumber = (newValue) => {
    const data = { maxUserNumber: newValue };
    sysAdminAPI.sysAdminUpdateOrg(this.props.orgID, data).then(res => {
      const newOrgInfo = Object.assign(this.state.orgInfo, {
        max_user_number: res.data.max_user_number
      });
      this.setState({ orgInfo: newOrgInfo });
      toaster.success(gettext('Successfully set max number of members.'));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  updateAPICallsLimitPerUser = (newValue) => {
    const data = { monthlyAPICallLimitPerUser: newValue };
    sysAdminAPI.sysAdminUpdateOrg(this.props.orgID, data).then(res => {
      const newOrgInfo = Object.assign(this.state.orgInfo, {
        monthly_api_call_limit_per_user: res.data.monthly_api_call_limit_per_user
      });
      this.setState({ orgInfo: newOrgInfo });
      toaster.success(gettext('Successfully set API calls limit per user.'));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  render() {
    const { orgInfo } = this.state;
    return (
      <Fragment>
        <TopBar onCloseSidePanel={this.props.onCloseSidePanel} />
        <Main title={(<OrgTitle orgName={orgInfo.org_name} />)}>
          <OrgNav currentItem="info" orgID={this.props.orgID} />
          <Content
            orgID={this.props.orgID}
            loading={this.state.loading}
            errorMsg={this.state.errorMsg}
            orgInfo={this.state.orgInfo}
            updateQuota={this.updateQuota}
            updateName={this.updateName}
            updateMaxUserNumber={this.updateMaxUserNumber}
            updateAPICallsLimitPerUser={this.updateAPICallsLimitPerUser}
          />
        </Main>
      </Fragment>
    );
  }
}

OrgInfo.propTypes = orgInfoPropTypes;

export default OrgInfo;
