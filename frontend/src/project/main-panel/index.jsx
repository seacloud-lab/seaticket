import React from 'react';
import { TAB } from '../constants';
import Sites from './sites';

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

const MainPanel = ({ activeTab }) => {
  return (
    <div className="sea-qa-project-main-panel">
      <MainPanelContainer activeTab={activeTab} />
    </div>
  );
};

export default MainPanel;
