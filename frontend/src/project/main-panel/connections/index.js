import React from 'react';
import { ConnectionsPageProvider, useConnectionsPage } from './hooks';
import AllConnections from './view/all-connections';
import Connection from './view/connection';
import { CONNECTION_PAGE_SLUG_ID } from './constants';
import TopBar from './components/top-bar';

const {
  projectUuid, projectName, workspaceID, permission
} = window.app.pageOptions;

const Page = ({ toggleBar, modifyLocalBar }) => {
  const { isLoading, pageSlugId } = useConnectionsPage();
  if (isLoading) return null;
  if (pageSlugId === CONNECTION_PAGE_SLUG_ID.ALL) {
    return (<AllConnections projectUuid={projectUuid} projectName={projectName} modifyLocalBar={modifyLocalBar} />);
  }
  return (<Connection projectUuid={projectUuid} permission={permission} connectionID={pageSlugId} toggleBar={toggleBar} />);
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
