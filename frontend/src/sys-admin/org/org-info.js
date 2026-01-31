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
import sysAdminAPI from '@/sys-admin/api';

const contentPropTypes = {
  orgID: PropTypes.string.isRequired,
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  orgInfo: PropTypes.object.isRequired,
  updateName: PropTypes.func.isRequired,
  updateMaxUserNumber: PropTypes.func.isRequired,
};

class Content extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isSetNameDialogOpen: false,
      isSetMaxUserNumberDialogOpen: false,
    };
  }

  toggleSetNameDialog = () => {
    this.setState({ isSetNameDialogOpen: !this.state.isSetNameDialogOpen });
  };

  toggleSetMaxUserNumberDialog = () => {
    this.setState({ isSetMaxUserNumberDialogOpen: !this.state.isSetMaxUserNumberDialogOpen });
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

  render() {
    const { loading, errorMsg, orgInfo } = this.props;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center">{errorMsg}</p>;
    } else {
      const { org_name, users_count, max_user_number, groups_count } = orgInfo;
      const { isSetNameDialogOpen, isSetMaxUserNumberDialogOpen } = this.state;
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
      toaster.success(gettext('%s updated').replace('%s', gettext('Name')));
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
      toaster.success(gettext('%s updated').replace('%s', 'Max number of members'));
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
            updateName={this.updateName}
            updateMaxUserNumber={this.updateMaxUserNumber}
          />
        </Main>
      </Fragment>
    );
  }
}

OrgInfo.propTypes = orgInfoPropTypes;

export default OrgInfo;
