import React, { useContext, useEffect, useState, useCallback } from 'react';
import { isNumber } from '@/utils/type-detection';
import { BAR_TYPE, EVENT_BUS_TYPE } from '../../../constants';
import eventBus from '@/utils/event-bus';
import { Utils } from '@/utils/utils';
import { CONNECTION_PAGE_SLUG_ID } from '../constants';

const ConnectionsPageContext = React.createContext(null);

export const ConnectionsPageProvider = ({ workspaceID, projectName, children }) => {
  const [isLoading, setLoading] = useState(true);
  const [pageSlugId, setPageSlugId] = useState(CONNECTION_PAGE_SLUG_ID.ALL);
  const [connectionInfo, updateConnectionInfo] = useState({ name: '', type: '' });
  const [viewID, toggleView] = useState('');

  const resetURL = useCallback((pageSlugId, viewID) => {
    const { origin } = location;
    const url = `${origin}/workspace/${workspaceID}/project/${projectName}/${BAR_TYPE.CONNECTION}`;
    let urlPart = pageSlugId === CONNECTION_PAGE_SLUG_ID.ALL || (!pageSlugId && pageSlugId !== 0) ? '/' : `/${pageSlugId}/`;

    if (isNumber(pageSlugId) && viewID) {
      urlPart = urlPart + '?view=' + viewID;
    }

    history.replaceState(null, null, url + urlPart);
  }, [workspaceID]);

  const togglePageSlugId = useCallback((pageSlugId, viewID = '') => {
    setLoading(true);
    toggleView(viewID);
    setPageSlugId(pageSlugId);
    if (pageSlugId === CONNECTION_PAGE_SLUG_ID.ALL) {
      updateConnectionInfo({ name: '', type: '' });
    }
    setTimeout(() => setLoading(false), 1);
  }, []);

  // init page
  useEffect(() => {
    const { pathname } = location;
    const decodePathname = decodeURIComponent(pathname);
    const part = `/project/${projectName}/`;
    const projectNameIndex = decodePathname.indexOf(part);
    const paramsString = decodePathname.slice(projectNameIndex + part.length);
    const params = paramsString.split('/');
    const [, connectionType = ''] = params;
    let pageSlugId = CONNECTION_PAGE_SLUG_ID.ALL;
    if (connectionType === CONNECTION_PAGE_SLUG_ID.NEW) {
      pageSlugId = CONNECTION_PAGE_SLUG_ID.NEW;
    } else {
      const connectionID = Number(connectionType);
      pageSlugId = connectionType && isNumber(connectionID) ? connectionID : CONNECTION_PAGE_SLUG_ID.ALL;
    }

    let viewID = '';
    if (isNumber(pageSlugId)) {
      const searchParams = Utils.getUrlSearches();
      viewID = searchParams?.view || '';
    }

    togglePageSlugId(pageSlugId, viewID);
    setLoading(false);
  }, [projectName]);

  useEffect(() => {
    const allSubscribe = eventBus.subscribe(EVENT_BUS_TYPE.CONNECTION_PAGE, togglePageSlugId);
    return () => {
      allSubscribe();
    };
  }, []);

  useEffect(() => {
    resetURL(pageSlugId, viewID);
  }, [pageSlugId, viewID]);

  return (
    <ConnectionsPageContext.Provider value={{
      viewID,
      pageSlugId,
      isLoading,
      connectionInfo,
      togglePageSlugId,
      toggleView,
      updateConnectionInfo,
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
