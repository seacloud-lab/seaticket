import React, { useContext, useEffect, useState, useCallback } from 'react';
import { isNumber } from '@/utils/type-detection';
import { BAR_TYPE, EVENT_BUS_TYPE } from '../../../constants';
import { PORTAL_ISSUE_PAGE_SLUG_ID, PORTAL_ISSUE_CHILDREN_PAGE_SLUG_ID } from '../constants';
import eventBus from '@/utils/event-bus';
import { Utils } from '@/utils/utils';
import context from '@/sea-metadata/context';
import { EVENT_BUS_TYPE as SEAMETADATA_EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import { siteRoot } from '@/constants';

const PortalIssuesPageContext = React.createContext(null);

export const PortalIssuesPageProvider = ({ workspaceID, projectName, type, children }) => {
  const [isLoading, setLoading] = useState(true);
  const [pageSlugId, setPageSlugId] = useState(PORTAL_ISSUE_PAGE_SLUG_ID.ALL);
  const [childrenPageSlugId, setChildrenPageSlugId] = useState(PORTAL_ISSUE_CHILDREN_PAGE_SLUG_ID.ALL);
  const [viewID, toggleView] = useState('');

  const resetURL = useCallback((pageSlugId, childrenPageSlugId, viewID) => {
    const { origin } = location;
    const url = `${origin}${siteRoot}workspace/${workspaceID}/project/${projectName}/${BAR_TYPE.PORTAL_ISSUES}`;
    let urlPart = pageSlugId === PORTAL_ISSUE_PAGE_SLUG_ID.ALL || (!pageSlugId && pageSlugId !== 0) ? '/' : `/${pageSlugId}/`;

    if (pageSlugId === PORTAL_ISSUE_PAGE_SLUG_ID.ALL && type === BAR_TYPE.PORTAL_ISSUES_TRASH) {
      const myTicketsViewURL = `${origin}${siteRoot}workspace/${workspaceID}/project/${projectName}/${BAR_TYPE.PORTAL_ISSUES_TRASH}/`;
      history.replaceState(null, null, myTicketsViewURL);
      return;
    }

    if (pageSlugId === PORTAL_ISSUE_PAGE_SLUG_ID.ALL && viewID) {
      urlPart = urlPart + '?view=' + viewID;
    }
    if (pageSlugId === PORTAL_ISSUE_PAGE_SLUG_ID.TYPES && childrenPageSlugId !== PORTAL_ISSUE_CHILDREN_PAGE_SLUG_ID.ALL) {
      urlPart = urlPart + childrenPageSlugId + '/';
    }
    if (pageSlugId === PORTAL_ISSUE_PAGE_SLUG_ID.SUBSTATES && childrenPageSlugId !== PORTAL_ISSUE_CHILDREN_PAGE_SLUG_ID.ALL) {
      urlPart = urlPart + childrenPageSlugId + '/';
    }
    history.replaceState(null, null, url + urlPart);
  }, [workspaceID, type]);

  const togglePageSlugId = useCallback((newPageSlugId, newChildrenPageSlugId = PORTAL_ISSUE_CHILDREN_PAGE_SLUG_ID.ALL) => {
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
    let pageSlugId = PORTAL_ISSUE_PAGE_SLUG_ID.ALL;
    let childrenPageSlugId = PORTAL_ISSUE_CHILDREN_PAGE_SLUG_ID.ALL;
    if (pageIdFromURL === PORTAL_ISSUE_PAGE_SLUG_ID.NEW) {
      pageSlugId = PORTAL_ISSUE_PAGE_SLUG_ID.NEW;
    } else if (pageIdFromURL === PORTAL_ISSUE_PAGE_SLUG_ID.TYPES) {
      pageSlugId = PORTAL_ISSUE_PAGE_SLUG_ID.TYPES;
      if (childrenPageSlugIdFromURL !== PORTAL_ISSUE_CHILDREN_PAGE_SLUG_ID.ALL) {
        childrenPageSlugId = childrenPageSlugIdFromURL || PORTAL_ISSUE_CHILDREN_PAGE_SLUG_ID.ALL;
      }
    } else if (pageIdFromURL === PORTAL_ISSUE_PAGE_SLUG_ID.SUBSTATES) {
      pageSlugId = PORTAL_ISSUE_PAGE_SLUG_ID.SUBSTATES;
      if (childrenPageSlugIdFromURL !== PORTAL_ISSUE_CHILDREN_PAGE_SLUG_ID.ALL) {
        childrenPageSlugId = childrenPageSlugIdFromURL || PORTAL_ISSUE_CHILDREN_PAGE_SLUG_ID.ALL;
      }
    } else {
      const ticketNumber = Number(pageIdFromURL);
      pageSlugId = pageIdFromURL && isNumber(ticketNumber) ? ticketNumber : PORTAL_ISSUE_PAGE_SLUG_ID.ALL;
    }
    if (pageSlugId === PORTAL_ISSUE_PAGE_SLUG_ID.ALL) {
      const searchParams = Utils.getUrlSearches();
      const viewID = searchParams?.view || '';
      toggleView(viewID);
    }
    setChildrenPageSlugId(childrenPageSlugId);
    setPageSlugId(pageSlugId);
    setLoading(false);
  }, [projectName]);

  useEffect(() => {
    const allSubscribe = eventBus.subscribe(EVENT_BUS_TYPE.PORTAL_ISSUES_PAGE, togglePageSlugId);
    return () => {
      allSubscribe();
    };
  }, [togglePageSlugId]);

  useEffect(() => {
    resetURL(pageSlugId, childrenPageSlugId, viewID);
  }, [pageSlugId, childrenPageSlugId, viewID, resetURL]);

  return (
    <PortalIssuesPageContext.Provider value={{
      pageSlugId,
      viewID,
      childrenPageSlugId,
      isLoading,
      togglePageSlugId,
      onRefresh,
      toggleView,
    }}>
      {children}
    </PortalIssuesPageContext.Provider>
  );
};

export const usePortalIssuesPage = () => {
  const context = useContext(PortalIssuesPageContext);
  if (!context) {
    throw new Error('\'PortalIssuesPageContext\' is null');
  }
  return context;
};
