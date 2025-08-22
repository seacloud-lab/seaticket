import React, { useContext, useEffect, useState, useCallback } from 'react';
import { isNumber } from '../../../../utils/type-detection';
import { BAR_TYPE, EVENT_BUS_TYPE, CONNECTION_PAGE_TYPE } from '../../../constants';
import eventBus from '../../../../utils/event-bus';

const ConnectionsPageContext = React.createContext(null);

export const ConnectionsPageProvider = ({ projectName, children }) => {
  const [isLoading, setLoading] = useState(true);
  const [pageType, setPageType] = useState(CONNECTION_PAGE_TYPE.ALL);

  const resetURL = useCallback((pageType) => {
    const { pathname, origin } = location;
    const decodePathname = decodeURIComponent(pathname);
    const projectNameIndex = decodePathname.indexOf(projectName);
    const newPathname = decodePathname.slice(0, projectNameIndex + projectName.length + 1);
    let urlPart = pageType === CONNECTION_PAGE_TYPE.ALL || (!pageType && pageType !== 0) ? '/' : `/${pageType}/`;
    history.replaceState(null, null, origin + newPathname + BAR_TYPE.CONNECTION + urlPart);
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
    const [, connectionType = ''] = params;
    let pageType = CONNECTION_PAGE_TYPE.ALL;
    if (connectionType === CONNECTION_PAGE_TYPE.NEW) {
      pageType = CONNECTION_PAGE_TYPE.NEW;
    } else {
      const connectionID = Number(connectionType);
      pageType = connectionType && isNumber(connectionID) ? connectionID : CONNECTION_PAGE_TYPE.ALL;
    }
    togglePageType(pageType);
    setLoading(false);
  }, [projectName]);

  useEffect(() => {
    const allSubscribe = eventBus.subscribe(EVENT_BUS_TYPE.CONNECTION_PAGE, togglePageType);
    return () => {
      allSubscribe();
    };
  }, []);

  useEffect(() => {
    resetURL(pageType);
  }, [pageType]);

  return (
    <ConnectionsPageContext.Provider value={{
      pageType,
      isLoading,
      togglePageType,
    }}>
      {children}
    </ConnectionsPageContext.Provider>
  );
};

export const useConnectionsPage = () => {
  const context = useContext(ConnectionsPageContext);
  if (!context) {
    throw new Error('\'ConnectionsPageContext\' is null');
  }
  return context;
};
