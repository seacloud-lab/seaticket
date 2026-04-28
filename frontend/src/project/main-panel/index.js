import React from 'react';
import { BAR_TYPE, BAR_TYPE_CONFIG } from '../constants';
import Search from './search';
import Tickets from './tickets';
import Connections from './connections';
import TopBar from './top-bar';
import Ask from './ask';
import Agent from './agent';
import Settings from './settings';
import KnowledgeBase from './knowledge-base';
import Analyze from './analyze';
import Tags from './tags';
import Inbox from './inbox';
import SupportPortal from './support-portal';
import PortalIssues from './portal-issues';
import { useNotification } from '@/components/common/notification/hooks/notification';
import { useTags, useMetadata } from '../hooks';
import { useConnections } from './connections/hooks';
import { CenteredLoading } from '@/components';

import './index.css';

const Container = ({ activeBar, settings, modifySettings, toggleBar, modifyLocalBar }) => {
  const { isLoading: isMetadataLoading } = useMetadata();
  const { isLoading: isConnectionsLoading } = useConnections();
  const { isLoading: isTagsLoading } = useTags();
  const barKey = activeBar[0];
  if (!barKey) return (<TopBar />);
  if (isMetadataLoading || isConnectionsLoading || isTagsLoading) {
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
    case BAR_TYPE.AGENT: {
      return (<Agent title={title} />);
    }
    case BAR_TYPE.SEARCH: {
      return (<Search title={title} settings={settings} />);
    }
    case BAR_TYPE.TICKET:
    case BAR_TYPE.MY_TICKET:
    case BAR_TYPE.NEW_TICKET:
    case BAR_TYPE.TRASH:
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
    case BAR_TYPE.TAGS: {
      return (<Tags title={title} />);
    }
    case BAR_TYPE.SUPPORT_PORTAL: {
      return (<SupportPortal title={title} />);
    }
    case BAR_TYPE.PORTAL_ISSUES:
    case BAR_TYPE.PORTAL_ISSUES_TRASH:
    case BAR_TYPE.PORTAL_ISSUE_TYPES:
    case BAR_TYPE.PORTAL_ISSUE_SUBSTATES: {
      return (<PortalIssues key={barKey} title={title} toggleBar={toggleBar} type={barKey} />);
    }
    default:
      return (<Connections title={title} toggleBar={toggleBar} modifyLocalBar={modifyLocalBar} />);
  }
};

const MainPanel = (props) => {
  const { showInboxDrawer } = useNotification();

  return (
    <div className="sea-qa-project-main-panel">
      <div className="sea-qa-project-main-panel-content">
        <Container { ...props } />
        {showInboxDrawer && <Inbox toggleBar={props.toggleBar} />}
      </div>
    </div>
  );
};

export default MainPanel;
