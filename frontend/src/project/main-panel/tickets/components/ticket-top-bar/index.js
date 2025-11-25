import React, { useCallback } from 'react';
import { Button } from 'reactstrap';
import TopBar from '../../../top-bar';
import { useTicketsPage, useMetadata } from '../../hooks';
import { TICKET_CHILDREN_PAGE_SLUG_ID, TICKET_PAGE_SLUG_ID } from '../../constants';
import { EVENT_BUS_TYPE } from '@/project/constants/event-bus-type';
import { IconButton, Icon, IconTooltip } from '@/components';
import { gettext } from '@/constants';
import eventBus from '@/utils/event-bus';
import { getRowById } from '@/sea-metadata/utils/row';

import './index.css';

const TicketTopBar = ({ title, isMyTicket }) => {
  const { pageSlugId, togglePageSlugId, onRefresh, childrenPageSlugId } = useTicketsPage();
  const { tagsData, typesData, substatesData } = useMetadata();

  const renderLeftChildren = useCallback(() => {
    if (pageSlugId === TICKET_PAGE_SLUG_ID.ALL) {
      return (
        <>
          <div className="text-truncate">{title}</div>
          <IconTooltip
            icon="refresh"
            tip={gettext('Refresh')}
            className="sea-qa-project-refresh-tickets-btn"
            placement="bottom"
            hoverBackground={true}
            onClick={onRefresh}
          />
        </>
      );
    }

    const toggleBtn = (
      <IconButton
        icon="down"
        className="rotate-icon-90 sea-qa-project-toggle-tickets-btn"
        onClick={() => togglePageSlugId(TICKET_PAGE_SLUG_ID.ALL)}
      />
    );
    if (pageSlugId === TICKET_PAGE_SLUG_ID.TAGS) {
      if (childrenPageSlugId === TICKET_CHILDREN_PAGE_SLUG_ID.ALL) {
        return (
          <>
            {toggleBtn}
            <span className="text-truncate" title={gettext('Tags')}>{gettext('Tags')}</span>
          </>
        );
      }
      const tag = getRowById(tagsData, childrenPageSlugId);
      const customTitle = gettext('Tags') + ' / ' + tag?.name;
      return (
        <>
          <IconButton
            icon="down"
            className="rotate-icon-90 sea-qa-project-toggle-tickets-btn"
            onClick={() => togglePageSlugId(pageSlugId, TICKET_CHILDREN_PAGE_SLUG_ID.ALL)}
          />
          <span className="text-truncate" title={customTitle}>{customTitle}</span>
        </>
      );
    }
    if (pageSlugId === TICKET_PAGE_SLUG_ID.TYPES) {
      if (childrenPageSlugId === TICKET_CHILDREN_PAGE_SLUG_ID.ALL) {
        return (
          <>
            {toggleBtn}
            <span className="text-truncate" title={gettext('Types')}>{gettext('Types')}</span>
          </>
        );
      }
      const type = getRowById(typesData, childrenPageSlugId);
      const customTitle = gettext('Types') + ' / ' + type?.name;
      return (
        <>
          <IconButton
            icon="down"
            className="rotate-icon-90 sea-qa-project-toggle-tickets-btn"
            onClick={() => togglePageSlugId(pageSlugId, TICKET_CHILDREN_PAGE_SLUG_ID.ALL)}
          />
          <span className="text-truncate" title={customTitle}>{customTitle}</span>
        </>
      );
    }
    if (pageSlugId === TICKET_PAGE_SLUG_ID.NEW) {
      return (
        <>
          {toggleBtn}
          <span className="text-truncate" title={gettext('New ticket')}>{gettext('New ticket')}</span>
        </>
      );
    }
    if (pageSlugId === TICKET_PAGE_SLUG_ID.SUBSTATES) {
      if (childrenPageSlugId === TICKET_CHILDREN_PAGE_SLUG_ID.ALL) {
        return (
          <>
            {toggleBtn}
            <span className="text-truncate" title={gettext('Substates')}>{gettext('Substates')}</span>
          </>
        );
      }
      const substate = getRowById(substatesData, childrenPageSlugId);
      const customTitle = gettext('Substates') + ' / ' + substate?.name;
      return (
        <>
          <IconButton
            icon="down"
            className="rotate-icon-90 sea-qa-project-toggle-tickets-btn"
            onClick={() => togglePageSlugId(pageSlugId, TICKET_CHILDREN_PAGE_SLUG_ID.ALL)}
          />
          <span className="text-truncate" title={customTitle}>{customTitle}</span>
        </>
      );
    }
    const ticketTitle = gettext('Tickets') + ' / #' + pageSlugId;
    return (
      <>
        {toggleBtn}
        <span className="text-truncate" title={ticketTitle}>{ticketTitle}</span>
      </>
    );
  }, [pageSlugId, childrenPageSlugId, title, tagsData, togglePageSlugId]);

  const renderRightChildren = useCallback(() => {
    if (pageSlugId === TICKET_PAGE_SLUG_ID.TAGS && childrenPageSlugId === TICKET_CHILDREN_PAGE_SLUG_ID.ALL) {
      return (
        <Button color="primary" className="sea-qa-project-add-ticket-btn" onClick={() => eventBus.dispatch(EVENT_BUS_TYPE.NEW_TAG)}>
          <Icon symbol="add" className="mr-2" />
          {gettext('New tag')}
        </Button>
      );
    }
    if (pageSlugId === TICKET_PAGE_SLUG_ID.TYPES && childrenPageSlugId === TICKET_CHILDREN_PAGE_SLUG_ID.ALL) {
      return (
        <Button color="primary" className="sea-qa-project-add-ticket-btn" onClick={() => eventBus.dispatch(EVENT_BUS_TYPE.NEW_TYPE)}>
          <Icon symbol="add" className="mr-2" />
          {gettext('New type')}
        </Button>
      );
    }
    if (pageSlugId === TICKET_PAGE_SLUG_ID.SUBSTATES && childrenPageSlugId === TICKET_CHILDREN_PAGE_SLUG_ID.ALL) {
      return (
        <Button color="primary" className="sea-qa-project-add-ticket-btn" onClick={() => eventBus.dispatch(EVENT_BUS_TYPE.NEW_SUBSTATE)}>
          <Icon symbol="add" className="mr-2" />
          {gettext('New substate')}
        </Button>
      );
    }
    if (pageSlugId === TICKET_PAGE_SLUG_ID.TYPES || pageSlugId === TICKET_PAGE_SLUG_ID.TAGS || pageSlugId === TICKET_PAGE_SLUG_ID.NEW) return null;

    return (
      <Button color="primary" className="sea-qa-project-add-ticket-btn" onClick={() => togglePageSlugId(TICKET_PAGE_SLUG_ID.NEW)}>
        <Icon symbol="add" className="mr-2" />
        {gettext('New ticket')}
      </Button>
    );
  }, [pageSlugId, childrenPageSlugId, togglePageSlugId]);

  return (
    <TopBar>
      {renderLeftChildren()}
      {!isMyTicket && renderRightChildren()}
    </TopBar>
  );
};

export default TicketTopBar;
