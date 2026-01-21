import React, { useContext, useEffect, useState, useCallback } from 'react';
import { BAR_TYPE, EVENT_BUS_TYPE } from '../../../constants';
import { ASK_PAGE_SLUG_ID } from '../constants';
import eventBus from '@/utils/event-bus';
import { siteRoot } from '@/constants';

const AskPageContext = React.createContext(null);

export const AskPageProvider = ({ workspaceID, projectName, children }) => {
  const [isLoading, setLoading] = useState(true);
  const [pageSlugId, setPageSlugId] = useState(ASK_PAGE_SLUG_ID.NEW);

  const resetURL = useCallback((pageSlugId) => {
    const { origin } = location;
    let url = `${origin}${siteRoot}workspace/${workspaceID}/project/${projectName}/${BAR_TYPE.CHAT}/`;
    let urlPart = pageSlugId === ASK_PAGE_SLUG_ID.NEW ? '' : pageSlugId + '/';
    history.replaceState(null, null, url + urlPart);
  }, [workspaceID]);

  const togglePageSlugId = useCallback((pageSlugId) => {
    setPageSlugId(pageSlugId);
  }, []);

  // init page
  useEffect(() => {
    const { pathname } = location;
    const decodePathname = decodeURIComponent(pathname);
    const part = `/project/${projectName}/`;
    const projectNameIndex = decodePathname.indexOf(part);
    const paramsString = decodePathname.slice(projectNameIndex + part.length);
    const params = paramsString.split('/');
    const [, pageIdFromURL = ''] = params;
    setPageSlugId(pageIdFromURL || ASK_PAGE_SLUG_ID.NEW);
    setLoading(false);
  }, [projectName]);

  useEffect(() => {
    const allSubscribe = eventBus.subscribe(EVENT_BUS_TYPE.ASK_PAGE, togglePageSlugId);
    return () => {
      allSubscribe();
    };
  }, []);

  useEffect(() => {
    resetURL(pageSlugId);
  }, [pageSlugId]);

  return (
    <AskPageContext.Provider value={{
      pageSlugId,
      isLoading,
      togglePageSlugId,
    }}>
      {children}
    </AskPageContext.Provider>
  );
};

export const useAskPage = () => {
  const context = useContext(AskPageContext);
  if (!context) {
    throw new Error('\'AskPageContext\' is null');
  }
  return context;
};
