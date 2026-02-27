import React, { useContext, useEffect, useState, useCallback } from 'react';
import { isNumber } from '@/utils/type-detection';
import { BAR_TYPE, EVENT_BUS_TYPE } from '@/project/constants';
import { KNOWLEDGE_PAGE_SLUG_ID } from '../constants';
import { Utils } from '@/utils/utils';
import context from '@/sea-metadata/context';
import { EVENT_BUS_TYPE as SEAMETADATA_EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import eventBus from '@/utils/event-bus';
import { siteRoot } from '@/constants';

const KnowledgePageContext = React.createContext(null);

export const KnowledgePageProvider = ({ projectName, projectUuid, children }) => {
  const [isLoading, setLoading] = useState(true);
  const [pageSlugId, setPageSlugId] = useState(KNOWLEDGE_PAGE_SLUG_ID.ALL);

  const resetURL = useCallback((pageSlugId) => {
    const { origin } = location;
    const url = `${origin}${siteRoot}portal-edit/${projectUuid}/${BAR_TYPE.KNOWLEDGE}`;
    let urlPart = pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.ALL || (!pageSlugId && pageSlugId !== 0) ? '/' : `/${pageSlugId}/`;
    history.replaceState(null, null, url + urlPart);
  }, [projectUuid, projectName]);

  const togglePageSlugId = useCallback((newPageSlugId) => {
    if (pageSlugId !== newPageSlugId) {
      setPageSlugId(newPageSlugId);
    }
  }, [pageSlugId]);

  const onRefresh = Utils.debounce(useCallback(() => {
    const eventBus = context.eventBus;
    eventBus.dispatch(SEAMETADATA_EVENT_BUS_TYPE.RELOAD_DATA);
  }, []), 300);

  // init page
  useEffect(() => {
    const { pathname } = location;
    const decodePathname = decodeURIComponent(pathname);
    const part = `/${projectUuid}`;
    const projectUuidIndex = decodePathname.indexOf(part);
    const paramsString = decodePathname.slice(projectUuidIndex + part.length);
    const params = paramsString.split('/').filter(param => param !== '');
    const [, pageIdFromURL = ''] = params;
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
    <KnowledgePageContext.Provider value={{
      pageSlugId,
      isLoading,
      togglePageSlugId,
      onRefresh,
    }}>
      {children}
    </KnowledgePageContext.Provider>
  );
};

export const useKnowledgePage = () => {
  const context = useContext(KnowledgePageContext);
  if (!context) {
    throw new Error('\'KnowledgePageContext\' is null');
  }
  return context;
};
