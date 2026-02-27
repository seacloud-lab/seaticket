import React, { useMemo } from 'react';
import { server } from '@/constants';
import PortalKnowledgeTopBar from './knowledge-top-bar';
import { knowledgeBaseAPI } from '@/project/api/knowledge-base-api';
import LongTextEditorUtilities from '@/utils/long-text';
import PortalAllKnowledge from './view/all-knowledge';
import PortalEditKnowledge from './view/edit-knowledge';
import { PortalKnowledgePageProvider, usePortalKnowledgePage } from './hooks/knowledge-page';
import { KNOWLEDGE_PAGE_SLUG_ID } from './constants';

const { projectUuid, permission, workspaceID, projectName, isProjectAdmin } = window.app.pageOptions;

const Page = () => {
  const { isLoading, pageSlugId, togglePageSlugId } = usePortalKnowledgePage();

  const longtextAPI = useMemo(() => new LongTextEditorUtilities({ server, api: {
    uploadFile: (file) => knowledgeBaseAPI.uploadFile(projectUuid, file)
  } }), []);

  const props = useMemo(() => ({
    projectUuid, projectName, workspaceID, permission, isAdmin: isProjectAdmin, togglePageSlugId
  }), []);

  if (isLoading) return null;

  if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.ALL) {
    return (<PortalAllKnowledge { ...props } editorAPI={longtextAPI} />);
  }
  return (<PortalEditKnowledge { ...props } knowledgeID={pageSlugId} editorAPI={longtextAPI} />);
};

const PortalKnowledgeBase = () => {
  return (
    <PortalKnowledgePageProvider projectName={projectName} projectUuid={projectUuid}>
      <PortalKnowledgeTopBar/>
      <Page/>
    </PortalKnowledgePageProvider>
  );
};

export default PortalKnowledgeBase;
