import React, { useCallback } from 'react';
import TopBar from '../../../top-bar';
import { useTicketsPage, useMetadata } from '../../hooks';
import { TICKET_CHILDREN_PAGE_SLUG_ID, TICKET_PAGE_SLUG_ID } from '../../constants';
import { EVENT_BUS_TYPE } from '@/project/constants/event-bus-type';
import { IconButton, IconTooltip } from '@/components';
import { gettext, PERMISSION_TYPES } from '@/constants';
import eventBus from '@/utils/event-bus';
import { getRowById } from '@/sea-metadata/utils/row';
import AddButton from '@/project/components/add-button';
import { BAR_TYPE } from '@/project/constants';
import Notification from '@/components/common/notifications';

import './index.css';

const { projectUuid } = window.app.pageOptions;

const TicketTopBar = ({ title, type, permission }) => {
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
        return <span className="text-truncate" title={gettext('Tags')}>{gettext('Tags')}</span>;
      }
      const tag = getRowById(tagsData, childrenPageSlugId);
      const customTitle = gettext('Tags') + ' / ' + (tag?.name || '');
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
        return <span className="text-truncate" title={gettext('Types')}>{gettext('Types')}</span>;
      }
      const type = getRowById(typesData, childrenPageSlugId);
      const customTitle = gettext('Types') + ' / ' + (type?.name || '');
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
        return <span className="text-truncate" title={gettext('Substates')}>{gettext('Substates')}</span>;
      }
      const substate = getRowById(substatesData, childrenPageSlugId);
      const customTitle = gettext('Substates') + ' / ' + (substate?.name || '');
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
  }, [pageSlugId, childrenPageSlugId, title, tagsData, typesData, substatesData, togglePageSlugId]);

  const renderRightChildren = useCallback(() => {
    const isRW = permission === PERMISSION_TYPES.READ_WRITE;
    if (pageSlugId === TICKET_PAGE_SLUG_ID.TAGS && childrenPageSlugId === TICKET_CHILDREN_PAGE_SLUG_ID.ALL) {
      if (!isRW) return null;
      return (
        <AddButton onClick={() => eventBus.dispatch(EVENT_BUS_TYPE.NEW_TAG)} text={gettext('New tag')} icon="add" />
      );
    }
    if (pageSlugId === TICKET_PAGE_SLUG_ID.TYPES && childrenPageSlugId === TICKET_CHILDREN_PAGE_SLUG_ID.ALL) {
      if (!isRW) return null;
      return (
        <AddButton onClick={() => eventBus.dispatch(EVENT_BUS_TYPE.NEW_TYPE)} text={gettext('New type')} icon="add" />
      );
    }
    if (pageSlugId === TICKET_PAGE_SLUG_ID.SUBSTATES && childrenPageSlugId === TICKET_CHILDREN_PAGE_SLUG_ID.ALL) {
      if (!isRW) return null;
      return (
        <AddButton onClick={() => eventBus.dispatch(EVENT_BUS_TYPE.NEW_SUBSTATE)} text={gettext('New substate')} icon="add" />
      );
    }
    if (
      pageSlugId === TICKET_PAGE_SLUG_ID.TYPES ||
      pageSlugId === TICKET_PAGE_SLUG_ID.SUBSTATES ||
      pageSlugId === TICKET_PAGE_SLUG_ID.TAGS ||
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
      <>
        <Notification mode="project" projectUuid={projectUuid} triggerId="ticket-notice-icon" targetId="ticket-notification-popover" />
        <AddButton onClick={() => togglePageSlugId(TICKET_PAGE_SLUG_ID.NEW)} text={gettext('New ticket')} icon="add" />
      </>
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
