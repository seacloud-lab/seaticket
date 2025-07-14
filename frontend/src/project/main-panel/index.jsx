import React, { useMemo } from 'react';
import { BAR_TYPE } from '../constants';
import Records from './records';
import { name, avatarURL, username } from '../../constants';
import Account from '../components/account';
import Search from './search';

import './index.css';

const MainPanelContainer = ({ activeBar }) => {
  if (!activeBar) return null;
  if (activeBar.key === BAR_TYPE.ASK) return null; // ask page
  if (activeBar.key === BAR_TYPE.SEARCH) return (<Search/>); // search page
  if (activeBar.key === BAR_TYPE.TICKETS) return null; // tickets page
  return (<Records type={activeBar.type} title={activeBar.name} />); // connections page
};

const MainPanelTopBar = ({ activeBar }) => {
  const user = useMemo(() => {
    return {
      name,
      username,
      avatar_url: avatarURL
    };
  }, []);
  return (
    <div className="sea-qa-project-panel-header sea-qa-project-main-panel-header">
      <div className="sea-qa-project-main-panel-header-left">
        <div className="sea-qa-project-main-panel-header-name">{activeBar?.name}</div>
      </div>
      <Account user={user} />
    </div>
  );
};

const MainPanel = ({ activeBar }) => {
  return (
    <div className="sea-qa-project-main-panel">
      <MainPanelTopBar activeBar={activeBar} />
      <MainPanelContainer activeBar={activeBar} />
    </div>
  );
};

export default MainPanel;
