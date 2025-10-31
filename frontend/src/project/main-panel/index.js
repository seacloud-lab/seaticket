import React from 'react';
import { BAR_TYPE, BAR_TYPES } from '../constants';
import Search from './search';
import Tickets from './tickets';
import Connections from './connections';
import TopBar from './top-bar';
import Ask from './ask';

import './index.css';

const Container = ({ activeBar, settings }) => {
  const barKey = activeBar[0];
  if (!barKey) return (<TopBar />);
  const bar = BAR_TYPES.find(b => b.key === barKey);
  const title = bar.name;
  if (barKey === BAR_TYPE.CHAT) return (<Ask title={title}/>); // Question answering page
  if (barKey === BAR_TYPE.SEARCH) return (<Search title={title} settings={settings} />); // search page
  if (barKey === BAR_TYPE.TICKET) return (<Tickets title={title} />); // tickets page
  return (<Connections title={title} />); // connections page
};

const MainPanel = ({ activeBar, settings }) => {
  return (
    <div className="sea-qa-project-main-panel">
      <Container activeBar={activeBar} settings={settings} />
    </div>
  );
};

export default MainPanel;
