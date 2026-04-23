import React, { useMemo } from 'react';
import { PortalIssuesPageProvider, usePortalIssuesPage } from './hooks';
import Types from './view/types';
import Substates from './view/substates';
import AllIssues from './view/all-issues';
import TrashIssues from './view/trash-issues';
import Issue from './view/issue';
import { PORTAL_ISSUE_PAGE_SLUG_ID } from './constants';
import TopBar from './components/portal-issues-top-bar';
import { ticketsAPI } from '../../api';
import LongTextEditorUtilities from '@/utils/long-text';
import { server } from '@/constants';

const {
  projectUuid, projectName, workspaceID, permission, isProjectAdmin
} = window.app.pageOptions;

const Page = ({ toggleBar, type }) => {
  const longtextAPI = useMemo(() => new LongTextEditorUtilities({ server, api: {
    uploadFile: (...params) => ticketsAPI.uploadFile(projectUuid, ...params)
  } }), []);
  const props = useMemo(() => ({
    projectUuid, projectName, workspaceID, permission, isAdmin: isProjectAdmin, toggleBar
  }), [toggleBar]);

  const { isLoading, pageSlugId, togglePageSlugId, onRefresh } = usePortalIssuesPage();
  if (isLoading) return null;
  if (pageSlugId === PORTAL_ISSUE_PAGE_SLUG_ID.TYPES) {
    return (<Types projectUuid={projectUuid} permission={permission} />);
  }
  if (pageSlugId === PORTAL_ISSUE_PAGE_SLUG_ID.SUBSTATES) {
    return (<Substates projectUuid={projectUuid} permission={permission} />);
  }
  if (pageSlugId === PORTAL_ISSUE_PAGE_SLUG_ID.TRASH) {
    return (<TrashIssues { ...props } />);
  }
  if (pageSlugId === PORTAL_ISSUE_PAGE_SLUG_ID.ALL) {
    return (<AllIssues { ...props } />);
  }
  return (<Issue { ...props } issueID={pageSlugId} editorAPI={longtextAPI} onRefresh={onRefresh} togglePageSlugId={togglePageSlugId} />);
};

const PortalIssues = ({ title, toggleBar, type }) => {
  return (
    <PortalIssuesPageProvider workspaceID={workspaceID} projectName={projectName} type={type}>
      <TopBar title={title} type={type} permission={permission} />
      <Page toggleBar={toggleBar} type={type} />
    </PortalIssuesPageProvider>
  );
};

export default PortalIssues;
