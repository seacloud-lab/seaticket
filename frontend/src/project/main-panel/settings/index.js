import React from 'react';
import TopBar from '../top-bar';
import SwitchSettingsItem from './switch-settings-item';
import { gettext } from '@/constants';

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
      <SwitchSettingsItem
        title={gettext('Chat')}
        placeholder={gettext('Streaming response')}
        tip={gettext('Enable streaming response')}
        className="mb-4"
        value={settings.streaming_response}
        onChange={(value, callback) => modifySettings({ streaming_response: value }, callback)}
      />
      <SwitchSettingsItem
        title={gettext('Developer mode')}
        placeholder={gettext('Developer mode')}
        tip={gettext('Enable developer mode to show advanced features for development and debugging purposes.')}
        value={settings.developer_mode}
        onChange={(value, callback) => modifySettings({ developer_mode: value }, callback)}
      />
    </>
  );
};

export default Settings;
