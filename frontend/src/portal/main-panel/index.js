import React from 'react';
import { PORTAL_PAGE, TICKETS_TAB, TICKET_SECONDARY_TABS } from '../constants';
import SubmitIssue from './submit-issue';
import MyIssues from './my-issues';
import PortalKnowledgeBase from './knowledge-base/index';
import { useMetadata, useTags } from '@/project/hooks';
import { CenteredLoading, CustomizeTabs } from '@/components';
import PortalChat from './chat';

const MainPanel = ({ activePage, onPageChange, isAnonymous, ...props }) => {

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
      default:
        return null;
    }
  };

  const isIssuesPage = activePage === PORTAL_PAGE.SUBMIT_ISSUE || activePage === PORTAL_PAGE.MY_ISSUES;
  const activePrimaryTab = isIssuesPage ? TICKETS_TAB : activePage;

  return (
    <div className="sea-qa-portal-main-panel">
      {!isAnonymous && activePrimaryTab === TICKETS_TAB && (
        <div className="sea-qa-portal-sub-navigation">
          <CustomizeTabs
            className="sea-qa-portal-secondary-tabs"
            tabs={TICKET_SECONDARY_TABS}
            value={activePage}
            onChange={onPageChange}
          />
        </div>
      )}
      <div className="sea-qa-portal-content">
        {renderContent()}
      </div>
    </div>
  );
};

export default MainPanel;
