import { dtableWebAPI } from '../../api/dtable-web-api';

class Context {

  constructor() {
    this.settings = this.getSettingFromTemplate();
  }

  getSettingFromTemplate = () => {
    const {
      workspaceID,
      dtableName,
      dtableUuid,
      dtableGroupId,
      token,
      workflowConfig,
      accessToken,
      dtableServer,
      workflowId,
      dtableWebURL,
    } = window.shared.pageOptions;
    const {
      username,
      password,
      server,
      lang,
    } = window.app.pageOptions;

    return {
      username,
      password,
      server,
      lang,
      workspaceID,
      dtableName,
      dtableUuid,
      dtableGroupId,
      token,
      appToken: token,
      appId: workflowId,
      appType: 'workflow',
      workflowConfig,
      accessToken,
      dtableServer,
      dtableBaiduMapKey: '1qRjaf9gprzfG6Kykg54jSzAEZZI0NZV',
      dtableWebURL,
    };
  };

  getConfig() {
    return this.settings;
  }

  getSetting(key) {
    if (this.settings[key] === false) return this.settings[key];
    return this.settings[key] || '';
  }

  updateWorkflow(newWorkflowConfig) {
    const token = this.getSetting('appToken');
    return dtableWebAPI.updateWorkflow(token, JSON.stringify(newWorkflowConfig));
  }

}

const context = new Context();

export default context;
