import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { toaster, Loading } from '../../components';
import { orgAdminServiceApi } from '../../api/org-admin-service-api';
import { Utils } from '../../utils/utils';
import MainPanelTopbar from './main-panel-topbar';
import Section from '../sys-admin/web-settings/section';
import CheckboxItem from '../sys-admin/web-settings/checkbox-item';
import { gettext, displayTwoFactorAuth } from '../../constants';

import '../../css/system-admin-web-settings.css';

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
    orgAdminServiceApi.orgAdminUpdateSettings(key, value).then(res => {
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
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel} />
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <h2 className="heading">{gettext('Settings')}</h2>
            <div className="cur-view-content container mw-100 px-4">
              {loading && <Loading />}
              {(!loading && settings && orgName) &&
              <Fragment>
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
