import React, { useContext, useEffect, useState, useCallback } from 'react';
import { isNumber } from '../../../../utils/type-detection';
import { BAR_TYPE, EVENT_BUS_TYPE, CONNECTION_PAGE_TYPE } from '../../../constants';
import eventBus from '../../../../utils/event-bus';

const ConnectionsPageContext = React.createContext(null);

export const ConnectionsPageProvider = ({ projectName, children }) => {
  const [isLoading, setLoading] = useState(true);
  const [pageType, setPageType] = useState(CONNECTION_PAGE_TYPE.ALL);
  const [pageName, setPageName] = useState('');

  const resetURL = useCallback((pageType) => {
    const { pathname, origin } = location;
    const decodePathname = decodeURIComponent(pathname);
    const projectPath = `/project/${projectName}/`;
    const projectPathIndex = decodePathname.indexOf(projectPath);
    if (projectPathIndex === -1) return;
    const newPathname = decodePathname.slice(0, projectPathIndex + projectPath.length);
    let urlPart = pageType === CONNECTION_PAGE_TYPE.ALL || (!pageType && pageType !== 0) ? '/' : `/${pageType}/`;
    history.replaceState(null, null, origin + newPathname + BAR_TYPE.CONNECTION + urlPart);
  }, [projectName]);

  const togglePageType = useCallback((pageType) => {
    setPageType(pageType);
  }, []);

  // init page type
  useEffect(() => {
    const { pathname } = location;
    const decodePathname = decodeURIComponent(pathname);
    const projectPath = `/project/${projectName}/`;
    const projectPathIndex = decodePathname.indexOf(projectPath);
    if (projectPathIndex === -1) {
      setLoading(false);
      return;
    }
    const paramsString = decodePathname.slice(projectPathIndex + projectPath.length);
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
      pageName,
      togglePageType,
      updatePageName: setPageName
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
