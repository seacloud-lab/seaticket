import React, { useCallback } from 'react';
import { Button } from 'reactstrap';
import TopBar from '../../../top-bar';
import { useTags, useTicketsPage } from '../../hooks';
import { EVENT_BUS_TYPE } from '../../../../constants';
import { TICKET_CHILDREN_PAGE_TYPE, TICKET_PAGE_TYPE } from '../../constants';
import { IconButton, Icon } from '@/components';
import { gettext } from '@/constants';

import './index.css';
import eventBus from '@/utils/event-bus';
import { getRowById } from '@/sea-metadata/utils/row';

const TicketTopBar = ({ title }) => {
  const { pageType, togglePageType, childrenPageType, toggleChildrenPageType } = useTicketsPage();
  const { tagsData } = useTags();

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
      if (childrenPageType === TICKET_CHILDREN_PAGE_TYPE.ALL) {
        return (
          <>
            {toggleBtn}
            <span className="text-truncate" title={gettext('Tags')}>{gettext('Tags')}</span>
          </>
        );
      }
      const tag = getRowById(tagsData, childrenPageType);
      const customTitle = gettext('Tags') + ' / ' + tag?.name;
      return (
        <>
          <IconButton icon="down" className="rotate-icon-90 sea-qa-project-toggle-tickets-btn" onClick={() => toggleChildrenPageType(TICKET_CHILDREN_PAGE_TYPE.ALL)} />
          <span className="text-truncate" title={customTitle}>{customTitle}</span>
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
  }, [pageType, childrenPageType, title, tagsData, togglePageType]);

  const renderRightChildren = useCallback(() => {
    if (pageType === TICKET_PAGE_TYPE.ALL) {
      return (
        <Button color="primary" className="sea-qa-project-add-ticket-btn" onClick={() => togglePageType(TICKET_PAGE_TYPE.NEW)}>
          <Icon symbol="add" className="mr-2" />
          {gettext('New ticket')}
        </Button>
      );
    }
    if (pageType === TICKET_PAGE_TYPE.TAGS && childrenPageType === TICKET_CHILDREN_PAGE_TYPE.ALL) {
      return (
        <Button color="primary" className="sea-qa-project-add-ticket-btn" onClick={() => eventBus.dispatch(EVENT_BUS_TYPE.NEW_TAG)}>
          <Icon symbol="add" className="mr-2" />
          {gettext('New tag')}
        </Button>
      );
    }
    return null;
  }, [pageType, childrenPageType, togglePageType]);

  return (
    <TopBar>
      {renderLeftChildren()}
      {renderRightChildren()}
    </TopBar>
  );
};

export default TicketTopBar;
