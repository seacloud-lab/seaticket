import React, { useMemo } from 'react';
import { ConnectionsPageProvider, useConnectionsPage } from './hooks';
import AllConnections from './view/all-connections';
import Connection from './view/connection';
import { CONNECTION_PAGE_SLUG_ID } from './constants';
import TopBar from './components/top-bar';
import LongTextEditorUtilities from '@/utils/long-text';
import { server } from '@/constants';

const {
  projectUuid, projectName, workspaceID, permission
} = window.app.pageOptions;

const Page = ({ toggleBar, modifyLocalBar }) => {
  const { isLoading, pageSlugId } = useConnectionsPage();
  const longtextAPI = useMemo(() => new LongTextEditorUtilities({ server, api: {
    uploadFile: () => Promise.reject(new Error('Upload is disabled'))
  } }), []);
  if (isLoading) return null;
  if (pageSlugId === CONNECTION_PAGE_SLUG_ID.ALL) {
    return (<AllConnections projectUuid={projectUuid} projectName={projectName} modifyLocalBar={modifyLocalBar} />);
  }
  return (<Connection key={pageSlugId} projectUuid={projectUuid} permission={permission} connectionID={Number(pageSlugId)} toggleBar={toggleBar} editorAPI={longtextAPI} />);
};

const Index = ({ title, toggleBar, modifyLocalBar }) => {
  return (
    <ConnectionsPageProvider workspaceID={workspaceID} projectName={projectName}>
      <TopBar title={title} modifyLocalBar={modifyLocalBar} />
      <Page toggleBar={toggleBar} modifyLocalBar={modifyLocalBar} />
    </ConnectionsPageProvider>
  );
};

export default Index;
