import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { toaster, Loading, SectionSettings, AdminCheckboxSettings } from '@/components';
import orgAdminAPI from '../api';
import { Utils } from '@/utils/utils';
import { gettext, displayTwoFactorAuth } from '@/constants';
import { TopBar, Main } from '../main-panel';

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
    };
  }

  componentDidMount() {
    this.loadOrgInfo();
    this.loadSettings();
  }

  loadOrgInfo = () => {
    orgAdminAPI.orgAdminGetOrgInfo().then(res => {
      this.setState({ orgName: res.data.org_name });
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

  handleError = (error) => {
    let errMessage = Utils.getErrorMsg(error);
    toaster.danger(errMessage);
  };

  render() {
    let { loading, settings, orgName } = this.state;
    return (
      <>
        <TopBar onCloseSidePanel={this.props.onCloseSidePanel} />
        <Main title={gettext('Settings')}>
          {loading && <Loading />}
          {(!loading && settings && orgName) && (
            <>
              {displayTwoFactorAuth && (
                <SectionSettings title={gettext('Two factor authentication')}>
                  <AdminCheckboxSettings
                    onChange={this.saveSetting}
                    displayName={gettext('Enable force two factor authentication')}
                    keyText='enable_force_2fa'
                    value={settings['enable_force_2fa']}
                    helpTip={gettext('Enable force two factor authentication')}
                  />
                </SectionSettings>
              )}
              <SectionSettings title={gettext('User management')}>
                <AdminCheckboxSettings
                  onChange={this.saveSetting}
                  displayName={gettext('Enable sending email on adding users')}
                  keyText='enable_new_user_email'
                  value={settings['enable_new_user_email']}
                  helpTip={gettext('Enable sending email on adding users')}
                />
                <AdminCheckboxSettings
                  onChange={this.saveSetting}
                  displayName={gettext('Enable members modify their own name')}
                  keyText='enable_member_modify_name'
                  value={settings['enable_member_modify_name']}
                  helpTip={gettext('Enable members modify their own name')}
                />
              </SectionSettings>
            </>
          )}
        </Main>
      </>
    );
  }
}

OrgSettings.propTypes = propTypes;

export default OrgSettings;
