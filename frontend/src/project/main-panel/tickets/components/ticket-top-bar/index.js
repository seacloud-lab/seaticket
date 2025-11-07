import React, { useCallback } from 'react';
import { Button } from 'reactstrap';
import TopBar from '../../../top-bar';
import { useTags, useTypes, useTicketsPage } from '../../hooks';
import { TICKET_CHILDREN_PAGE_TYPE, TICKET_PAGE_TYPE } from '../../constants';
import { EVENT_BUS_TYPE } from '@/project/constants/event-bus-type';
import { IconButton, Icon } from '@/components';
import { gettext } from '@/constants';
import eventBus from '@/utils/event-bus';
import { getRowById } from '@/sea-metadata/utils/row';
import context from '@/sea-metadata/context';
import { EVENT_BUS_TYPE as SEAMETADATA_EVENT_BUS_TYPE } from '@/sea-metadata/constants';

import './index.css';

const TicketTopBar = ({ title }) => {
  const { pageType, togglePageType, childrenPageType } = useTicketsPage();
  const { tagsData } = useTags();
  const { typesData } = useTypes();

  const renderLeftChildren = useCallback(() => {
    if (pageType === TICKET_PAGE_TYPE.ALL) {
      const eventBus = context.eventBus;
      return (
        <>
          <div className="text-truncate">{title}</div>
          <IconButton
            icon="down"
            className="sea-qa-project-refresh-tickets-btn"
            onClick={() => eventBus.dispatch(SEAMETADATA_EVENT_BUS_TYPE.RELOAD_DATA)}
          />
        </>
      );
    }

    const toggleBtn = (
      <IconButton
        icon="down"
        className="rotate-icon-90 sea-qa-project-toggle-tickets-btn"
        onClick={() => togglePageType(TICKET_PAGE_TYPE.ALL)}
      />
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
          <IconButton
            icon="down"
            className="rotate-icon-90 sea-qa-project-toggle-tickets-btn"
            onClick={() => togglePageType(pageType, TICKET_CHILDREN_PAGE_TYPE.ALL)}
          />
          <span className="text-truncate" title={customTitle}>{customTitle}</span>
        </>
      );
    }
    if (pageType === TICKET_PAGE_TYPE.TYPES) {
      if (childrenPageType === TICKET_CHILDREN_PAGE_TYPE.ALL) {
        return (
          <>
            {toggleBtn}
            <span className="text-truncate" title={gettext('Types')}>{gettext('Types')}</span>
          </>
        );
      }
      const type = getRowById(typesData, childrenPageType);
      const customTitle = gettext('Types') + ' / ' + type?.name;
      return (
        <>
          <IconButton
            icon="down"
            className="rotate-icon-90 sea-qa-project-toggle-tickets-btn"
            onClick={() => togglePageType(pageType, TICKET_CHILDREN_PAGE_TYPE.ALL)}
          />
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
    if (pageType === TICKET_PAGE_TYPE.TAGS && childrenPageType === TICKET_CHILDREN_PAGE_TYPE.ALL) {
      return (
        <Button color="primary" className="sea-qa-project-add-ticket-btn" onClick={() => eventBus.dispatch(EVENT_BUS_TYPE.NEW_TAG)}>
          <Icon symbol="add" className="mr-2" />
          {gettext('New tag')}
        </Button>
      );
    }
    if (pageType === TICKET_PAGE_TYPE.TYPES && childrenPageType === TICKET_CHILDREN_PAGE_TYPE.ALL) {
      return (
        <Button color="primary" className="sea-qa-project-add-ticket-btn" onClick={() => eventBus.dispatch(EVENT_BUS_TYPE.NEW_TYPE)}>
          <Icon symbol="add" className="mr-2" />
          {gettext('New type')}
        </Button>
      );
    }
    if (pageType === TICKET_PAGE_TYPE.TYPES || pageType === TICKET_PAGE_TYPE.TAGS || pageType === TICKET_PAGE_TYPE.NEW) return null;

    return (
      <Button color="primary" className="sea-qa-project-add-ticket-btn" onClick={() => togglePageType(TICKET_PAGE_TYPE.NEW)}>
        <Icon symbol="add" className="mr-2" />
        {gettext('New ticket')}
      </Button>
    );
  }, [pageType, childrenPageType, togglePageType]);

  return (
    <TopBar>
      {renderLeftChildren()}
      {renderRightChildren()}
    </TopBar>
  );
};

export default TicketTopBar;
