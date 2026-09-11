import React from 'react';
import { CenteredLoading, CustomizeTabs } from '@/components';
import { useMetadata, useTags } from '@/project/hooks';
import { PORTAL_PAGE, TICKETS_TAB, TICKET_SECONDARY_TABS } from '../constants';
import PortalChat from './chat';
import PortalHome from './home';
import PortalKnowledgeBase from './knowledge-base/index';
import MyIssues from './my-issues';
import SubmitIssue from './submit-issue';

import './index.css';

const MainPanel = ({ activePage, onPageChange, onHomeChatSend, isAnonymous, ...props }) => {

  const { isLoading: isMetadataLoading } = useMetadata();
  const { isLoading: isTagsDataLoading } = useTags();

  const renderContent = () => {
    const isLoading = isMetadataLoading || isTagsDataLoading;

    if (isLoading) return (<CenteredLoading />);

    switch (activePage) {
      case PORTAL_PAGE.SUBMIT_ISSUE:
        return (
          <SubmitIssue
            { ...props }
            onPageChange={onPageChange}
          />
        );
      case PORTAL_PAGE.MY_ISSUES:
        return (
          <MyIssues { ...props } />
        );
      case PORTAL_PAGE.KNOWLEDGE_BASE:
        return <PortalKnowledgeBase { ...props } />;
      case PORTAL_PAGE.CHAT:
        return <PortalChat projectUuid={props.projectUuid} />;
      case PORTAL_PAGE.HOME:
        return <PortalHome { ...props } onHomeChatSend={onHomeChatSend} />;
      default:
        return null;
    }
  };

  const isIssuesPage = activePage === PORTAL_PAGE.SUBMIT_ISSUE || activePage === PORTAL_PAGE.MY_ISSUES;
  const activePrimaryTab = isIssuesPage ? TICKETS_TAB : activePage;
  const isHomePage = activePage === PORTAL_PAGE.HOME;

  return (
    <div className="seaqa-portal-main-panel" style={isHomePage ? { margin: 0, borderRadius: 0 } : {}}>
      {!isAnonymous && activePrimaryTab === TICKETS_TAB && (
        <div className="seaqa-portal-sub-navigation">
          <CustomizeTabs
            className="seaqa-portal-secondary-tabs"
            tabs={TICKET_SECONDARY_TABS}
            value={activePage}
            onChange={onPageChange}
          />
        </div>
      )}
      <div className="seaqa-portal-content">
        {renderContent()}
      </div>
    </div>
  );
};

export default MainPanel;
