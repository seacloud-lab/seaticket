import React, { useMemo } from 'react';
import { portalAPI } from '@/portal/api';
import Issues from '../../components/issues';
import { usePortalIssuesPage } from '../../hooks';

const AllIssues = ({ projectUuid, workspaceID, projectName, permission, toggleBar }) => {
  const { viewID, toggleView, isLoading, togglePageSlugId, onRefresh } = usePortalIssuesPage();

  const api = useMemo(() => ({
    getMetadata: (...params) => portalAPI.listIssues(projectUuid, ...params),
    getViews: () => portalAPI.listPortalIssuesViews(projectUuid),
    getView: (viewID) => portalAPI.getPortalIssuesView(projectUuid, viewID),
    insertView: (name, viewData) => portalAPI.insertPortalIssuesView(projectUuid, name, viewData),
    modifyView: (viewID, viewData) => portalAPI.modifyPortalIssuesView(projectUuid, viewID, viewData),
    deleteView: (viewID) => portalAPI.deletePortalIssuesView(projectUuid, viewID),
    moveView: (sourceViewID, targetViewID) => portalAPI.movePortalIssuesView(projectUuid, sourceViewID, targetViewID),
    duplicateView: (viewID) => portalAPI.duplicatePortalIssuesView(projectUuid, viewID),
    // row
    modifyRow: (...params) => portalAPI.modifyPortalIssue(projectUuid, ...params),
    modifyRows: (...params) => portalAPI.modifyPortalIssues(projectUuid, ...params),
    deleteRow: (...params) => portalAPI.deletePortalIssue(projectUuid, ...params),
    deleteRows: (...params) => portalAPI.portalAPIs(projectUuid, ...params),
  }), [projectUuid]);

  return (
    <Issues
      projectUuid={projectUuid}
      workspaceID={workspaceID}
      projectName={projectName}
      permission={permission}
      viewID={viewID}
      toggleBar={toggleBar}
      api={api}
      toggleView={toggleView}
      isLoading={isLoading}
      togglePageSlugId={togglePageSlugId}
      onRefresh={onRefresh}
    />
  );
};

export default AllIssues;
