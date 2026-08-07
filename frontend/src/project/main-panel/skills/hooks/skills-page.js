import React, { useCallback, useContext, useEffect, useState } from 'react';
import { BAR_TYPE } from '@/project/constants';
import { siteRoot } from '@/constants';
import { SKILLS_PAGE_SLUG_ID } from '../constants';


const SkillsPageContext = React.createContext(null);

export const SkillsPageProvider = ({ workspaceID, projectName, children }) => {
  const [isLoading, setLoading] = useState(true);
  const [pageSlugId, setPageSlugId] = useState(SKILLS_PAGE_SLUG_ID.ALL);

  const resetURL = useCallback((nextPageSlugId) => {
    const { origin } = location;
    const baseUrl = `${origin}${siteRoot}workspace/${workspaceID}/project/${projectName}/${BAR_TYPE.SKILLS}`;
    if (!nextPageSlugId || nextPageSlugId === SKILLS_PAGE_SLUG_ID.ALL) {
      history.replaceState(null, null, `${baseUrl}/`);
      return;
    }
    history.replaceState(null, null, `${baseUrl}/${nextPageSlugId}/`);
  }, [workspaceID, projectName]);

  const togglePageSlugId = useCallback((nextPageSlugId) => {
    const value = nextPageSlugId || SKILLS_PAGE_SLUG_ID.ALL;
    setPageSlugId(value);
    resetURL(value);
  }, [resetURL]);

  useEffect(() => {
    const { pathname } = location;
    const decodePathname = decodeURIComponent(pathname);
    const part = `/project/${projectName}/`;
    const projectNameIndex = decodePathname.indexOf(part);
    const paramsString = decodePathname.slice(projectNameIndex + part.length);
    const params = paramsString.split('/');
    const [, pageIdFromURL = ''] = params;
    setPageSlugId(pageIdFromURL || SKILLS_PAGE_SLUG_ID.ALL);
    setLoading(false);
  }, [projectName]);

  return (
    <SkillsPageContext.Provider value={{
      isLoading,
      pageSlugId,
      togglePageSlugId,
    }}>
      {children}
    </SkillsPageContext.Provider>
  );
};

export const useSkillsPage = () => {
  const context = useContext(SkillsPageContext);
  if (!context) {
    throw new Error('\'SkillsPageContext\' is null');
  }
  return context;
};
