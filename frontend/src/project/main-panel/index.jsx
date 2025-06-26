import React, { useMemo } from 'react';
import { TAB } from '../constants';
import Sites from './sites';
import { name, avatarURL, username } from '../../constants';
import Account from '../components/account';

import './index.css';

const MainPanelContainer = ({ activeTab }) => {
  if (!activeTab) return null;
  if (activeTab === TAB.ASK) return null; // ask page
  if (activeTab === TAB.TICKETS) return null; // tickets page
  if (activeTab === TAB.EMAILS) return null; // emails page
  if (activeTab === TAB.DISCOURSE_FORUMS) return null;
  if (activeTab === TAB.GITHUB_ISSUES) return null;
  if (activeTab === TAB.SITES) return (<Sites />);
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

const MainPanel = ({ activeTab }) => {
  return (
    <div className="sea-qa-project-main-panel">
      <MainPanelTopBar />
      <MainPanelContainer activeTab={activeTab} />
    </div>
  );
};

export default MainPanel;
