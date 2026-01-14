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
import { useNotification } from '@/components/common/notification/hooks/notification';
import { useMetadata } from './tickets/hooks';
import { useConnections } from './connections/hooks';
import { CenteredLoading } from '@/components';

import './index.css';

const Container = ({ activeBar, settings, modifySettings, toggleBar, modifyLocalBar }) => {
  const { isLoading: isMetadataLoading } = useMetadata();
  const { isLoading: isConnectionsLoading } = useConnections();
  const barKey = activeBar[0];
  if (!barKey) return (<TopBar />);
  if (isMetadataLoading || isConnectionsLoading) {
    return (
      <>
        <TopBar />
        <div className="flex-1 w-100">
          <CenteredLoading />
        </div>
      </>
    );
  }

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
    case BAR_TYPE.KNOWLEDGE:
    case BAR_TYPE.KNOWLEDGE_TRASH: {
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
      {showInboxDrawer && <Inbox toggleBar={props.toggleBar} />}
    </div>
  );
};

export default MainPanel;
