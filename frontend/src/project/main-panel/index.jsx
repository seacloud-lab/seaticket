import React, { useMemo } from 'react';
import { BAR } from '../constants';
import Records from './records';
import { name, avatarURL, username } from '../../constants';
import Account from '../components/account';
import Search from './search';

import './index.css';

const MainPanelContainer = ({ activeBar }) => {
  if (!activeBar) return null;
  if (activeBar.key === BAR.ASK) return null; // ask page
  if (activeBar.key === BAR.SEARCH) return (<Search/>); // search page
  if (activeBar.key === BAR.TICKETS) return null; // tickets page
  return (<Records type={activeBar.type} title={activeBar.name} />);
};

const MainPanelTopBar = () => {
  const user = useMemo(() => {
    return {
      name,
      username,
      avatar_url: avatarURL
    };
  }, []);
  return (
    <div className="sea-qa-project-panel-header sea-qa-project-main-panel-header">
      <Account user={user} />
    </div>
  );
};

const MainPanel = ({ activeBar }) => {
  return (
    <div className="sea-qa-project-main-panel">
      <MainPanelTopBar />
      <MainPanelContainer activeBar={activeBar} />
    </div>
  );
};

export default MainPanel;
