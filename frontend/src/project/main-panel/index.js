import React from 'react';
import { BAR_TYPE } from '../constants';
import Records from './records';
import Search from './search';
import Tickets from './tickets';
import TopBar from './top-bar';
import Ask from './ask';

import './index.css';

const Container = ({ activeBar }) => {
  if (!activeBar) return (<TopBar />);
  if (activeBar.key === BAR_TYPE.ASK) return (<Ask/>); // Question answering page
  if (activeBar.key === BAR_TYPE.SEARCH) return (<Search title={activeBar.name}/>); // search page
  if (activeBar.key === BAR_TYPE.TICKET) return (<Tickets title={activeBar.name} />); // tickets page
  return (<Records type={activeBar.type} title={activeBar.name} />); // connections page
};

const MainPanel = ({ activeBar }) => {
  return (
    <div className="sea-qa-project-main-panel">
      <Container activeBar={activeBar} />
    </div>
  );
};

export default MainPanel;
