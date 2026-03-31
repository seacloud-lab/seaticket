import React from 'react';
import { gettext } from '@/constants';
import { PORTAL_PAGE, TICKETS_TAB, TICKET_SECONDARY_TABS } from '../constants';
import SubmitTicket from './submit-ticket';
import MyTickets from './my-tickets';
import PortalKnowledgeBase from './knowledge-base/index';
import { useMetadata, useTags } from '@/project/hooks';
import { CenteredLoading, CustomizeTabs } from '@/components';
import PortalChat from './chat';

const MainPanel = ({ activePage, onPageChange, isAnonymous, ...props }) => {

  const { isLoading: isMetadataLoading, typesData } = useMetadata();
  const { isLoading: isTagsDataLoading } = useTags();

  const getTitle = () => {
    switch (activePage) {
      case PORTAL_PAGE.SUBMIT_TICKET:
        return gettext('Submit ticket');
      case PORTAL_PAGE.MY_TICKETS:
        return gettext('My tickets');
      default:
        return '';
    }
  };

  const renderContent = () => {
    const isLoading = isMetadataLoading || isTagsDataLoading;

    if (isLoading) return (<CenteredLoading />);

    switch (activePage) {
      case PORTAL_PAGE.SUBMIT_TICKET:
        return (
          <SubmitTicket
            { ...props }
            onPageChange={onPageChange}
            typesData={typesData}
          />
        );
      case PORTAL_PAGE.MY_TICKETS:
        return (
          <MyTickets { ...props } />
        );
      case PORTAL_PAGE.KNOWLEDGE_BASE:
        return <PortalKnowledgeBase { ...props } />;
      case PORTAL_PAGE.CHAT:
        return <PortalChat projectUuid={props.projectUuid} />;
      default:
        return null;
    }
  };
  const isChat = activePage === PORTAL_PAGE.CHAT;
  const isTicketsPage = activePage === PORTAL_PAGE.SUBMIT_TICKET || activePage === PORTAL_PAGE.MY_TICKETS;
  const activePrimaryTab = isTicketsPage ? TICKETS_TAB : activePage;

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
      {activePage !== PORTAL_PAGE.KNOWLEDGE_BASE && !isChat && (
        <div className="sea-qa-portal-top-bar">
          {getTitle()}
        </div>
      )}
      <div className="sea-qa-portal-content">
        {renderContent()}
      </div>
    </div>
  );
};

export default MainPanel;
