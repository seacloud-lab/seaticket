import React, { useContext, useEffect, useState, useCallback } from 'react';
import { isNumber } from '@/utils/type-detection';
import { BAR_TYPE, EVENT_BUS_TYPE } from '../../../constants';
import { KNOWLEDGE_PAGE_SLUG_ID, KNOWLEDGE_CHILDREN_PAGE_SLUG_ID } from '../constants';
import { Utils } from '@/utils/utils';
import context from '@/sea-metadata/context';
import { EVENT_BUS_TYPE as SEAMETADATA_EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import eventBus from '@/utils/event-bus';
import { siteRoot } from '@/constants';

const KnowledgePageContext = React.createContext(null);

export const KnowledgePageProvider = ({ workspaceID, projectName, children }) => {
  const [isLoading, setLoading] = useState(true);
  const [pageSlugId, setPageSlugId] = useState(KNOWLEDGE_PAGE_SLUG_ID.ALL);
  const [childrenPageSlugId, setChildrenPageSlugId] = useState(KNOWLEDGE_CHILDREN_PAGE_SLUG_ID.ALL);
  const [viewID, toggleView] = useState('');

  const resetURL = useCallback((pageSlugId, childrenPageSlugId, viewID) => {
    const { origin } = location;
    const url = `${origin}${siteRoot}workspace/${workspaceID}/project/${projectName}/${BAR_TYPE.KNOWLEDGE}`;
    let urlPart = pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.ALL || (!pageSlugId && pageSlugId !== 0) ? '/' : `/${pageSlugId}/`;
    if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.ALL && viewID) {
      urlPart = urlPart + '?view=' + viewID;
    }
    if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.TAGS && childrenPageSlugId !== KNOWLEDGE_CHILDREN_PAGE_SLUG_ID.ALL) {
      urlPart = urlPart + childrenPageSlugId + '/';
    }
    if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.TRASH) {
      urlPart = '/trash/';
    }
    history.replaceState(null, null, url + urlPart);
  }, [workspaceID]);

  const togglePageSlugId = useCallback((newPageSlugId, newChildrenPageSlugId = KNOWLEDGE_CHILDREN_PAGE_SLUG_ID.ALL) => {
    if (pageSlugId !== newPageSlugId) {
      setPageSlugId(newPageSlugId);
    }
    if (childrenPageSlugId !== newChildrenPageSlugId) {
      setChildrenPageSlugId(newChildrenPageSlugId);
    }
  }, [pageSlugId, childrenPageSlugId]);

  const onRefresh = Utils.debounce(useCallback(() => {
    const eventBus = context.eventBus;
    eventBus.dispatch(SEAMETADATA_EVENT_BUS_TYPE.RELOAD_DATA);
  }, []), 300);

  // init page
  useEffect(() => {
    const { pathname } = location;
    const decodePathname = decodeURIComponent(pathname);
    const part = `/project/${projectName}/`;
    const projectNameIndex = decodePathname.indexOf(part);
    const paramsString = decodePathname.slice(projectNameIndex + part.length);
    const params = paramsString.split('/');
    const [, pageIdFromURL = '', childrenPageSlugIdFromURL = ''] = params;
    let pageSlugId = KNOWLEDGE_PAGE_SLUG_ID.ALL;
    let childrenPageSlugId = KNOWLEDGE_CHILDREN_PAGE_SLUG_ID.ALL;
    if (pageIdFromURL === KNOWLEDGE_PAGE_SLUG_ID.NEW) {
      pageSlugId = KNOWLEDGE_PAGE_SLUG_ID.NEW;
    } else if (pageIdFromURL === KNOWLEDGE_PAGE_SLUG_ID.TAGS) {
      pageSlugId = KNOWLEDGE_PAGE_SLUG_ID.TAGS;
      if (childrenPageSlugIdFromURL !== KNOWLEDGE_CHILDREN_PAGE_SLUG_ID.ALL) {
        childrenPageSlugId = childrenPageSlugIdFromURL || KNOWLEDGE_CHILDREN_PAGE_SLUG_ID.ALL;
      }
    } else if (pageIdFromURL === KNOWLEDGE_PAGE_SLUG_ID.TRASH) {
      pageSlugId = KNOWLEDGE_PAGE_SLUG_ID.TRASH;
    } else {
      const ticketNumber = Number(pageIdFromURL);
      pageSlugId = pageIdFromURL && isNumber(ticketNumber) ? ticketNumber : KNOWLEDGE_PAGE_SLUG_ID.ALL;
    }
    const searchParams = Utils.getUrlSearches();
    if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.ALL) {
      const viewID = searchParams?.view || '';
      toggleView(viewID);
    }
    setChildrenPageSlugId(childrenPageSlugId);
    setPageSlugId(pageSlugId);
    setLoading(false);
  }, [projectName]);

  useEffect(() => {
    const allSubscribe = eventBus.subscribe(EVENT_BUS_TYPE.KNOWLEDGE_PAGE, togglePageSlugId);
    return () => {
      allSubscribe();
    };
  }, [togglePageSlugId]);

  useEffect(() => {
    resetURL(pageSlugId, childrenPageSlugId, viewID);
  }, [pageSlugId, childrenPageSlugId, viewID, resetURL]);

  return (
    <KnowledgePageContext.Provider value={{
      pageSlugId,
      viewID,
      childrenPageSlugId,
      isLoading,
      togglePageSlugId,
      toggleView,
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
