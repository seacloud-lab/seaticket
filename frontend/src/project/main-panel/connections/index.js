import React from 'react';
import { ConnectionsPageProvider, useConnectionsPage } from './hooks';
import AllConnections from './view/all-connections';
import Connection from './view/connection';
import { CONNECTION_PAGE_SLUG_ID } from './constants';
import TopBar from './components/top-bar';

const {
  projectUuid, projectName, workspaceID, permission
} = window.app.pageOptions;

const Page = () => {
  const { isLoading, pageSlugId } = useConnectionsPage();
  if (isLoading) return null;
  if (pageSlugId === CONNECTION_PAGE_SLUG_ID.ALL) return (<AllConnections projectUuid={projectUuid} projectName={projectName} />);
  return (<Connection projectUuid={projectUuid} permission={permission} connectionID={pageSlugId} />);
};

const Index = ({ title }) => {
  return (
    <ConnectionsPageProvider workspaceID={workspaceID} projectName={projectName}>
      <TopBar title={title} />
      <Page />
    </ConnectionsPageProvider>
  );
};

export default Index;
