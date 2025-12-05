import React, { useContext, useEffect, useState, useCallback } from 'react';
import { BAR_TYPE } from '../../../constants';
import { KNOWLEDGE_PAGE_SLUG_ID } from '../constants';
import { Utils } from '@/utils/utils';

const KnowledgePageContext = React.createContext(null);

export const KnowledgePageProvider = ({ workspaceID, projectName, children }) => {
  const [isLoading, setLoading] = useState(true);
  const [pageSlugId, setPageSlugId] = useState(KNOWLEDGE_PAGE_SLUG_ID.ALL);
  const [viewID, toggleView] = useState('');

  const resetURL = useCallback((pageSlugId, viewID) => {
    const { origin } = location;
    let url = `${origin}/workspace/${workspaceID}/project/${projectName}/${BAR_TYPE.KNOWLEDGE}`;
    let urlPart = pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.ALL ? '/' : `/${pageSlugId}/`;
    if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.ALL && viewID) {
      urlPart = urlPart + '?view=' + viewID;
    }
    history.replaceState(null, null, url + urlPart);
  }, [workspaceID]);

  const togglePageSlugId = useCallback((newPageSlugId) => {
    if (pageSlugId !== newPageSlugId) {
      setPageSlugId(newPageSlugId);
    }
  }, [pageSlugId]);

  // init page
  useEffect(() => {
    const { pathname } = location;
    const decodePathname = decodeURIComponent(pathname);
    const part = `/project/${projectName}/`;
    const projectNameIndex = decodePathname.indexOf(part);
    const paramsString = decodePathname.slice(projectNameIndex + part.length);
    const params = paramsString.split('/');
    const [, pageIdFromURL = ''] = params;

    let pageSlugId = KNOWLEDGE_PAGE_SLUG_ID.ALL;
    if (pageIdFromURL === KNOWLEDGE_PAGE_SLUG_ID.NEW) {
      pageSlugId = KNOWLEDGE_PAGE_SLUG_ID.NEW;
    }
    if (pageIdFromURL === KNOWLEDGE_PAGE_SLUG_ID.ALL) {
      pageSlugId = KNOWLEDGE_PAGE_SLUG_ID.ALL;
    }

    if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.ALL) {
      const searchParams = Utils.getUrlSearches();
      const viewID = searchParams?.view || '';
      toggleView(viewID);
    }
    setPageSlugId(pageSlugId);
    setLoading(false);
  }, [projectName]);

  useEffect(() => {
    resetURL(pageSlugId, viewID);
  }, [pageSlugId, viewID]);

  return (
    <KnowledgePageContext.Provider value={{
      pageSlugId,
      viewID,
      isLoading,
      togglePageSlugId,
      toggleView,
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
