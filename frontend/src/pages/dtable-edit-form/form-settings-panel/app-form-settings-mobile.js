import React, { Component } from 'react';
import Loading from '../../../components/loading';
import Group from '../../../models/group';
import User from '../../dtable/model/user';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import AppFormBaseSettings from './app-form-base-settings';

const gettext = window.gettext;
const { workspaceID, dtableName } = window.shared.pageOptions;

class AppFormSettingsMobile extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isSettingsLoaded: false,
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
        isSettingsLoaded: true
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

  renderSettingsBody = () => {
    const { isSettingsLoaded, relatedUsers, allGroups } = this.state;
    if (!isSettingsLoaded) {
      return <Loading />;
    }
    return (
      <AppFormBaseSettings
        { ...this.props }
        relatedUsers={relatedUsers}
        allGroups={allGroups}
      />
    );
  };

  render() {
    return (
      <div className="app-form-settings">
        <div className="app-form-settings-header app-form-settings-header-mobile">
          {gettext('Settings')}
        </div>
        {this.renderSettingsBody()}
      </div>
    );
  }
}

export default AppFormSettingsMobile;
