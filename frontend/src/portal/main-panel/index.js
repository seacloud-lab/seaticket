import React from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { PORTAL_PAGE } from '../constants';
import SubmitTicket from './submit-ticket';
import MyTickets from './my-tickets';
import KnowledgeBase from './knowledge-base';
import { useMetadata, useTags } from '@/project/hooks';
import { CenteredLoading } from '@/components';

const MainPanel = ({ activePage, projectUuid, onPageChange }) => {

  const { isLoading: isMetadataLoading, typesData } = useMetadata();
  const { isLoading: isTagsDataLoading, tagsData } = useTags();

  const getTitle = () => {
    switch (activePage) {
      case PORTAL_PAGE.SUBMIT_TICKET:
        return gettext('Submit ticket');
      case PORTAL_PAGE.MY_TICKETS:
        return gettext('My tickets');
      case PORTAL_PAGE.KNOWLEDGE_BASE:
        return gettext('Knowledge base');
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
            projectUuid={projectUuid}
            onPageChange={onPageChange}
            typesData={typesData}
          />
        );
      case PORTAL_PAGE.MY_TICKETS:
        return (
          <MyTickets
            projectUuid={projectUuid}
            tagsData={tagsData}
            typesData={typesData}
          />
        );
      case PORTAL_PAGE.KNOWLEDGE_BASE:
        return <KnowledgeBase projectUuid={projectUuid} />;
      default:
        return null;
    }
  };

  const needPadding = activePage === PORTAL_PAGE.SUBMIT_TICKET;

  return (
    <div className="sea-qa-portal-main-panel">
      <div className="sea-qa-portal-top-bar">
        {getTitle()}
      </div>
      <div className={classnames('sea-qa-portal-content', { 'with-padding': needPadding })}>
        {renderContent()}
      </div>
    </div>
  );
};

export default MainPanel;
