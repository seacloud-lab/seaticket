import React from 'react';
import TopBar from '../top-bar';
import SwitchSettingsItem from './switch-settings-item';
import LanguageSettings from './language-settings';
import { gettext } from '@/constants';
import PromptSettings from './prompt-settings';
import GitHubIssueTypeMappingSettings from './github-issue-type-mapping';

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
      {settings.agent?.enabled && (
        <GitHubIssueTypeMappingSettings
          className="mb-4"
          value={settings?.agent?.github_issue_type_mapping || {}}
          onChange={(value, callback) => modifySettings({
            agent: Object.assign({}, settings.agent, { github_issue_type_mapping: value }),
          }, callback)}
        />
      )}
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
