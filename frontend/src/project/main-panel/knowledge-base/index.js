import React, { useMemo } from 'react';
import { server } from '@/constants';
import KnowledgeTopBar from './knowledge-top-bar';
import { knowledgeBaseAPI } from '../../api';
import LongTextEditorUtilities from '@/utils/long-text';
import NewKnowledge from './view/new-knowledge';
import AllKnowledge from './view/all-knowledge';
import EditKnowledge from './view/edit-knowledge';
import Tags from './view/tags';
import TagKnowledge from './view/tag-knowledge';
import TrashKnowledge from './view/trash-knowledge';
import { KnowledgePageProvider, useKnowledgePage } from './hooks/knowledge-page';
import { MetadataProvider } from './hooks/metadata';
import { KNOWLEDGE_PAGE_SLUG_ID, KNOWLEDGE_CHILDREN_PAGE_SLUG_ID } from './constants';

const { projectUuid, permission, workspaceID, projectName, isProjectAdmin } = window.app.pageOptions;

const Page = ({ title }) => {
  const { isLoading, pageSlugId, childrenPageSlugId, togglePageSlugId } = useKnowledgePage();

  const longtextAPI = useMemo(() => new LongTextEditorUtilities({ server, api: {
    uploadFile: (file) => knowledgeBaseAPI.uploadFile(projectUuid, file)
  } }), []);

  const props = useMemo(() => ({
    projectUuid, projectName, workspaceID, permission, isAdmin: isProjectAdmin,
    title, togglePageSlugId
  }), []);

  if (isLoading) return null;
  if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.TAGS) {
    if (childrenPageSlugId === KNOWLEDGE_CHILDREN_PAGE_SLUG_ID.ALL) return (<Tags { ...props } />);
    return (<TagKnowledge { ...props } tagID={childrenPageSlugId} />);
  }
  if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.ALL) {
    return (<AllKnowledge { ...props } editorAPI={longtextAPI} />);
  }
  if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.TRASH) {
    return (<TrashKnowledge { ...props } />);
  }
  if (pageSlugId === KNOWLEDGE_PAGE_SLUG_ID.NEW) {
    return (<NewKnowledge { ...props } editorAPI={longtextAPI} />);
  }
  return (<EditKnowledge { ...props } knowledgeID={pageSlugId} editorAPI={longtextAPI} />);
};

const KnowledgeBase = ({ title }) => {
  return (
    <KnowledgePageProvider workspaceID={workspaceID} projectName={projectName}>
      <MetadataProvider projectUuid={projectUuid}>
        <KnowledgeTopBar title={title} />
        <Page title={title} />
      </MetadataProvider>
    </KnowledgePageProvider>
  );
};

export default KnowledgeBase;
