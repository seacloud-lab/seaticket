import React, { useMemo, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { gettext } from '../constants';
import SidePanel from './side-panel';
import MainPanel from './main-panel';
import { TAB } from './constants';

import './index.css';

const Project = () => {
  const [activeTab, setActiveTab] = useState(TAB.SITES);

  const tabs = useMemo(() => {
    return [
      {
        key: 'a',
        name: '',
        children: [
          { key: TAB.ASK, name: gettext('Ask') },
          { key: TAB.SEARCH, name: gettext('Search') },
          { key: TAB.TICKETS, name: gettext('Tickets') }
        ]
      }, {
        key: 'connections',
        name: gettext('Connections'),
        children: [
          { key: TAB.EMAILS, name: gettext('Emails') },
          { key: TAB.GITHUB_ISSUES, name: gettext('Github issues') },
          { key: TAB.DISCOURSE_FORUMS, name: gettext('Discourse forums') },
          { key: TAB.SITES, name: gettext('Sites') },
        ]
      }
    ];
  }, []);

  const toggleTab = useCallback((tab) => {
    if (activeTab === tab) return;
    setActiveTab(tab);
  }, [activeTab]);

  return (
    <div className="sea-qa-project">
      <SidePanel tabs={tabs} activeTab={activeTab} toggleTab={toggleTab} />
      <MainPanel activeTab={activeTab} />
    </div>
  );
};

const root = createRoot(document.getElementById('wrapper'));
root.render(<Project />);
