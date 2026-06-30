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
        <>
          <GitHubIssueTypeMappingSettings
            className="mb-4"
            value={settings?.agent?.github_issue_type_mapping || {}}
            onChange={(value, callback) => modifySettings({
              agent: Object.assign({}, settings.agent, { github_issue_type_mapping: value }),
            }, callback)}
          />
          <PromptSettings
            value={settings?.agent?.ticket_rules || ''}
            onChange={(value, callback) => modifySettings({
              agent: Object.assign({}, settings.agent, { ticket_rules: value }),
            }, callback)}
            className='mb-4 ticket-agent-rules-settings'
            title={gettext('Ticket processing rules')}
            tip={gettext('Define natural-language rules for ticket reminders and ticket-closing suggestions. These rules only apply to tickets.')}
            dialogTitle={gettext('Edit Ticket Processing Rules')}
            placeholder={gettext('Example:\n1) If due soon and substate is Waiting on user, do not send reminder.\n2) If over due and substate is Waiting on user, suggest closing the ticket.')}
            maxLength={4000}
            validationMessage={gettext('Ticket processing rules cannot contain tag-like content such as <system-reminder>.')}
          />
        </>
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
