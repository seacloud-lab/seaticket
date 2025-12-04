import React, { useMemo } from 'react';
import { server } from '@/constants';
import KnowledgeTopBar from './knowledge-top-bar';
import { knowledgeBaseAPI } from '../../api';
import LongTextEditorUtilities from '@/utils/long-text';
import NewKnowledge from './view/new-knowledge';
import KnowledgeBase from './view/knowledge-base';
import { KnowledgePageProvider, useKnowledgePage } from './hooks/knowledge-page';
import { KNOWLEDGE_PAGE_SLUG_ID } from './constants';

const { projectUuid, permission, workspaceID, projectName, isProjectAdmin } = window.app.pageOptions;

const Page = ({ toggleBar, title }) => {
  const { isLoading, pageSlugId, togglePageSlugId } = useKnowledgePage();

  const longtextAPI = useMemo(() => new LongTextEditorUtilities({ server, api: {
    uploadFile: (file) => knowledgeBaseAPI.uploadFile(projectUuid, file)
  } }), []);

  const props = useMemo(() => ({
    projectUuid, projectName, workspaceID, permission, isAdmin: isProjectAdmin,
    toggleBar, title, togglePageSlugId
  }), []);

  if (isLoading) return null;
  if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.ALL) {
    return (<KnowledgeBase { ...props } />);
  }
  if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.NEW) {
    return (<NewKnowledge { ...props } editorAPI={longtextAPI} />);
  }
};

const Knowledge = ({ title, toggleBar }) => {
  return (
    <KnowledgePageProvider workspaceID={workspaceID} projectName={projectName}>
      <KnowledgeTopBar title={title} />
      <Page toggleBar={toggleBar} title={title} />
    </KnowledgePageProvider>
  );
};

export default Knowledge;
