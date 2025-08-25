import React, { useCallback } from 'react';
import { Button } from 'reactstrap';
import TopBar from '../../../top-bar';
import { useTicketsPage } from '../../hooks';
import { TICKET_PAGE_TYPE } from '../../../../constants';
import { IconButton, Icon } from '@/components';
import { gettext } from '@/constants';

import './index.css';

const TicketTopBar = ({ title }) => {
  const { pageType, togglePageType } = useTicketsPage();

  const renderLeftChildren = useCallback(() => {
    if (pageType === TICKET_PAGE_TYPE.ALL) {
      return (
        <div className="w-100 text-truncate">{title}</div>
      );
    }

    const toggleBtn = (
      <IconButton icon="down" className="rotate-icon-90 sea-qa-project-toggle-tickets-btn" onClick={() => togglePageType(TICKET_PAGE_TYPE.ALL)} />
    );
    if (pageType === TICKET_PAGE_TYPE.TAGS) {
      return (
        <>
          {toggleBtn}
          <span className="text-truncate" title={gettext('Tags')}>{gettext('Tags')}</span>
        </>
      );
    }
    if (pageType === TICKET_PAGE_TYPE.NEW) {
      return (
        <>
          {toggleBtn}
          <span className="text-truncate" title={gettext('New ticket')}>{gettext('New ticket')}</span>
        </>
      );
    }
    const ticketTitle = gettext('Tickets') + ' / #' + pageType;
    return (
      <>
        {toggleBtn}
        <span className="text-truncate" title={ticketTitle}>{ticketTitle}</span>
      </>
    );
  }, [pageType, title, togglePageType]);

  const renderRightChildren = useCallback(() => {
    if (pageType === TICKET_PAGE_TYPE.ALL) {
      return (
        <Button color="primary" className="sea-qa-project-add-ticket-btn" onClick={() => togglePageType(TICKET_PAGE_TYPE.NEW)}>
          <Icon symbol="add" className="mr-2" />
          {gettext('New ticket')}
        </Button>
      );
    }
    return null;
  }, [pageType, togglePageType]);

  return (
    <TopBar>
      {renderLeftChildren()}
      {renderRightChildren()}
    </TopBar>
  );
};

export default TicketTopBar;
