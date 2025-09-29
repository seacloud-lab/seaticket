import React from 'react';
import { ConnectionsPageProvider, useConnectionsPage } from './hooks';
import AllConnections from './view/all-connections';
import Connection from './view/connection';
import { CONNECTION_PAGE_TYPE } from './constants';
import TopBar from './components/top-bar';

const {
  projectUuid, projectName, workspaceID, permission
} = window.app.pageOptions;

const Page = ({ githubOauth }) => {
  const { isLoading, pageType } = useConnectionsPage();
  if (isLoading) return null;
  if (pageType === CONNECTION_PAGE_TYPE.ALL) return (<AllConnections projectUuid={projectUuid} projectName={projectName} githubOauth={githubOauth} />);
  return (<Connection projectUuid={projectUuid} permission={permission} connectionID={pageType} />);
};

const Index = ({ title, githubOauth }) => {
  return (
    <ConnectionsPageProvider workspaceID={workspaceID} projectName={projectName}>
      <TopBar title={title} />
      <Page githubOauth={githubOauth} />
    </ConnectionsPageProvider>
  );
};

export default Index;
