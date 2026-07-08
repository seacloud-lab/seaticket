import React, { useContext, useEffect, useState, useCallback, useRef } from 'react';
import context from '@/sea-metadata/context';
import eventBus from '@/utils/event-bus';
import { isNumber } from '@/utils/type-detection';
import { Utils } from '@/utils/utils';
import { EVENT_BUS_TYPE as SEAMETADATA_EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import { BAR_TYPE, EVENT_BUS_TYPE } from '@/project/constants';
import { KNOWLEDGE_PAGE_SLUG_ID } from '../constants';
import { buildPortalPath, getPortalPathSegments } from '@/portal/path-utils';

const PortalKnowledgePageContext = React.createContext(null);

export const PortalKnowledgePageProvider = ({ projectName, projectUuid, children }) => {
  const [isLoading, setLoading] = useState(true);
  const [pageSlugId, setPageSlugId] = useState(KNOWLEDGE_PAGE_SLUG_ID.ALL);
  const listQueryStringRef = useRef('');

  const resetURL = useCallback((pageSlugId) => {
    let url = pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.ALL || (!pageSlugId && pageSlugId !== 0)
      ? buildPortalPath(BAR_TYPE.KNOWLEDGE)
      : buildPortalPath(BAR_TYPE.KNOWLEDGE, pageSlugId);
    if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.ALL) {
      const currentUrlParams = new URLSearchParams(window.location.search);
      const currentQueryString = currentUrlParams.toString();
      const queryString = currentQueryString || listQueryStringRef.current;
      listQueryStringRef.current = queryString;
      url = url + (queryString ? '?' + queryString : '');
    }
    history.replaceState(null, null, url);
  }, []);

  const togglePageSlugId = useCallback((newPageSlugId) => {
    if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.ALL) {
      const currentUrlParams = new URLSearchParams(window.location.search);
      listQueryStringRef.current = currentUrlParams.toString();
    }
    resetURL(newPageSlugId);
    if (pageSlugId !== newPageSlugId) {
      setPageSlugId(newPageSlugId);
    }
  }, [pageSlugId, resetURL]);

  const onRefresh = Utils.debounce(useCallback(() => {
    const eventBus = context.eventBus;
    eventBus.dispatch(SEAMETADATA_EVENT_BUS_TYPE.RELOAD_DATA);
  }, []), 300);

  // init page
  useEffect(() => {
    const [, pageIdFromURL = ''] = getPortalPathSegments();
    let pageSlugId = KNOWLEDGE_PAGE_SLUG_ID.ALL;

    if (pageIdFromURL) {
      const ticketNumber = Number(pageIdFromURL);
      pageSlugId = isNumber(ticketNumber) ? ticketNumber : KNOWLEDGE_PAGE_SLUG_ID.ALL;
    }

    setPageSlugId(pageSlugId);
    setLoading(false);
  }, [projectUuid]);

  useEffect(() => {
    const allSubscribe = eventBus.subscribe(EVENT_BUS_TYPE.KNOWLEDGE_PAGE, togglePageSlugId);
    return () => {
      allSubscribe();
    };
  }, [togglePageSlugId]);

  useEffect(() => {
    resetURL(pageSlugId);
  }, [pageSlugId, resetURL]);

  return (
    <PortalKnowledgePageContext.Provider value={{
      pageSlugId,
      isLoading,
      togglePageSlugId,
      onRefresh,
    }}>
      {children}
    </PortalKnowledgePageContext.Provider>
  );
};

export const usePortalKnowledgePage = () => {
  const context = useContext(PortalKnowledgePageContext);
  if (!context) {
    throw new Error('\'PortalKnowledgePageContext\' is null');
  }
  return context;
};
