import React, { useCallback, useEffect, useState } from 'react';
import TopBar from '../top-bar';
import LanguageSettings from './language-settings';
import { gettext } from '@/constants';
import PromptSettings from './prompt-settings';
import GitHubIssueTypeMappingSettings from './github-issue-type-mapping';
import AgentAutoConfirmSettings from './agent-auto-confirm-settings';
import { SETTINGS_TAB_TYPE, SETTINGS_TABS } from './constants';
import { CustomizeTabs } from '@/components';
import SettingsItem from './settings-item';
import SwitchSettings from './switch-settings';

import './index.css';

const Settings = ({
  title,
  settings,
  modifySettings,
}) => {
  const [tab, setTab] = useState(SETTINGS_TAB_TYPE.GENERAL);

  const handleTab = useCallback((tab) => {
    setTab(tab);
    const url = `${location.origin}${location.pathname}?tab=${tab}`;
    history.replaceState(null, null, url);
  }, []);

  useEffect(() => {
    const currentUrlParams = new URLSearchParams(window.location.search);
    let initTab = currentUrlParams.get('tab');
    initTab = initTab === SETTINGS_TAB_TYPE.AGENT ? SETTINGS_TAB_TYPE.AGENT : SETTINGS_TAB_TYPE.GENERAL;
    handleTab(initTab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <TopBar title={title}>
        <div className="w-100 text-truncate">{title}</div>
      </TopBar>
      <div className="seaqa-project-settings-body o-hidden d-flex flex-column flex-1 w-100">
        <CustomizeTabs
          className="seaqa-project-settings-tabs"
          tabs={SETTINGS_TABS}
          value={tab}
          onChange={handleTab}
        />
        <div className="seaqa-project-settings-body-container flex-1 w-100 d-flex flex-column">
          {tab === SETTINGS_TAB_TYPE.GENERAL && (
            <>
              <PromptSettings
                value={settings.prompt}
                dialogTitle={settings.prompt ? gettext('Edit prompt') : gettext('Add prompt')}
                onChange={(value, callback) => modifySettings({ prompt: value }, callback)}
              />
              <SettingsItem title={gettext('Support portal')}>
                <SwitchSettings
                  placeholder={gettext('Support portal')}
                  tip={gettext('Enable support portal')}
                  value={settings.portal?.enable_portal || false}
                  onChange={(value, callback) => modifySettings({ portal: Object.assign({}, settings.portal, { 'enable_portal': value }) }, callback)}
                />
              </SettingsItem>
              {settings.portal?.enable_portal && (
                <PromptSettings
                  value={settings.portal?.chat_prompt || ''}
                  title={gettext('Portal chat prompt')}
                  tip={gettext('Define rules for AI conversations with external support portal users.')}
                  dialogTitle={settings.portal?.chat_prompt ? gettext('Edit portal chat prompt') : gettext('Add portal chat prompt')}
                  placeholder={gettext('Define rules for AI conversations with external support portal users. Specify response tone, information boundaries, escalation guidance, and any topics the AI should avoid.')}
                  validationMessage={gettext('Portal chat prompt cannot contain tag-like content such as <system-reminder>.')}
                  onChange={(value, callback) => modifySettings({
                    portal: Object.assign({}, settings.portal, { chat_prompt: value }),
                  }, callback)}
                />
              )}
              <LanguageSettings
                value={settings.lang || 'en'}
                onChange={(value, callback) => modifySettings({ lang: value }, callback)}
              />
            </>
          )}
          {tab === SETTINGS_TAB_TYPE.AGENT && (
            <>
              <SettingsItem title={gettext('Enable Agent')}>
                <SwitchSettings
                  placeholder={gettext('Enable Agent')}
                  tip={gettext('Enable agent to automatically analyze and process tickets, GitHub issues, etc.')}
                  value={settings.agent?.enabled}
                  onChange={(value, callback) => modifySettings({ agent: Object.assign({}, settings.agent, { enabled: value }) }, callback)}
                />
              </SettingsItem>
              {settings.agent?.enabled && (
                <>
                  <PromptSettings
                    value={settings?.agent?.ticket_rules || ''}
                    onChange={(value, callback) => modifySettings({
                      agent: Object.assign({}, settings.agent, { ticket_rules: value }),
                    }, callback)}
                    className='ticket-agent-rules-settings'
                    title={gettext('Ticket processing rules')}
                    tip={gettext('Define your own additional rules for ticket processing in natural-language.')}
                    dialogTitle={(settings?.agent?.ticket_rules || '') ? gettext('Edit ticket processing rules') : gettext('Add ticket processing rules')}
                    placeholder={gettext('Example:\n1) If due soon and substate is Waiting on user, do not send reminder.\n2) If over due and substate is Waiting on user, suggest closing the ticket.')}
                    maxLength={4000}
                    validationMessage={gettext('Ticket processing rules cannot contain tag-like content such as <system-reminder>.')}
                  />
                  <AgentAutoConfirmSettings
                    value={settings?.agent?.auto_confirm || {}}
                    onChange={(value, callback) => modifySettings({
                      agent: Object.assign({}, settings.agent, { auto_confirm: value }),
                    }, callback)}
                  />
                  <GitHubIssueTypeMappingSettings
                    value={settings?.agent?.github_issue_type_mapping || {}}
                    onChange={(value, callback) => modifySettings({
                      agent: Object.assign({}, settings.agent, { github_issue_type_mapping: value }),
                    }, callback)}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>

    </>
  );
};

export default Settings;
