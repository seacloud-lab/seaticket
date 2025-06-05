import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Loading from '../../../components/loading';
import Group from '../../../models/group';
import User from '../../dtable/model/user';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import AppFormBaseSettings from './app-form-base-settings';
import AppFormThemeSettings from './app-form-theme-settings';
import { FORM_SETTINGS_TYPE } from '../../../constants/form-constants';

const gettext = window.gettext;
const { workspaceID, dtableName } = window.shared.pageOptions;

class AppFormSettings extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isSettingsLoaded: false,
      activeSettingsType: FORM_SETTINGS_TYPE.BASE,
      allGroups: [],
      relatedUsers: [],
    };
  }

  componentDidMount() {
    dtableWebAPI.getTableRelatedUsers(workspaceID, dtableName).then(res => {
      let relatedUsers = res.data ? res.data.user_list : [];
      relatedUsers = relatedUsers.map(item => {
        return new User(item);
      });
      this.setState({
        relatedUsers,
        isSettingsLoaded: true,
      });
    });
    dtableWebAPI.listGroups().then(res => {
      let groups = res.data || [];
      let allGroups = groups.map(group => {
        return new Group(group);
      });
      this.setState({ allGroups });
    });
  }

  activeSettingsTypeToggle = (activeSettingsType) => {
    if (activeSettingsType === this.state.activeSettingsType) return;
    this.setState({ activeSettingsType });
  };

  renderSettingsBody = () => {
    const { activeSettingsType, isSettingsLoaded, relatedUsers, allGroups } = this.state;
    if (!isSettingsLoaded) {
      return (
        <div className="d-flex justify-content-center align-items-center h-100">
          <Loading />
        </div>
      );
    }
    const { themeType, themeBackgroundColor, themeBackgroundImageURL,
      uploadThemeBackgroundImage, onThemeSettingsChange, ...rest } = this.props;
    if (activeSettingsType === FORM_SETTINGS_TYPE.BASE) {
      return (
        <AppFormBaseSettings
          { ...rest }
          relatedUsers={relatedUsers}
          allGroups={allGroups}
        />
      );
    }
    return (
      <AppFormThemeSettings
        themeType={themeType}
        themeBackgroundColor={themeBackgroundColor}
        themeBackgroundImageURL={themeBackgroundImageURL}
        onThemeSettingsChange={onThemeSettingsChange}
        uploadThemeBackgroundImage={uploadThemeBackgroundImage}
      />
    );
  };

  render() {
    const { activeSettingsType } = this.state;
    return (
      <div className="app-side-container">
        <div className="app-form-settings">
          <div className="app-form-settings-header">
            <div
              className={`app-form-settings-header-tab ${activeSettingsType === FORM_SETTINGS_TYPE.BASE ? 'active' : ''}`}
              onClick={() => this.activeSettingsTypeToggle(FORM_SETTINGS_TYPE.BASE)}
              title={gettext('Settings')}
            >
              {gettext('Settings')}
            </div>
            <div
              className={`app-form-settings-header-tab ml-4 ${activeSettingsType === FORM_SETTINGS_TYPE.THEME ? 'active' : ''}`}
              onClick={() => this.activeSettingsTypeToggle(FORM_SETTINGS_TYPE.THEME)}
              title={gettext('Theme')}
            >
              {gettext('Theme')}
            </div>
          </div>
          {this.renderSettingsBody()}
        </div>
      </div>
    );
  }
}

AppFormSettings.propTypes = {
  themeType: PropTypes.string,
  themeBackgroundColor: PropTypes.string,
  themeBackgroundImageURL: PropTypes.string,
  uploadThemeBackgroundImage: PropTypes.func,
  onThemeSettingsChange: PropTypes.func,
};

export default AppFormSettings;
