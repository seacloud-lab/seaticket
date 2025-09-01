import React, { useContext, useEffect, useState, useCallback } from 'react';
import { isNumber } from '../../../../utils/type-detection';
import { BAR_TYPE, EVENT_BUS_TYPE } from '../../../constants';
import { TICKET_PAGE_TYPE, TICKET_CHILDREN_PAGE_TYPE } from '../constants';
import eventBus from '../../../../utils/event-bus';
import { Utils } from '@/utils/utils';

const TicketsPageContext = React.createContext(null);

export const TicketsPageProvider = ({ workspaceID, projectName, children }) => {
  const [isLoading, setLoading] = useState(true);
  const [pageType, setPageType] = useState(TICKET_PAGE_TYPE.ALL);
  const [childrenPageType, setChildrenPageType] = useState(TICKET_CHILDREN_PAGE_TYPE.ALL);
  const [viewID, setViewID] = useState('open');

  const resetURL = useCallback((pageType, childrenPageType, viewID) => {
    const { origin } = location;
    let url = `${origin}/workspace/${workspaceID}/project/${projectName}/${BAR_TYPE.TICKET}`;
    let urlPart = pageType === TICKET_PAGE_TYPE.ALL || (!pageType && pageType !== 0) ? '/' : `/${pageType}/`;
    if (pageType === TICKET_PAGE_TYPE.ALL && viewID) {
      urlPart = urlPart + '?view=' + viewID;
    }
    if (pageType === TICKET_PAGE_TYPE.TAGS && childrenPageType !== TICKET_CHILDREN_PAGE_TYPE.ALL) {
      urlPart = urlPart + childrenPageType + '/';
    }
    history.replaceState(null, null, url + urlPart);
  }, [workspaceID]);

  const togglePageType = useCallback((pageType) => {
    setPageType(pageType);
  }, []);

  const toggleChildrenPageType = useCallback((childrenPageType) => {
    setChildrenPageType(childrenPageType);
  }, []);

  // init page type
  useEffect(() => {
    const { pathname } = location;
    const decodePathname = decodeURIComponent(pathname);
    const part = `/project/${projectName}/`;
    const projectNameIndex = decodePathname.indexOf(part);
    const paramsString = decodePathname.slice(projectNameIndex + part.length);
    const params = paramsString.split('/');
    const [, pageTypeFromURL = '', childrenPageTypeFromURL = ''] = params;
    let pageType = TICKET_PAGE_TYPE.ALL;
    let childrenPageType = TICKET_CHILDREN_PAGE_TYPE.ALL;
    if (pageTypeFromURL === TICKET_PAGE_TYPE.NEW) {
      pageType = TICKET_PAGE_TYPE.NEW;
    } else if (pageTypeFromURL === TICKET_PAGE_TYPE.TAGS) {
      pageType = TICKET_PAGE_TYPE.TAGS;
      if (childrenPageTypeFromURL !== TICKET_CHILDREN_PAGE_TYPE.ALL) {
        const childrenNumber = Number(childrenPageTypeFromURL);
        childrenPageType = childrenPageTypeFromURL && isNumber(childrenNumber) ? childrenNumber : TICKET_CHILDREN_PAGE_TYPE.ALL;
      }
    } else {
      const ticketNumber = Number(pageTypeFromURL);
      pageType = pageTypeFromURL && isNumber(ticketNumber) ? ticketNumber : TICKET_PAGE_TYPE.ALL;
    }
    if (pageType === TICKET_PAGE_TYPE.ALL) {
      const searchParams = Utils.getUrlSearches();
      const viewID = searchParams?.view || 'open';
      setViewID(viewID);
    }
    setChildrenPageType(childrenPageType);
    setPageType(pageType);
    setLoading(false);
  }, [projectName]);

  useEffect(() => {
    const allSubscribe = eventBus.subscribe(EVENT_BUS_TYPE.TICKET_PAGE, togglePageType);
    return () => {
      allSubscribe();
    };
  }, []);

  useEffect(() => {
    resetURL(pageType, childrenPageType, viewID);
  }, [pageType, childrenPageType, viewID]);

  return (
    <TicketsPageContext.Provider value={{
      pageType,
      viewID,
      childrenPageType,
      isLoading,
      togglePageType,
      toggleChildrenPageType,
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
