import React, { useMemo } from 'react';
import { server } from '@/constants';
import LongTextEditorUtilities from '@/utils/long-text';
import { ticketsAPI } from '../../api';
import TopBar from './components/portal-issues-top-bar';
import { PORTAL_ISSUE_PAGE_SLUG_ID } from './constants';
import { PortalIssuesPageProvider, usePortalIssuesPage } from './hooks';
import AllIssues from './view/all-issues';
import ChatAnalysis from './view/chat-analysis';
import Issue from './view/issue';
import Substates from './view/substates';
import TrashIssues from './view/trash-issues';
import Types from './view/types';

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
  if (pageSlugId === PORTAL_ISSUE_PAGE_SLUG_ID.ANALYSIS) {
    return (<ChatAnalysis { ...props } />);
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
