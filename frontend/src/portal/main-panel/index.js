import React from 'react';
import { CenteredLoading, CustomizeTabs } from '@/components';
import { gettext } from '@/constants';
import { useMetadata, useTags } from '@/project/hooks';
import { PORTAL_PAGE, TICKETS_TAB, TICKET_SECONDARY_TABS } from '../constants';
import PortalChat from './chat';
import PortalHome from './home';
import PortalKnowledgeBase from './knowledge-base/index';
import MyEmails from './my-emails';
import MyIssues from './my-issues';
import SubmitIssue from './submit-issue';

import './index.css';

const MainPanel = ({ activePage, onPageChange, onHomeChatSend, isAnonymous, isExternalUser, portalThemeColor, ...props }) => {

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
          <MyIssues key={PORTAL_PAGE.MY_ISSUES} { ...props } />
        );
      case PORTAL_PAGE.TEAM_ISSUES:
        return (
          <MyIssues key={PORTAL_PAGE.TEAM_ISSUES} { ...props } isTeam={true} />
        );
      case PORTAL_PAGE.EMAILS:
        return <MyEmails projectUuid={props.projectUuid} />;
      case PORTAL_PAGE.KNOWLEDGE_BASE:
        return <PortalKnowledgeBase { ...props } />;
      case PORTAL_PAGE.CHAT:
        return <PortalChat projectUuid={props.projectUuid} />;
      case PORTAL_PAGE.HOME:
        return (
          <PortalHome
            { ...props }
            onHomeChatSend={onHomeChatSend}
            portalThemeColor={portalThemeColor}
          />
        );
      default:
        return null;
    }
  };

  const isIssuesPage = [PORTAL_PAGE.SUBMIT_ISSUE, PORTAL_PAGE.MY_ISSUES, PORTAL_PAGE.TEAM_ISSUES].includes(activePage);
  const activePrimaryTab = isIssuesPage ? TICKETS_TAB : activePage;
  const isHomePage = activePage === PORTAL_PAGE.HOME;
  const ticketSecondaryTabs = isExternalUser ? TICKET_SECONDARY_TABS : TICKET_SECONDARY_TABS.filter(
    (tab) => tab.value !== PORTAL_PAGE.TEAM_ISSUES
  );

  return (
    <div className="seaqa-portal-main-panel" style={isHomePage ? { margin: 0, borderRadius: 0 } : {}}>
      {!isAnonymous && activePrimaryTab === TICKETS_TAB && (
        <div className="seaqa-portal-sub-navigation">
          <CustomizeTabs
            className="seaqa-portal-secondary-tabs"
            tabs={ticketSecondaryTabs}
            value={activePage}
            onChange={onPageChange}
          />
        </div>
      )}
      {activePage === PORTAL_PAGE.EMAILS && (
        <div className="seaqa-portal-sub-navigation">
          <CustomizeTabs
            className="seaqa-portal-secondary-tabs"
            tabs={[{ value: PORTAL_PAGE.EMAILS, label: gettext('My emails') }]}
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
