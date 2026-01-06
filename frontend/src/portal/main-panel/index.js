import React from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { PORTAL_PAGE } from '../constants';
import SubmitTicket from './submit-ticket';
import MyTickets from './my-tickets';

const MainPanel = ({ activePage, projectUuid, onPageChange }) => {
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
    switch (activePage) {
      case PORTAL_PAGE.SUBMIT_TICKET:
        return <SubmitTicket projectUuid={projectUuid} onPageChange={onPageChange} />;
      case PORTAL_PAGE.MY_TICKETS:
        return <MyTickets projectUuid={projectUuid} />;
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
