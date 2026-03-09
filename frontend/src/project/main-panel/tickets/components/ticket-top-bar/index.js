import React, { useCallback } from 'react';
import TopBar from '../../../top-bar';
import { useTicketsPage, useMetadata } from '../../hooks';
import { TICKET_CHILDREN_PAGE_SLUG_ID, TICKET_PAGE_SLUG_ID } from '../../constants';
import { EVENT_BUS_TYPE } from '@/project/constants/event-bus-type';
import { IconButton, IconTextBtn } from '@/components';
import { gettext, PERMISSION_TYPES } from '@/constants';
import eventBus from '@/utils/event-bus';
import { getRowById } from '@/sea-metadata/utils/row';
import { AddButton, RefreshBtn } from '@/project/components';
import { BAR_TYPE } from '@/project/constants';

import './index.css';

const TicketTopBar = ({ title, type, permission }) => {
  const { pageSlugId, togglePageSlugId, onRefresh, childrenPageSlugId } = useTicketsPage();
  const { typesData, substatesData } = useMetadata();

  const renderLeftChildren = useCallback(() => {
    if (pageSlugId === TICKET_PAGE_SLUG_ID.ALL) {
      return (
        <>
          <div className="text-truncate" title={title}>{title}</div>
          <RefreshBtn onClick={onRefresh} />
        </>
      );
    }

    const toggleBtn = (
      <IconButton
        icon="arrow-down"
        className="rotate-icon-90 sea-qa-project-toggle-tickets-btn"
        onClick={() => togglePageSlugId(TICKET_PAGE_SLUG_ID.ALL)}
      />
    );
    if (pageSlugId === TICKET_PAGE_SLUG_ID.TYPES) {
      if (childrenPageSlugId === TICKET_CHILDREN_PAGE_SLUG_ID.ALL) {
        return (<span className="text-truncate" title={gettext('Types')}>{gettext('Types')}</span>);
      }
      const type = getRowById(typesData, childrenPageSlugId);
      const customTitle = gettext('Types') + ' / ' + (type?.name || '');
      return (
        <>
          <IconButton
            icon="arrow-down"
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
        return (<span className="text-truncate" title={gettext('Substates')}>{gettext('Substates')}</span>);
      }
      const substate = getRowById(substatesData, childrenPageSlugId);
      const customTitle = gettext('Substates') + ' / ' + (substate?.name || '');
      return (
        <>
          <IconButton
            icon="arrow-down"
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
  }, [pageSlugId, childrenPageSlugId, title, typesData, substatesData, togglePageSlugId]);

  const renderRightChildren = useCallback(() => {
    const isRW = permission === PERMISSION_TYPES.READ_WRITE;
    if (pageSlugId === TICKET_PAGE_SLUG_ID.TYPES && childrenPageSlugId === TICKET_CHILDREN_PAGE_SLUG_ID.ALL) {
      if (!isRW) return null;
      return (
        <IconTextBtn icon="plus" onClick={() => eventBus.dispatch(EVENT_BUS_TYPE.NEW_TYPE)} text={gettext('New type')} />
      );
    }
    if (pageSlugId === TICKET_PAGE_SLUG_ID.SUBSTATES && childrenPageSlugId === TICKET_CHILDREN_PAGE_SLUG_ID.ALL) {
      if (!isRW) return null;
      return (
        <IconTextBtn icon="plus" onClick={() => eventBus.dispatch(EVENT_BUS_TYPE.NEW_SUBSTATE)} text={gettext('New substate')} />
      );
    }
    if (
      pageSlugId === TICKET_PAGE_SLUG_ID.TYPES ||
      pageSlugId === TICKET_PAGE_SLUG_ID.SUBSTATES ||
      pageSlugId === TICKET_PAGE_SLUG_ID.NEW
    ) return null;

    if (type === BAR_TYPE.MY_TICKET) return null;
    if (type === BAR_TYPE.TRASH) {
      if (!isRW) return null;
      return (
        <AddButton onClick={() => eventBus.dispatch(EVENT_BUS_TYPE.CLEAN_DELETED_TICKETS)} text={gettext('Clean')} icon="" />
      );
    }
    return (
      <IconTextBtn icon="all-tickets" onClick={() => togglePageSlugId(TICKET_PAGE_SLUG_ID.NEW)} text={gettext('New ticket')} />
    );
  }, [type, permission, pageSlugId, childrenPageSlugId, togglePageSlugId]);

  return (
    <TopBar>
      {renderLeftChildren()}
      {renderRightChildren()}
    </TopBar>
  );
};

export default TicketTopBar;
