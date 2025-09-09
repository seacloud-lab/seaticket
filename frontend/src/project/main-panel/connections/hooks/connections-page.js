import React, { useContext, useEffect, useState, useCallback } from 'react';
import { isNumber } from '@/utils/type-detection';
import { BAR_TYPE, EVENT_BUS_TYPE } from '../../../constants';
import eventBus from '@/utils/event-bus';
import { Utils } from '@/utils/utils';
import { CONNECTION_PAGE_TYPE } from '../constants';

const ConnectionsPageContext = React.createContext(null);

export const ConnectionsPageProvider = ({ workspaceID, projectName, children }) => {
  const [isLoading, setLoading] = useState(true);
  const [pageType, setPageType] = useState(CONNECTION_PAGE_TYPE.ALL);
  const [pageName, setPageName] = useState('');
  const [viewID, setViewID] = useState('');

  const resetURL = useCallback((pageType, viewID) => {
    const { origin } = location;
    const url = `${origin}/workspace/${workspaceID}/project/${projectName}/${BAR_TYPE.CONNECTION}`;
    let urlPart = pageType === CONNECTION_PAGE_TYPE.ALL || (!pageType && pageType !== 0) ? '/' : `/${pageType}/`;

    if (![CONNECTION_PAGE_TYPE.ALL, CONNECTION_PAGE_TYPE.NEW].includes(pageType) && viewID) {
      urlPart = urlPart + '?view=' + viewID;
    }

    history.replaceState(null, null, url + urlPart);
  }, [workspaceID]);

  const togglePageType = useCallback((pageType, viewID = '') => {
    setLoading(true);
    setViewID(viewID);
    setPageType(pageType);
    setTimeout(() => setLoading(false), 1);
  }, []);

  // init page type
  useEffect(() => {
    const { pathname } = location;
    const decodePathname = decodeURIComponent(pathname);
    const part = `/project/${projectName}/`;
    const projectNameIndex = decodePathname.indexOf(part);
    const paramsString = decodePathname.slice(projectNameIndex + part.length);
    const params = paramsString.split('/');
    const [, connectionType = ''] = params;
    let pageType = CONNECTION_PAGE_TYPE.ALL;
    if (connectionType === CONNECTION_PAGE_TYPE.NEW) {
      pageType = CONNECTION_PAGE_TYPE.NEW;
    } else {
      const connectionID = Number(connectionType);
      pageType = connectionType && isNumber(connectionID) ? connectionID : CONNECTION_PAGE_TYPE.ALL;
    }

    if (![CONNECTION_PAGE_TYPE.ALL, CONNECTION_PAGE_TYPE.NEW].includes(pageType) && viewID) {
      const searchParams = Utils.getUrlSearches();
      const viewID = searchParams?.view || '';
      setViewID(viewID);
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
    resetURL(pageType, viewID);
  }, [pageType, viewID]);

  return (
    <ConnectionsPageContext.Provider value={{
      viewID,
      pageType,
      isLoading,
      pageName,
      togglePageType,
      updatePageName: setPageName,
      updateViewID: setViewID,
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
