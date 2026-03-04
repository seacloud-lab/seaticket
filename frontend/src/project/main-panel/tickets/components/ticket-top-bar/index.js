import React, { useCallback } from 'react';
import TopBar from '../../../top-bar';
import { useTicketsPage, useMetadata } from '../../hooks';
import { TICKET_CHILDREN_PAGE_SLUG_ID, TICKET_PAGE_SLUG_ID } from '../../constants';
import { EVENT_BUS_TYPE } from '@/project/constants/event-bus-type';
import { PathRedirection, IconTextBtn } from '@/components';
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
          <PathRedirection paths={[{ name: title }]} />
          <RefreshBtn onClick={onRefresh} />
        </>
      );
    }

    if (pageSlugId === TICKET_PAGE_SLUG_ID.TYPES) {
      if (childrenPageSlugId === TICKET_CHILDREN_PAGE_SLUG_ID.ALL) {
        return (<PathRedirection paths={[{ name: gettext('Types') }]} />);
      }
      const type = getRowById(typesData, childrenPageSlugId);
      const paths = [
        { name: gettext('Types'), callback: () => togglePageSlugId(pageSlugId, TICKET_CHILDREN_PAGE_SLUG_ID.ALL) },
        { name: type?.name || '' },
      ];
      return (<PathRedirection paths={paths} />);
    }

    if (pageSlugId === TICKET_PAGE_SLUG_ID.SUBSTATES) {
      if (childrenPageSlugId === TICKET_CHILDREN_PAGE_SLUG_ID.ALL) {
        return (<PathRedirection paths={[{ name: gettext('Substates') }]} />);
      }
      const substate = getRowById(substatesData, childrenPageSlugId);
      const paths = [
        { name: gettext('Substates'), callback: () => togglePageSlugId(pageSlugId, TICKET_CHILDREN_PAGE_SLUG_ID.ALL) },
        { name: substate?.name || '' },
      ];
      return (<PathRedirection paths={paths} />);
    }

    let paths = [
      { name: gettext('Tickets'), callback: () => togglePageSlugId(TICKET_PAGE_SLUG_ID.ALL) },
    ];

    if (pageSlugId === TICKET_PAGE_SLUG_ID.NEW) {
      paths.push({
        name: gettext('New ticket'),
      });
    } else {
      paths.push({
        name: '#' + pageSlugId,
      });
    }

    return (<PathRedirection paths={paths} />);
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
