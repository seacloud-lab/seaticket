import React, { useContext, useEffect, useState, useCallback } from 'react';
import { isNumber } from '@/utils/type-detection';
import { BAR_TYPE, EVENT_BUS_TYPE } from '../../../constants';
import eventBus from '@/utils/event-bus';
import { Utils } from '@/utils/utils';
import context from '@/sea-metadata/context';
import { CONNECTION_PAGE_SLUG_ID } from '../constants';
import { EVENT_BUS_TYPE as SEA_METADATA_EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import { isConnectionRecordsView } from '../utils';

const ConnectionsPageContext = React.createContext(null);

export const ConnectionsPageProvider = ({ workspaceID, projectName, children }) => {
  const [isLoading, setLoading] = useState(true);
  const [pageSlugId, setPageSlugId] = useState(CONNECTION_PAGE_SLUG_ID.ALL);
  const [childrenPageSlugId, toggleChildrenPageSlugId] = useState('');
  const [viewID, toggleView] = useState('');
  const [connectionInfo, updateConnectionInfo] = useState({ name: '', type: '' });

  const resetURL = useCallback((pageSlugId, viewID, childrenPageSlugId) => {
    const { origin } = location;
    const url = `${origin}/workspace/${workspaceID}/project/${projectName}/${BAR_TYPE.CONNECTION}`;
    let urlPart = pageSlugId === CONNECTION_PAGE_SLUG_ID.ALL || (!pageSlugId && pageSlugId !== 0) ? '/' : `/${pageSlugId}/`;
    if (isConnectionRecordsView(pageSlugId)) {
      if (childrenPageSlugId) {
        urlPart = urlPart + 'records/' + childrenPageSlugId + '/';
      } else {
        if (viewID) {
          urlPart = urlPart + '?view=' + viewID;
        }
      }
    }
    history.replaceState(null, null, url + urlPart);
  }, [workspaceID, connectionInfo]);

  const togglePageSlugId = useCallback((pageSlugId, viewID = '', childrenPageSlugId = '') => {
    setLoading(true);
    toggleView(viewID);
    setPageSlugId(pageSlugId);
    toggleChildrenPageSlugId(childrenPageSlugId);
    if (pageSlugId === CONNECTION_PAGE_SLUG_ID.ALL) {
      updateConnectionInfo({ name: '', type: '' });
    }
    setTimeout(() => setLoading(false), 1);
  }, []);

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

    let viewID = '';
    if (isNumber(pageSlugId)) {
      const searchParams = Utils.getUrlSearches();
      viewID = searchParams?.view || '';
    }

    togglePageSlugId(pageSlugId, viewID, childrenPageSlugId);
    setLoading(false);
  }, [projectName]);

  useEffect(() => {
    const allSubscribe = eventBus.subscribe(EVENT_BUS_TYPE.CONNECTION_PAGE, togglePageSlugId);
    return () => {
      allSubscribe();
    };
  }, []);

  useEffect(() => {
    resetURL(pageSlugId, viewID, childrenPageSlugId);
  }, [pageSlugId, viewID, childrenPageSlugId]);

  return (
    <ConnectionsPageContext.Provider value={{
      viewID,
      pageSlugId,
      childrenPageSlugId,
      isLoading,
      connectionInfo,
      togglePageSlugId,
      toggleView,
      updateConnectionInfo,
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
