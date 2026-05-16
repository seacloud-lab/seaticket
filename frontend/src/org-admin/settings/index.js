import React from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { toaster, CenteredLoading, SectionSettings } from '@/components';
import ConfirmDeleteOrg from '@/components/dialog/confirm-delete-org';
import AdminCheckboxSettings from '@/components/settings/admin-checkbox-settings';
import orgAdminAPI from '../api';
import { Utils } from '@/utils/utils';
import { orgID, gettext, displayTwoFactorAuth, siteRoot, orgEnableAdminDeleteOrg } from '@/constants';
import { TopBar, Main } from '../main-panel';
import InputItem from './input-item';
import { validateName } from '@/utils/validate';

const propTypes = {
  onCloseSidePanel: PropTypes.func
};

class OrgSettings extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      settings: {},
      loading: true,
      orgName: '',
      isDeleteOrgDialogOpen: false,
      canDeleteOrg: orgEnableAdminDeleteOrg,
    };
  }

  componentDidMount() {
    this.loadOrgInfo();
    this.loadSettings();
  }

  loadOrgInfo = () => {
    orgAdminAPI.orgAdminGetOrgInfo().then(res => {
      this.setState({
        orgName: res.data.org_name,
      });
    }).catch(error => {
      this.handleError(error);
    });
  };

  loadSettings = () => {
    orgAdminAPI.orgAdminGetSettings().then(res => {
      this.setState({
        settings: res.data,
        loading: false
      });
    }).catch(error => {
      this.handleError(error);
    });
  };

  saveSetting = (key, value) => {
    orgAdminAPI.orgAdminUpdateSettings(key, value).then(res => {
      this.setState({ settings: res.data });
    }).catch(error => {
      this.handleError(error);
    });
  };

  updateName = (key, newOrgName) => {
    if (newOrgName === this.state.orgName) {
      return;
    }
    const { isValid, message } = validateName(newOrgName);
    if (!isValid) {
      toaster.danger(message);
      return;
    }
    orgAdminAPI.orgAdminUpdateName(orgID, message).then((res) => {
      this.setState({
        orgName: message
      });
      toaster.success(gettext('%s updated').replace('%s', gettext('Name')));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  handleError = (error) => {
    let errMessage = Utils.getErrorMsg(error);
    toaster.danger(errMessage);
  };

  toggleDeleteOrgDialog = () => {
    this.setState({ isDeleteOrgDialogOpen: !this.state.isDeleteOrgDialogOpen });
  };

  deleteOrg = () => {
    orgAdminAPI.orgAdminDeleteOrg(orgID).then(() => {
      toaster.success(gettext('%s deleted').replace('%s', gettext('Team')));
      window.location.href = siteRoot;
    }).catch((error) => {
      this.handleError(error);
    });
  };

  render() {
    let { loading, settings, orgName, isDeleteOrgDialogOpen, canDeleteOrg } = this.state;
    const deleteOrgMsg = gettext('Please type {placeholder} to confirm.').replace('{placeholder}', `<span class="op-target">${Utils.HTMLescape(orgName)}</span>`);
    return (
      <>
        <TopBar onCloseSidePanel={this.props.onCloseSidePanel} />
        <Main title={gettext('Settings')}>
          {loading && <CenteredLoading />}
          {(!loading && settings && orgName) && (
            <>
              <SectionSettings title={gettext('Info')}>
                <InputItem
                  saveSetting={this.updateName}
                  displayName={gettext('Team name')}
                  keyText='orgName'
                  value={orgName}
                  helpTip={''}
                  disabled={false}
                />
              </SectionSettings>
              {displayTwoFactorAuth && (
                <SectionSettings title={gettext('Two factor authentication')}>
                  <AdminCheckboxSettings
                    onChange={this.saveSetting}
                    keyText='enable_force_2fa'
                    value={settings['enable_force_2fa']}
                    helpTip={gettext('Enable force two factor authentication')}
                  />
                </SectionSettings>
              )}
              <SectionSettings title={gettext('User management')}>
                <AdminCheckboxSettings
                  onChange={this.saveSetting}
                  keyText='enable_new_user_email'
                  value={settings['enable_new_user_email']}
                  helpTip={gettext('Enable sending email on adding users')}
                />
                <AdminCheckboxSettings
                  onChange={this.saveSetting}
                  keyText='enable_member_modify_name'
                  value={settings['enable_member_modify_name']}
                  helpTip={gettext('Enable members modify their own name')}
                />
              </SectionSettings>
              {canDeleteOrg && (
                <SectionSettings title={gettext('Danger zone')}>
                  <div className="d-flex align-items-center justify-content-between flex-wrap">
                    <div className="mr-3">
                      <div className="font-weight-bold">{gettext('Delete team')}</div>
                      <div className="text-secondary">{gettext('Delete this team and all of its data permanently.')}</div>
                    </div>
                    <Button color="danger" onClick={this.toggleDeleteOrgDialog}>{gettext('Delete team')}</Button>
                  </div>
                </SectionSettings>
              )}
              {isDeleteOrgDialogOpen && (
                <ConfirmDeleteOrg
                  title={gettext('Delete team')}
                  message={deleteOrgMsg}
                  orgName={orgName}
                  executeOperation={this.deleteOrg}
                  toggleDialog={this.toggleDeleteOrgDialog}
                />
              )}
            </>
          )}
        </Main>
      </>
    );
  }
}

OrgSettings.propTypes = propTypes;

export default OrgSettings;
