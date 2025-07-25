import React from 'react';
import { BAR_TYPE } from '../constants';
import Search from './search';
import Tickets from './tickets';
import Connections from './connections';
import TopBar from './top-bar';
import Ask from './ask';

import './index.css';

const Container = ({ activeBar }) => {
  if (!activeBar) return (<TopBar />);
  if (activeBar.key === BAR_TYPE.ASK) return (<Ask/>); // Question answering page
  if (activeBar.key === BAR_TYPE.SEARCH) return (<Search title={activeBar.name}/>); // search page
  if (activeBar.key === BAR_TYPE.TICKET) return (<Tickets title={activeBar.name} />); // tickets page
  return (<Connections title={activeBar.name} />); // connections page
};

const MainPanel = ({ activeBar }) => {
  return (
    <div className="sea-qa-project-main-panel">
      <Container activeBar={activeBar} />
    </div>
  );
};

export default MainPanel;
