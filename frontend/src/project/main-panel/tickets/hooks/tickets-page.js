import React, { useContext, useEffect, useState, useCallback } from 'react';
import { isNumber } from '../../../../utils/type-detection';
import { BAR_TYPE, EVENT_BUS_TYPE, TICKET_PAGE_TYPE } from '../../../constants';
import eventBus from '../../../../utils/event-bus';
import { Utils } from '@/utils/utils';

const TicketsPageContext = React.createContext(null);

export const TicketsPageProvider = ({ projectName, children }) => {
  const [isLoading, setLoading] = useState(true);
  const [pageType, setPageType] = useState(TICKET_PAGE_TYPE.ALL);
  const [pageTitle, setPageTitle] = useState('');
  const [viewID, setViewID] = useState('open');

  const resetURL = useCallback((pageType, viewID) => {
    const { pathname, origin } = location;
    const decodePathname = decodeURIComponent(pathname);
    const projectNameIndex = decodePathname.indexOf(projectName);
    const newPathname = decodePathname.slice(0, projectNameIndex + projectName.length + 1);
    let urlPart = pageType === TICKET_PAGE_TYPE.ALL || (!pageType && pageType !== 0) ? '/' : `/${pageType}/`;
    if (pageType === TICKET_PAGE_TYPE.ALL && viewID) {
      urlPart = urlPart + '?view=' + viewID;
    }
    history.replaceState(null, null, origin + newPathname + BAR_TYPE.TICKET + urlPart);
  }, []);

  const togglePageType = useCallback((pageType) => {
    setPageType(pageType);
  }, []);

  // init page type
  useEffect(() => {
    const { pathname } = location;
    const decodePathname = decodeURIComponent(pathname);
    const projectNameIndex = decodePathname.indexOf(projectName);
    const paramsString = decodePathname.slice(projectNameIndex + projectName.length + 1);
    const params = paramsString.split('/');
    const [, ticketType = ''] = params;
    let pageType = TICKET_PAGE_TYPE.ALL;
    if (ticketType === TICKET_PAGE_TYPE.NEW) {
      pageType = TICKET_PAGE_TYPE.NEW;
    } else if (ticketType === TICKET_PAGE_TYPE.TAGS) {
      pageType = TICKET_PAGE_TYPE.TAGS;
    } else {
      const ticketNumber = Number(ticketType);
      pageType = ticketType && isNumber(ticketNumber) ? ticketNumber : TICKET_PAGE_TYPE.ALL;
    }
    if (pageType === TICKET_PAGE_TYPE.ALL) {
      const searchParams = Utils.getUrlSearches();
      const viewID = searchParams?.view || 'open';
      setViewID(viewID);
    }
    togglePageType(pageType);
    setLoading(false);
  }, [projectName]);

  useEffect(() => {
    const allSubscribe = eventBus.subscribe(EVENT_BUS_TYPE.TICKET_PAGE, togglePageType);
    return () => {
      allSubscribe();
    };
  }, []);

  useEffect(() => {
    setPageTitle('');
    resetURL(pageType, viewID);
  }, [pageType, viewID]);

  return (
    <TicketsPageContext.Provider value={{
      pageType,
      viewID,
      pageTitle,
      isLoading,
      updatePageTitle: setPageTitle,
      togglePageType,
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
