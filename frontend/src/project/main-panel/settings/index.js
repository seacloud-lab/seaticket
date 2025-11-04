import React from 'react';
import DeveloperModeSettings from './developer-mode-settings';
import TopBar from '../top-bar';

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
      <div className='sea-qa-project-settings w-100 pl-4 pr-4'>
        <DeveloperModeSettings
          value={settings.developer_mode}
          onChange={(value, callback) => modifySettings({ developer_mode: value }, callback)}
        />
      </div>
    </>
  );
};

export default Settings;
