import React, { useContext, useEffect, useState, useCallback } from 'react';
import { EVENT_BUS_TYPE } from '../../../constants';
import { ASK_PAGE_SLUG_ID } from '../constants';
import eventBus from '@/utils/event-bus';
import { isFunction } from '@/utils/type-detection';

const AskPageContext = React.createContext(null);

export const AskPageProvider = ({ getInitialPageSlugId, resetURL, children }) => {
  const [isLoading, setLoading] = useState(true);
  const [pageSlugId, setPageSlugId] = useState(ASK_PAGE_SLUG_ID.NEW);

  const togglePageSlugId = useCallback((pageSlugId) => {
    setPageSlugId(pageSlugId);
  }, []);

  // init page
  useEffect(() => {
    if (isFunction(getInitialPageSlugId)) {
      const pageSlugId = getInitialPageSlugId();
      setPageSlugId(pageSlugId);
    }
    setLoading(false);
  }, [getInitialPageSlugId]);

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
