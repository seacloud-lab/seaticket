import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import { Utils } from '../../../utils/utils';
import { gettext, mediaUrl, logoPath, loginBGPath } from '../../../constants';
import Loading from '../../../components/loading';
import MainPanelTopbar from '../main-panel-topbar';
import Section from './section';
import InputItem from './input-item';
import FileItem from './file-item';
import CheckboxItem from './checkbox-item';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';

import '../../../css/system-admin-web-settings.css';

const propTypes = {
  onCloseSidePanel: PropTypes.func.isRequired,
};

class WebSettings extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      config_dict: null,
      logoPath: mediaUrl + logoPath,
      loginBGPath: mediaUrl + loginBGPath
    };
  }

  componentDidMount() {
    sysAdminServiceApi.sysAdminGetSysSettingInfo().then((res) => {
      this.setState({
        loading: false,
        config_dict: res.data
      });
    }).catch((error) => {
      this.setState({
        loading: false,
        errorMsg: Utils.getErrorMsg(error, true) // true: show login tip if 403
      });
    });
  }

  saveSetting = (key, value) => {
    sysAdminServiceApi.sysAdminSetSysSettingInfo(key, value).then((res) => {
      this.setState({
        config_dict: res.data
      });
      toaster.success(gettext('Setting saved'));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  postFile = (file, fileType) => {
    let postFile;
    if (fileType === 'Logo') {
      postFile = sysAdminServiceApi.sysAdminUpdateLogo(file);
    } else if (fileType === 'loginBGImage') {
      postFile = sysAdminServiceApi.sysAdminUpdateLoginBG(file);
    }
    postFile.then((res) => {
      if (fileType === 'Logo') {
        this.setState({
          logoPath: res.data.logo_path
        });
      } else if (fileType === 'loginBGImage') {
        this.setState({
          loginBGPath: res.data.login_bg_image_path
        });
      }
      toaster.success(gettext('Setting saved'));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  render() {
    const { loading, errorMsg, config_dict, logoPath, loginBGPath } = this.state;
    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel}/>
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <h2 className="heading">{gettext('Settings')}</h2>
            <div className="cur-view-content container mw-100 px-4">
              {loading && <Loading />}
              {errorMsg && <p className="error text-center mt-4">{errorMsg}</p>}
              {(!loading && !errorMsg) && config_dict &&
              <Fragment>
                <p className="seatable-tip-default my-4">{gettext('Note: Settings via web interface are saved in database table (dtable-db/constance_config). They have a higher priority over the settings in config files.')}</p>

                <Section headingText={gettext('Branding')}>
                  <Fragment>
                    <InputItem
                      saveSetting={this.saveSetting}
                      displayName='SITE_TITLE'
                      keyText='SITE_TITLE'
                      value={config_dict['SITE_TITLE']}
                      helpTip={gettext('Site title shown in a browser tab')}
                    />
                    <InputItem
                      saveSetting={this.saveSetting}
                      displayName='SITE_NAME'
                      keyText='SITE_NAME'
                      value={config_dict['SITE_NAME']}
                      helpTip={gettext('Site name used in email sending')}
                    />
                    <FileItem
                      postFile={this.postFile}
                      displayName='Logo'
                      keyText='Logo'
                      filePath={logoPath}
                      fileWidth={256}
                      fileHeight={64}
                      helpTip='logo.png, 256px * 64px'
                    />
                    <FileItem
                      postFile={this.postFile}
                      displayName={gettext('Login background image')}
                      keyText='loginBGImage'
                      filePath={loginBGPath}
                      fileWidth={240}
                      fileHeight={160}
                      helpTip='login-bg.jpg, 2400px * 1600px'
                    />
                    <CheckboxItem
                      saveSetting={this.saveSetting}
                      displayName='ENABLE_BRANDING_CSS'
                      keyText='ENABLE_BRANDING_CSS'
                      value={config_dict['ENABLE_BRANDING_CSS']}
                      helpTip={gettext('Use custom CSS')}
                    />
                    <InputItem
                      inputType="textarea"
                      saveSetting={this.saveSetting}
                      displayName={gettext('Custom CSS')}
                      keyText='CUSTOM_CSS'
                      value={config_dict['CUSTOM_CSS']}
                      helpTip=''
                    />
                  </Fragment>
                </Section>

                <Section headingText={gettext('User')}>
                  <Fragment>
                    <CheckboxItem
                      saveSetting={this.saveSetting}
                      displayName={gettext('activate after registration')}
                      keyText='ACTIVATE_AFTER_REGISTRATION'
                      value={config_dict['ACTIVATE_AFTER_REGISTRATION']}
                      helpTip={gettext('Activate user immediately after registration. If unchecked, a user need to be activated by administrator or via activation email')}
                    />
                    <CheckboxItem
                      saveSetting={this.saveSetting}
                      displayName={gettext('send activation email')}
                      keyText='REGISTRATION_SEND_MAIL'
                      value={config_dict['REGISTRATION_SEND_MAIL']}
                      helpTip={gettext('Send activation email after user registration.')}
                    />
                    <InputItem
                      saveSetting={this.saveSetting}
                      displayName={gettext('keep sign in')}
                      keyText='LOGIN_REMEMBER_DAYS'
                      value={config_dict['LOGIN_REMEMBER_DAYS']}
                      helpTip={gettext('Number of days that keep user sign in.')}
                    />
                    <InputItem
                      saveSetting={this.saveSetting}
                      displayName='LOGIN_ATTEMPT_LIMIT'
                      keyText='LOGIN_ATTEMPT_LIMIT'
                      value={config_dict['LOGIN_ATTEMPT_LIMIT']}
                      helpTip={gettext('The maximum number of failed login attempts before showing CAPTCHA.')}
                    />
                    <CheckboxItem
                      saveSetting={this.saveSetting}
                      displayName='FREEZE_USER_ON_LOGIN_FAILED'
                      keyText='FREEZE_USER_ON_LOGIN_FAILED'
                      value={config_dict['FREEZE_USER_ON_LOGIN_FAILED']}
                      helpTip={gettext('Freeze user account when failed login attempts exceed limit.')}
                    />
                  </Fragment>
                </Section>

                <Section headingText={gettext('Password')}>
                  <Fragment>
                    <CheckboxItem
                      saveSetting={this.saveSetting}
                      displayName='strong password'
                      keyText='USER_STRONG_PASSWORD_REQUIRED'
                      value={config_dict['USER_STRONG_PASSWORD_REQUIRED']}
                      helpTip={gettext('Force user to use a strong password when sign up or change password.')}
                    />
                    <CheckboxItem
                      saveSetting={this.saveSetting}
                      displayName='force password change'
                      keyText='FORCE_PASSWORD_CHANGE'
                      value={config_dict['FORCE_PASSWORD_CHANGE']}
                      helpTip={gettext('Force user to change password when account is newly added or reset by admin')}
                    />
                    <CheckboxItem
                      saveSetting={this.saveSetting}
                      displayName='enable two factor authentication'
                      keyText='ENABLE_TWO_FACTOR_AUTH'
                      value={config_dict['ENABLE_TWO_FACTOR_AUTH']}
                      helpTip={gettext('Enable two factor authentication')}
                    />
                  </Fragment>
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

WebSettings.propTypes = propTypes;

export default WebSettings;
