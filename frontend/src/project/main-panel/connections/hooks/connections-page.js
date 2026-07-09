import React, { useContext, useEffect, useState, useCallback, useRef } from 'react';
import { isNumber } from '@/utils/type-detection';
import { BAR_TYPE, EVENT_BUS_TYPE } from '../../../constants';
import eventBus from '@/utils/event-bus';
import context from '@/sea-metadata/context';
import { CONNECTION_PAGE_SLUG_ID } from '../constants';
import { EVENT_BUS_TYPE as SEA_METADATA_EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import { isConnectionRecordsView } from '../utils';
import { siteRoot } from '@/constants';

const ConnectionsPageContext = React.createContext(null);

export const ConnectionsPageProvider = ({ workspaceID, projectName, children }) => {
  const [isLoading, setLoading] = useState(true);
  const [pageSlugId, setPageSlugId] = useState(CONNECTION_PAGE_SLUG_ID.ALL);
  const [childrenPageSlugId, setChildrenPageSlugId] = useState('');
  const recordsQueryStringRef = useRef({});

  const resetURL = useCallback((pageSlugId, childrenPageSlugId) => {
    const { origin } = location;
    const url = `${origin}${siteRoot}workspace/${workspaceID}/project/${projectName}/${BAR_TYPE.CONNECTION}`;
    let urlPart = pageSlugId === CONNECTION_PAGE_SLUG_ID.ALL || (!pageSlugId && pageSlugId !== 0) ? '/' : `/${pageSlugId}/`;
    let queryString = '';
    if (isConnectionRecordsView(pageSlugId)) {
      if (childrenPageSlugId) {
        urlPart = urlPart + 'records/' + childrenPageSlugId + '/';
      } else {
        const currentUrlParams = new URLSearchParams(window.location.search);
        const currentQueryString = currentUrlParams.toString();
        const queryStringKey = `${pageSlugId}`;
        queryString = currentQueryString || recordsQueryStringRef.current[queryStringKey] || '';
        recordsQueryStringRef.current[queryStringKey] = queryString;
      }
    }
    const fullUrl = url + urlPart + (queryString ? '?' + queryString : '');
    history.replaceState(null, null, fullUrl);
  }, [workspaceID, projectName]);

  const togglePageSlugId = useCallback((pageSlugId, childrenPageSlugId = '') => {
    setLoading(true);
    setPageSlugId(pageSlugId);
    setChildrenPageSlugId(childrenPageSlugId);
    resetURL(pageSlugId, childrenPageSlugId);
    setTimeout(() => setLoading(false), 1);
  }, [resetURL]);

  const toggleChildrenPageSlugId = useCallback((newChildrenPageSlugId) => {
    if (!childrenPageSlugId && newChildrenPageSlugId && isConnectionRecordsView(pageSlugId)) {
      const currentUrlParams = new URLSearchParams(window.location.search);
      recordsQueryStringRef.current[`${pageSlugId}`] = currentUrlParams.toString();
    }
    setChildrenPageSlugId(newChildrenPageSlugId);
    resetURL(pageSlugId, newChildrenPageSlugId);
  }, [pageSlugId, childrenPageSlugId, resetURL]);

  const onRefresh = useCallback(() => {
    const eventBus = context.eventBus;
    eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.RELOAD_DATA);
  }, []);

  // init page
  useEffect(() => {
    const { pathname } = location;
    const decodePathname = decodeURIComponent(pathname);
    const part = `/project/${projectName}/`;
    const projectNameIndex = decodePathname.indexOf(part);
    const paramsString = decodePathname.slice(projectNameIndex + part.length);
    const params = paramsString.split('/');
    const [, connectionType = '', recordsSlug, recordId] = params;
    let pageSlugId = CONNECTION_PAGE_SLUG_ID.ALL;
    let childrenPageSlugId = '';
    if (connectionType === CONNECTION_PAGE_SLUG_ID.NEW) {
      pageSlugId = CONNECTION_PAGE_SLUG_ID.NEW;
    } else {
      const connectionID = Number(connectionType);
      pageSlugId = connectionType && isNumber(connectionID) ? connectionID : CONNECTION_PAGE_SLUG_ID.ALL;
    }
    if (isConnectionRecordsView(pageSlugId)) {
      if (recordsSlug === 'records' && recordId) {
        childrenPageSlugId = recordId;
      }
    }

    togglePageSlugId(pageSlugId, childrenPageSlugId);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectName]);

  useEffect(() => {
    const allSubscribe = eventBus.subscribe(EVENT_BUS_TYPE.CONNECTION_PAGE, togglePageSlugId);
    return () => {
      allSubscribe();
    };
  }, [togglePageSlugId]);

  return (
    <ConnectionsPageContext.Provider value={{
      pageSlugId,
      childrenPageSlugId,
      isLoading,
      togglePageSlugId,
      onRefresh,
      toggleChildrenPageSlugId,
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
