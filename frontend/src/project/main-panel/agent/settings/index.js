import React from 'react';
import SwitchSettingsItem from '../../settings/switch-settings-item';
import { gettext } from '@/constants';

import './index.css';

const AgentSettings = ({
  settings,
  updateSettings,
}) => {

  return (
    <div className="agent-settings">
      <SwitchSettingsItem
        title={gettext('Agent')}
        placeholder={gettext('Enable Agent')}
        tip={gettext('Enable agent to automatically analyze and process tickets, GitHub issues, etc.')}
        className="mb-4"
        value={settings.enabled}
        onChange={(value, callback) => updateSettings({ enabled: value }, callback)}
      />
    </div>
  );
};

export default AgentSettings;
