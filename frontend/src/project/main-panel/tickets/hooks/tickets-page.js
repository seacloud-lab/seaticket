import React, { useContext, useEffect, useState, useCallback } from 'react';
import { isNumber } from '@//utils/type-detection';
import { BAR_TYPE, EVENT_BUS_TYPE } from '../../../constants';
import { TICKET_PAGE_SLUG_ID, TICKET_CHILDREN_PAGE_SLUG_ID } from '../constants';
import context from '@/sea-metadata/context';
import eventBus from '@//utils/event-bus';
import { Utils } from '@/utils/utils';
import { EVENT_BUS_TYPE as SEAMETADATA_EVENT_BUS_TYPE } from '@/sea-metadata/constants';

const TicketsPageContext = React.createContext(null);

export const TicketsPageProvider = ({ workspaceID, projectName, children }) => {
  const [isLoading, setLoading] = useState(true);
  const [pageSlugId, setPageSlugId] = useState(TICKET_PAGE_SLUG_ID.ALL);
  const [childrenPageSlugId, setChildrenPageSlugId] = useState(TICKET_CHILDREN_PAGE_SLUG_ID.ALL);
  const [viewID, setViewID] = useState('');

  const resetURL = useCallback((pageSlugId, childrenPageSlugId, viewID) => {
    const { origin } = location;
    let url = `${origin}/workspace/${workspaceID}/project/${projectName}/${BAR_TYPE.TICKET}`;
    let urlPart = pageSlugId === TICKET_PAGE_SLUG_ID.ALL || (!pageSlugId && pageSlugId !== 0) ? '/' : `/${pageSlugId}/`;
    if (pageSlugId === TICKET_PAGE_SLUG_ID.ALL && viewID) {
      urlPart = urlPart + '?view=' + viewID;
    }
    if (pageSlugId === TICKET_PAGE_SLUG_ID.TAGS && childrenPageSlugId !== TICKET_CHILDREN_PAGE_SLUG_ID.ALL) {
      urlPart = urlPart + childrenPageSlugId + '/';
    }
    if (pageSlugId === TICKET_PAGE_SLUG_ID.TYPES && childrenPageSlugId !== TICKET_CHILDREN_PAGE_SLUG_ID.ALL) {
      urlPart = urlPart + childrenPageSlugId + '/';
    }
    if (pageSlugId === TICKET_PAGE_SLUG_ID.SUBSTATES && childrenPageSlugId !== TICKET_CHILDREN_PAGE_SLUG_ID.ALL) {
      urlPart = urlPart + childrenPageSlugId + '/';
    }
    history.replaceState(null, null, url + urlPart);
  }, [workspaceID]);

  const togglePageSlugId = useCallback((newPageSlugId, newChildrenPageSlugId = TICKET_CHILDREN_PAGE_SLUG_ID.ALL) => {
    if (pageSlugId !== newPageSlugId) {
      setPageSlugId(newPageSlugId);
    }
    if (childrenPageSlugId !== newChildrenPageSlugId) {
      setChildrenPageSlugId(newChildrenPageSlugId);
    }
  }, [pageSlugId, childrenPageSlugId]);

  const onRefresh = Utils.debounce(useCallback(() => {
    const eventBus = context.eventBus;
    eventBus.dispatch(SEAMETADATA_EVENT_BUS_TYPE.RELOAD_DATA);
  }, []), 300);

  // init page
  useEffect(() => {
    const { pathname } = location;
    const decodePathname = decodeURIComponent(pathname);
    const part = `/project/${projectName}/`;
    const projectNameIndex = decodePathname.indexOf(part);
    const paramsString = decodePathname.slice(projectNameIndex + part.length);
    const params = paramsString.split('/');
    const [, pageTypeFromURL = '', childrenPageSlugIdFromURL = ''] = params;
    let pageSlugId = TICKET_PAGE_SLUG_ID.ALL;
    let childrenPageSlugId = TICKET_CHILDREN_PAGE_SLUG_ID.ALL;
    if (pageTypeFromURL === TICKET_PAGE_SLUG_ID.NEW) {
      pageSlugId = TICKET_PAGE_SLUG_ID.NEW;
    } else if (pageTypeFromURL === TICKET_PAGE_SLUG_ID.TAGS) {
      pageSlugId = TICKET_PAGE_SLUG_ID.TAGS;
      if (childrenPageSlugIdFromURL !== TICKET_CHILDREN_PAGE_SLUG_ID.ALL) {
        childrenPageSlugId = childrenPageSlugIdFromURL || TICKET_CHILDREN_PAGE_SLUG_ID.ALL;
      }
    } else if (pageTypeFromURL === TICKET_PAGE_SLUG_ID.TYPES) {
      pageSlugId = TICKET_PAGE_SLUG_ID.TYPES;
      if (childrenPageSlugIdFromURL !== TICKET_CHILDREN_PAGE_SLUG_ID.ALL) {
        childrenPageSlugId = childrenPageSlugIdFromURL || TICKET_CHILDREN_PAGE_SLUG_ID.ALL;
      }
    } else if (pageTypeFromURL === TICKET_PAGE_SLUG_ID.SUBSTATES) {
      pageSlugId = TICKET_PAGE_SLUG_ID.SUBSTATES;
      if (childrenPageSlugIdFromURL !== TICKET_CHILDREN_PAGE_SLUG_ID.ALL) {
        childrenPageSlugId = childrenPageSlugIdFromURL || TICKET_CHILDREN_PAGE_SLUG_ID.ALL;
      }
    } else {
      const ticketNumber = Number(pageTypeFromURL);
      pageSlugId = pageTypeFromURL && isNumber(ticketNumber) ? ticketNumber : TICKET_PAGE_SLUG_ID.ALL;
    }
    if (pageSlugId === TICKET_PAGE_SLUG_ID.ALL) {
      const searchParams = Utils.getUrlSearches();
      const viewID = searchParams?.view || '';
      setViewID(viewID);
    }
    setChildrenPageSlugId(childrenPageSlugId);
    setPageSlugId(pageSlugId);
    setLoading(false);
  }, [projectName]);

  useEffect(() => {
    const allSubscribe = eventBus.subscribe(EVENT_BUS_TYPE.TICKET_PAGE, togglePageSlugId);
    return () => {
      allSubscribe();
    };
  }, [togglePageSlugId]);

  useEffect(() => {
    resetURL(pageSlugId, childrenPageSlugId, viewID);
  }, [pageSlugId, childrenPageSlugId, viewID]);

  return (
    <TicketsPageContext.Provider value={{
      pageSlugId,
      viewID,
      childrenPageSlugId,
      isLoading,
      togglePageSlugId,
      onRefresh,
      updateViewID: setViewID,
    }}>
      {children}
    </TicketsPageContext.Provider>
  );
};

export const useTicketsPage = () => {
  const context = useContext(TicketsPageContext);
  if (!context) {
    throw new Error('\'TicketsPageContext\' is null');
  }
  return context;
};
