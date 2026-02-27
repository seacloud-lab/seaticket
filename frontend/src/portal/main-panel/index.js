import React from 'react';
import { gettext } from '@/constants';
import { PORTAL_PAGE } from '../constants';
import SubmitTicket from './submit-ticket';
import MyTickets from './my-tickets';
import PortalKnowledgeBase from './knowledge-base/index';
import { useMetadata, useTags } from '@/project/hooks';
import { CenteredLoading } from '@/components';
import PortalChat from './chat';

const MainPanel = ({ activePage, onPageChange, ...props }) => {

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

  return (
    <div className="sea-qa-portal-main-panel">
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
