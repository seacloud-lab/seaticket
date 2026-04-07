import React, { useMemo, useState, useCallback } from 'react';
import { PortalIssuesPageProvider, usePortalIssuesPage } from './hooks';
import AllPortalIssues from './view/all-portal-issues';
import TrashPortalIssues from './view/trash-portal-issues';
import AllPortalIssueTypes from './view/portal-issue-types';
import AllPortalIssueSubstates from './view/portal-issue-substates';
import PortalIssuesTopBar from './components/portal-issues-top-bar';
import { PORTAL_ISSUE_PAGE_SLUG_ID, PORTAL_ISSUE_CHILDREN_PAGE_SLUG_ID } from './constants';
import PortalIssueInDialog from './components/portal-issue-in-dialog';
import { isNumber } from '@/utils/type-detection';
import { IconButton, CenteredLoading } from '@/components';
import { gettext } from '@/constants';
import { BAR_TYPE, EVENT_BUS_TYPE } from '@/project/constants';
import eventBus from '@/utils/event-bus';
import context from '@/sea-metadata/context';
import { MetadataProvider } from '@/project/main-panel/tickets/hooks';
import { portalAPI } from '@/portal/api';

import './index.css';

const {
  projectUuid, projectName, workspaceID, permission
} = window.app.pageOptions;

const PortalIssueDetail = ({ issueId, onBack, onRefresh }) => {
  const [issue, setIssue] = useState(null);

  const updateIssue = useCallback((updatedIssue) => {
    setIssue(updatedIssue);
  }, []);

  const handleBack = useCallback(() => {
    onRefresh();
    onBack();
  }, [onBack, onRefresh]);

  const title = issue?.title || gettext('Issue Details');

  return (
    <div className="sea-qa-portal-issue-detail-page">
      <div className="sea-qa-portal-issue-detail-header">
        <IconButton icon="left" onClick={handleBack} title={gettext('Back')} />
        <span className="sea-qa-portal-issue-detail-title">{title}</span>
      </div>
      <div className="sea-qa-portal-issue-detail-content">
        <PortalIssueInDialog
          projectUuid={projectUuid}
          issueId={issueId}
          updateIssue={updateIssue}
        />
      </div>
    </div>
  );
};

const Page = ({ toggleBar, type }) => {
  const { isLoading, pageSlugId, childrenPageSlugId, togglePageSlugId, onRefresh } = usePortalIssuesPage();
  if (isLoading) return <CenteredLoading />;

  if (pageSlugId === PORTAL_ISSUE_PAGE_SLUG_ID.TYPES) {
    return (<AllPortalIssueTypes projectUuid={projectUuid} permission={permission} />);
  }

  if (pageSlugId === PORTAL_ISSUE_PAGE_SLUG_ID.SUBSTATES) {
    return (<AllPortalIssueSubstates projectUuid={projectUuid} permission={permission} />);
  }

  if (pageSlugId === PORTAL_ISSUE_PAGE_SLUG_ID.ALL) {
    return (<AllPortalIssues projectUuid={projectUuid} workspaceID={workspaceID} projectName={projectName} permission={permission} toggleBar={toggleBar} />);
  }

  if (pageSlugId === PORTAL_ISSUE_PAGE_SLUG_ID.TRASH) {
    return (<TrashPortalIssues projectUuid={projectUuid} workspaceID={workspaceID} projectName={projectName} permission={permission} toggleBar={toggleBar} />);
  }
  // Render issue detail page when pageSlugId is a number (issue ID)
  if (isNumber(pageSlugId)) {
    const handleBack = () => {
      eventBus.dispatch(EVENT_BUS_TYPE.PORTAL_ISSUES_PAGE, PORTAL_ISSUE_PAGE_SLUG_ID.ALL);
    };
    return (
      <PortalIssueDetail
        issueId={pageSlugId}
        onBack={handleBack}
        onRefresh={() => context.eventBus.dispatch('reload_data')}
      />
    );
  }
  return null;
};

// Adapter to make portalAPI compatible with MetadataProvider
// Use a unique name property to distinguish from ticketsAPI in cache
const createPortalIssueMetadataAPI = () => ({
  name: 'PortalIssueMetadataAPI',
  getTicketMetadata: (uuid) => portalAPI.getPortalIssueMetadata(uuid),
  // Type management methods
  listTicketTypes: (uuid) => portalAPI.listPortalIssueTypes(uuid),
  createTicketType: (uuid, data) => portalAPI.createPortalIssueType(uuid, data),
  modifyTicketType: (uuid, typeId, update) => portalAPI.modifyPortalIssueType(uuid, typeId, update),
  deleteTicketType: (uuid, typeId) => portalAPI.deletePortalIssueType(uuid, typeId),
  deleteTicketTypes: (uuid, typeIds) => portalAPI.deletePortalIssueTypes(uuid, typeIds),
  // Substate management methods
  listTicketSubstates: (uuid, stateId) => portalAPI.listPortalIssueSubstates(uuid, stateId),
  createTicketSubstate: (uuid, data) => portalAPI.createPortalIssueSubstate(uuid, data),
  modifyTicketSubstate: (uuid, substateId, update) => portalAPI.modifyPortalIssueSubstate(uuid, substateId, update),
  deleteTicketSubstate: (uuid, substateId) => portalAPI.deletePortalIssueSubstate(uuid, substateId),
  deleteTicketSubstates: (uuid, substateIds) => portalAPI.deletePortalIssueSubstates(uuid, substateIds),
});

const PortalIssues = ({ title, toggleBar, type }) => {
  const portalIssueMetadataAPI = useMemo(createPortalIssueMetadataAPI, []);

  return (
    <PortalIssuesPageProvider workspaceID={workspaceID} projectName={projectName}>
      <MetadataProvider projectUuid={projectUuid} api={portalIssueMetadataAPI}>
        <PortalIssuesTopBar title={title} permission={permission} />
        <Page toggleBar={toggleBar} type={type} />
      </MetadataProvider>
    </PortalIssuesPageProvider>
  );
};

export default PortalIssues;
