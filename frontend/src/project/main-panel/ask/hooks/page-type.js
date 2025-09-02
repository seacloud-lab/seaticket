import React, { useContext, useEffect, useState, useCallback } from 'react';
import { BAR_TYPE, EVENT_BUS_TYPE } from '../../../constants';
import { ASK_PAGE_TYPE } from '../constants';
import eventBus from '@/utils/event-bus';

const AskPageContext = React.createContext(null);

export const AskPageProvider = ({ workspaceID, projectName, children }) => {
  const [isLoading, setLoading] = useState(true);
  const [pageType, setPageType] = useState(ASK_PAGE_TYPE.NEW);

  const resetURL = useCallback((pageType) => {
    const { origin } = location;
    let url = `${origin}/workspace/${workspaceID}/project/${projectName}/${BAR_TYPE.ASK}/`;
    let urlPart = pageType === ASK_PAGE_TYPE.NEW ? '' : pageType + '/';
    history.replaceState(null, null, url + urlPart);
  }, [workspaceID]);

  const togglePageType = useCallback((pageType) => {
    setPageType(pageType);
  }, []);

  // init page type
  useEffect(() => {
    const { pathname } = location;
    const decodePathname = decodeURIComponent(pathname);
    const part = `/project/${projectName}/`;
    const projectNameIndex = decodePathname.indexOf(part);
    const paramsString = decodePathname.slice(projectNameIndex + part.length);
    const params = paramsString.split('/');
    const [, pageTypeFromURL = ''] = params;
    setPageType(pageTypeFromURL || ASK_PAGE_TYPE.NEW);
    setLoading(false);
  }, [projectName]);

  useEffect(() => {
    const allSubscribe = eventBus.subscribe(EVENT_BUS_TYPE.ASK_PAGE, togglePageType);
    return () => {
      allSubscribe();
    };
  }, []);

  useEffect(() => {
    resetURL(pageType);
  }, [pageType]);

  return (
    <AskPageContext.Provider value={{
      pageType,
      isLoading,
      togglePageType,
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
