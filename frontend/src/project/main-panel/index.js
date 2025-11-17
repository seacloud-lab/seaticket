import React from 'react';
import { BAR_TYPE, BAR_TYPES } from '../constants';
import Search from './search';
import Tickets from './tickets';
import Connections from './connections';
import TopBar from './top-bar';
import Ask from './ask';
import Settings from './settings';
import KnowledgeBase from './knowledge-base';

import './index.css';

const Container = ({ activeBar, settings, modifySettings }) => {
  const barKey = activeBar[0];
  if (!barKey) return (<TopBar />);
  const bar = BAR_TYPES.find(b => b.key === barKey);
  const title = bar.name;
  if (barKey === BAR_TYPE.CHAT) return (<Ask title={title} settings={settings}/>); // Question answering page
  if (barKey === BAR_TYPE.SEARCH) return (<Search title={title} settings={settings} />); // search page
  if (barKey === BAR_TYPE.TICKET) return (<Tickets title={title} />); // tickets page
  if (barKey === BAR_TYPE.SETTINGS) return (<Settings title={title} settings={settings} modifySettings={modifySettings} />); // settings page
  if (barKey === BAR_TYPE.KNOWLEDGE) return (<KnowledgeBase title={title} />);
  return (<Connections title={title} />); // connections page
};

const MainPanel = ({ activeBar, settings, modifySettings }) => {
  return (
    <div className="sea-qa-project-main-panel">
      <Container activeBar={activeBar} settings={settings} modifySettings={modifySettings} />
    </div>
  );
};

export default MainPanel;
