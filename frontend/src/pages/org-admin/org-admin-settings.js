import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import { orgAdminServiceApi } from '../../api/org-admin-service-api';
import { Utils, validateName } from '../../utils/utils';
import MainPanelTopbar from './main-panel-topbar';
import Section from '../sys-admin/web-settings/section';
import CheckboxItem from '../sys-admin/web-settings/checkbox-item';
import InputItem from '../sys-admin/web-settings/input-item';
import { gettext, displayTwoFactorAuth, enableOrgLogo } from '../../utils/constants';
import Loading from '../../components/loading';
import '../../css/system-admin-web-settings.css';
import OrgLogoForm from './org-logo-form';

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
    orgAdminServiceApi.orgAdminGetOrgInfo().then(res => {
      this.setState({ orgName: res.data.org_name });
    }).catch(error => {
      this.handleError(error);
    });
  };

  loadSettings = () => {
    orgAdminServiceApi.orgAdminGetSettings().then(res => {
      this.setState({
        settings: res.data,
        loading: false
      });
    }).catch(error => {
      this.handleError(error);
    });
  };

  saveSetting = (key, value) => {
    if (key === 'orgName') {
      let response = validateName(value);
      if (!response.isValid) {
        toaster.danger(response.message);
        return;
      }
      const newOrgName = response.message;
      orgAdminServiceApi.orgAdminUpdateOrgInfo(newOrgName).then((res) => {
        this.setState({ orgName: newOrgName });
        toaster.success(gettext('Successfully set name.'));
      }).catch((error) => {
        this.handleError(error);
      });
    } else {
      orgAdminServiceApi.orgAdminUpdateSettings(key, value).then(res => {
        this.setState({ settings: res.data });
      }).catch(error => {
        this.handleError(error);
      });
    }
  };

  handleError = (error) => {
    let errMessage = Utils.getErrorMsg(error);
    toaster.danger(errMessage);
  };

  render() {
    let { loading, settings, orgName } = this.state;
    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel} />
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <h2 className="heading">{gettext('Settings')}</h2>
            <div className="cur-view-content container mw-100 px-4">
              {loading && <Loading />}
              {(!loading && settings && orgName) &&
              <Fragment>
                <Section headingText={gettext('Info')}>
                  <InputItem
                    saveSetting={this.saveSetting}
                    displayName={gettext('Team name')}
                    keyText='orgName'
                    value={orgName}
                    helpTip={''}
                  />
                  {enableOrgLogo && <OrgLogoForm />}
                </Section>
                {displayTwoFactorAuth &&
                <Section headingText={gettext('Two factor authentication')}>
                  <CheckboxItem
                    saveSetting={this.saveSetting}
                    displayName={gettext('Enable force two factor authentication')}
                    keyText='enable_force_2fa'
                    value={settings['enable_force_2fa']}
                    helpTip={gettext('Enable force two factor authentication')}
                  />
                </Section>
                }
                <Section headingText={gettext('User management')}>
                  <CheckboxItem
                    saveSetting={this.saveSetting}
                    displayName={gettext('Enable sending email on adding users')}
                    keyText='enable_new_user_email'
                    value={settings['enable_new_user_email']}
                    helpTip={gettext('Enable sending email on adding users')}
                  />
                  <CheckboxItem
                    saveSetting={this.saveSetting}
                    displayName={gettext('Enable members modify their own name')}
                    keyText='enable_member_modify_name'
                    value={settings['enable_member_modify_name']}
                    helpTip={gettext('Enable members modify their own name')}
                  />
                </Section>
                <Section headingText={gettext('Base management')}>
                  <CheckboxItem
                    saveSetting={this.saveSetting}
                    displayName={gettext('Enable sharing bases to external users via invite links')}
                    keyText='enable_external_user_access_invite_link'
                    value={settings['enable_external_user_access_invite_link']}
                    helpTip={gettext('Enable sharing bases to external users via invite links')}
                  />
                </Section>
              </Fragment>
              }
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

OrgSettings.propTypes = propTypes;

export default OrgSettings;
