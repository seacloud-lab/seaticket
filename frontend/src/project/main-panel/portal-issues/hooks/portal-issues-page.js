import React, { useContext, useEffect, useState, useCallback } from 'react';
import { isNumber } from '@/utils/type-detection';
import { BAR_TYPE, EVENT_BUS_TYPE } from '../../../constants';
import eventBus from '@/utils/event-bus';
import context from '@/sea-metadata/context';
import { EVENT_BUS_TYPE as SEAMETADATA_EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import { siteRoot } from '@/constants';
import { PORTAL_ISSUE_PAGE_SLUG_ID, PORTAL_ISSUE_CHILDREN_PAGE_SLUG_ID } from '../constants';

const PortalIssuesPageContext = React.createContext(null);

export const PortalIssuesPageProvider = ({ workspaceID, projectName, children }) => {
  const [isLoading, setLoading] = useState(true);
  const [pageSlugId, setPageSlugId] = useState(PORTAL_ISSUE_PAGE_SLUG_ID.ALL);
  const [childrenPageSlugId, setChildrenPageSlugId] = useState(PORTAL_ISSUE_CHILDREN_PAGE_SLUG_ID.ALL);
  const [viewID, toggleView] = useState('');

  const resetURL = useCallback((pageSlugId, childrenPageSlugId, viewID) => {
    const { origin } = location;
    const url = `${origin}${siteRoot}workspace/${workspaceID}/project/${projectName}/${BAR_TYPE.PORTAL_ISSUES}`;
    let urlPart = pageSlugId === PORTAL_ISSUE_PAGE_SLUG_ID.ALL || (!pageSlugId && pageSlugId !== 0) ? '/' : `/${pageSlugId}/`;

    if (pageSlugId === PORTAL_ISSUE_PAGE_SLUG_ID.ALL && viewID) {
      urlPart = `/?view=${viewID}`;
    }
    history.replaceState(null, null, url + urlPart);
  }, [workspaceID, projectName]);

  const togglePageSlugId = useCallback((newPageSlugId, newChildrenPageSlugId) => {
    if (pageSlugId !== newPageSlugId) {
      setPageSlugId(newPageSlugId);
    }
    if (newChildrenPageSlugId !== undefined) {
      setChildrenPageSlugId(newChildrenPageSlugId);
    } else {
      setChildrenPageSlugId(PORTAL_ISSUE_CHILDREN_PAGE_SLUG_ID.ALL);
    }
  }, [pageSlugId]);

  const onRefresh = useCallback(() => {
    const eventBus = context.eventBus;
    eventBus.dispatch(SEAMETADATA_EVENT_BUS_TYPE.RELOAD_DATA);
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
    let pageSlugId = PORTAL_ISSUE_PAGE_SLUG_ID.ALL;
    let childrenPageSlugId = PORTAL_ISSUE_CHILDREN_PAGE_SLUG_ID.ALL;

    if (pageIdFromURL === PORTAL_ISSUE_PAGE_SLUG_ID.TYPES) {
      pageSlugId = PORTAL_ISSUE_PAGE_SLUG_ID.TYPES;
    } else if (pageIdFromURL === PORTAL_ISSUE_PAGE_SLUG_ID.SUBSTATES) {
      pageSlugId = PORTAL_ISSUE_PAGE_SLUG_ID.SUBSTATES;
    } else if (pageIdFromURL === PORTAL_ISSUE_PAGE_SLUG_ID.TRASH) {
      pageSlugId = PORTAL_ISSUE_PAGE_SLUG_ID.TRASH;
    } else {
      // Check if pageIdFromURL is a valid issue ID (number)
      const issueId = Number(pageIdFromURL);
      if (pageIdFromURL && isNumber(issueId)) {
        pageSlugId = issueId;
      }
    }

    setPageSlugId(pageSlugId);
    setChildrenPageSlugId(childrenPageSlugId);

    // Get viewID from URL params
    const searchParams = new URLSearchParams(location.search);
    const viewIDFromURL = searchParams.get('view') || '';
    toggleView(viewIDFromURL);

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
      childrenPageSlugId,
      viewID,
      isLoading,
      togglePageSlugId,
      toggleView,
      onRefresh,
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
