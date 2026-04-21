import React from 'react';
import TopBar from '../top-bar';
import SwitchSettingsItem from './switch-settings-item';
import LanguageSettings from './language-settings';
import { gettext } from '@/constants';
import PromptSettings from './prompt-settings';
import GithubIssueTypeMappingSettings from './github-issue-type-mapping';

const Settings = ({
  title,
  settings,
  modifySettings,
}) => {

  return (
    <>
      <TopBar title={title}>
        <div className="w-100 text-truncate">{title}</div>
      </TopBar>
      <PromptSettings
        value={settings.prompt}
        onChange={(value, callback) => modifySettings({ prompt: value }, callback)}
        className="mb-4"
      />
      <SwitchSettingsItem
        title={gettext('Agent')}
        placeholder={gettext('Enable Agent')}
        tip={gettext('Enable agent to automatically analyze and process tickets, GitHub issues, etc.')}
        className="mb-4"
        value={settings.agent?.enabled}
        onChange={(value, callback) => modifySettings({ agent: Object.assign({}, settings.agent, { enabled: value }) }, callback)}
      />
      <GithubIssueTypeMappingSettings
        className="mb-4"
        agentSettings={settings.agent || {}}
        onChange={(github_issue_type_mapping, callback) => modifySettings({
          agent: Object.assign({}, settings.agent, { github_issue_type_mapping }),
        }, callback)}
      />
      <SwitchSettingsItem
        title={gettext('Chat')}
        placeholder={gettext('Streaming response')}
        tip={gettext('Enable streaming response')}
        className="mb-4"
        value={settings.streaming_response || false}
        onChange={(value, callback) => modifySettings({ streaming_response: value }, callback)}
      />
      <SwitchSettingsItem
        title={gettext('Developer mode')}
        placeholder={gettext('Developer mode')}
        tip={gettext('Enable developer mode to show advanced features for development and debugging purposes.')}
        value={settings.developer_mode || false}
        className="mb-4"
        onChange={(value, callback) => modifySettings({ developer_mode: value }, callback)}
      />
      <SwitchSettingsItem
        title={gettext('Support portal')}
        placeholder={gettext('Support portal')}
        tip={gettext('Enable support portal')}
        className="mb-4"
        value={settings.portal?.enable_portal || false}
        onChange={(value, callback) => modifySettings({ portal: Object.assign({}, settings.portal, { 'enable_portal': value }) }, callback)}
      />
      <LanguageSettings
        className="mb-4"
        title={gettext('Language for AI summary')}
        value={settings.lang || 'en'}
        onChange={(value, callback) => modifySettings({ lang: value }, callback)}
      />
    </>
  );
};

export default Settings;
