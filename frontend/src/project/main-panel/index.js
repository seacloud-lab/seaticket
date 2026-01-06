import React from 'react';
import { BAR_TYPE, BAR_TYPE_CONFIG } from '../constants';
import Search from './search';
import Tickets from './tickets';
import Connections from './connections';
import TopBar from './top-bar';
import Ask from './ask';
import Settings from './settings';
import KnowledgeBase from './knowledge-base';
import Analyze from './analyze';
import Inbox from './inbox';
import { useNotification } from '@/sea-metadata';
import { gettext } from '@/constants';

import './index.css';

const Container = ({ activeBar, settings, modifySettings, toggleBar, modifyLocalBar }) => {
  const barKey = activeBar[0];
  if (!barKey) return (<TopBar />);
  const bar = BAR_TYPE_CONFIG[barKey];
  const title = bar.name;
  switch (barKey) {
    case BAR_TYPE.CHAT: {
      return (<Ask title={title} settings={settings}/>);
    }
    case BAR_TYPE.SEARCH: {
      return (<Search title={title} settings={settings} />);
    }
    case BAR_TYPE.TICKET:
    case BAR_TYPE.MY_TICKET:
    case BAR_TYPE.TRASH:
    case BAR_TYPE.TAGS:
    case BAR_TYPE.SUBSTATES:
    case BAR_TYPE.TYPES: {
      return (<Tickets key={barKey} title={title} toggleBar={toggleBar} type={barKey} />);
    }
    case BAR_TYPE.SETTINGS: {
      return (<Settings title={title} settings={settings} modifySettings={modifySettings} />);
    }
    case BAR_TYPE.KNOWLEDGE: {
      return (<KnowledgeBase title={title} />);
    }
    case BAR_TYPE.ANALYZE: {
      return (<Analyze title={title} />);
    }
    default:
      return (<Connections title={title} toggleBar={toggleBar} modifyLocalBar={modifyLocalBar} />);
  }
};

const MainPanel = (props) => {
  const { showInboxDrawer } = useNotification();

  return (
    <div className="sea-qa-project-main-panel">
      <Container { ...props } />
      {showInboxDrawer && <Inbox title={gettext('Inbox')} />}
    </div>
  );
};

export default MainPanel;
