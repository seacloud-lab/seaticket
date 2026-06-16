import React, { useCallback, useMemo, useState } from 'react';
import TopBar from '../top-bar';
import RunLogs from './run-logs';
import SuggestionDetailPanel from './run-logs/suggestion-detail-panel';
import RefreshBtn from '@/project/components/refresh-btn';
import { useAgentRunLogs } from './hooks/useAgentRunLogs';
import { agentAPI } from '@/project/api';
import { toaster } from '@/components';
import { gettext } from '@/constants';
import AgentType2GithubTypeMappingDialog from './components/agent-type-to-github-type-mapping-dialog';
import { isOpenLinkedGithubIssuesWarning } from '@/project/main-panel/tickets/utils';
import { useCloseLinkedIssues } from '@/project/main-panel/tickets/hooks';

import './index.css';

const { projectUuid } = window.app.pageOptions;

const Agent = ({ title, settings, modifySettings }) => {
  const [pendingMapping, setPendingMapping] = useState(null);
  const [suggestionDetailPanel, setSuggestionDetailPanel] = useState(null);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [suggestionDetailPanelWidth, setSuggestionDetailPanelWidth] = useState(400);
  const { openCloseLinkedGitHubIssuesWarningDialog } = useCloseLinkedIssues();
  const {
    runLogs,
    isLoading: isRunLogsLoading,
    hasMore,
    loadMore,
    refresh,
    updateRunLog,
  } = useAgentRunLogs();

  const enabledAgent = useMemo(() => settings?.agent.enabled, [settings?.agent]);

  const getRunIdByActionId = useCallback((actionId) => {
    for (const run of runLogs) {
      const items = run.items || [];
      for (const item of items) {
        const actions = item.actions || [];
        const action = actions.find(a => a.id === actionId);
        if (action) return run.id;
      }
      const directActions = run.actions || [];
      const directAction = directActions.find(a => a.id === actionId);
      if (directAction) return run.id;
    }
    return null;
  }, [runLogs]);

  const handleConfirmAction = useCallback((actionId) => {
    const runId = getRunIdByActionId(actionId);
    if (!runId) return '';

    return agentAPI.confirmAgentAction(projectUuid, runId, actionId).then(() => {
      updateRunLog(runId);
    }).catch((err) => {
      const payload = err?.response?.data;
      if (payload?.error_code === 'mapping_required') {
        setPendingMapping({
          runId,
          actionId,
          agentType: payload.agent_type,
          githubIssueTypes: payload.github_issue_types || [],
        });
        return;
      }
      if (isOpenLinkedGithubIssuesWarning(err)) {
        const tickets = payload?.tickets || [];
        openCloseLinkedGitHubIssuesWarningDialog({
          tickets,
          stateReason: '',
          callback: () => {
            return agentAPI.confirmAgentAction(
              projectUuid,
              runId,
              actionId,
              { confirm_close_linked_github_issues: true }
            ).then(() => {
              updateRunLog(runId);
              toaster.success(gettext('Action confirmed'));
            });
          },
        });
        return;
      }
      if (payload?.detail) {
        toaster.danger(payload.detail);
        return;
      }
      toaster.danger(gettext('Failed to confirm action'));
    });
  }, [getRunIdByActionId, openCloseLinkedGitHubIssuesWarningDialog, updateRunLog]);

  const handleUpdateContent = useCallback((runId, actionId, suggestionContent) => {
    return agentAPI.updateAgentAction(projectUuid, runId, actionId, { suggestion_content: suggestionContent }).then(() => {
      toaster.success(gettext('Content updated'));
      updateRunLog(runId);
    }).catch(err => {
      console.error('Failed to update action content:', err);
      toaster.danger(gettext('Failed to update content'));
      throw err;
    });
  }, [updateRunLog]);

  const openSuggestionDetailPanel = useCallback((action, runId, mode = 'view') => {
    setSuggestionDetailPanel({
      action,
      runId,
      mode,
      title: action.suggestion_text || action.result || '',
      content: action.suggestion_content || '',
    });
  }, []);

  const closeSuggestionDetailPanel = useCallback(() => {
    setSuggestionDetailPanel(null);
  }, []);

  const handleSaveContent = useCallback((value) => {
    if (!suggestionDetailPanel) return;
    const { action, runId } = suggestionDetailPanel;
    setIsSavingContent(true);
    handleUpdateContent(runId, action.id, value)
      .then(() => {
        closeSuggestionDetailPanel();
      })
      .finally(() => {
        setIsSavingContent(false);
      });
  }, [suggestionDetailPanel, handleUpdateContent, closeSuggestionDetailPanel]);

  const handleCancelAction = useCallback((actionId) => {
    for (const run of runLogs) {
      const items = run.items || [];
      for (const item of items) {
        const actions = item.actions || [];
        const action = actions.find(a => a.id === actionId);
        if (action) {
          return agentAPI.cancelAgentAction(projectUuid, run.id, actionId).then(() => {
            updateRunLog(run.id);
          });
        }
      }
      const directActions = run.actions || [];
      const directAction = directActions.find(a => a.id === actionId);
      if (directAction) {
        return agentAPI.cancelAgentAction(projectUuid, run.id, actionId).then(() => {
          updateRunLog(run.id);
        });
      }
    }
    return Promise.resolve();
  }, [runLogs, updateRunLog]);

  const dismissMapping = useCallback(() => {
    setPendingMapping(null);
  }, []);

  const submitMappingAndRetry = useCallback((selectedGithubType, callback) => {
    if (!pendingMapping?.agentType || !pendingMapping?.actionId || !pendingMapping?.runId) return;

    const { runId, actionId, agentType } = pendingMapping;
    const newAgentSettings = {
      ...settings?.agent,
      github_issue_type_mapping: {
        ...settings?.agent?.github_issue_type_mapping,
        [agentType]: selectedGithubType,
      },
    };
    modifySettings({ agent: newAgentSettings }).then((res) => {
      setPendingMapping(null);
      return agentAPI.confirmAgentAction(projectUuid, runId, actionId);
    }).then(() => {
      updateRunLog(runId);
      toaster.success(gettext('Action confirmed'));
      callback && callback();
    }).catch((err) => {
      console.error('Failed to save mapping and confirm action:', err);
      toaster.danger(gettext('Failed to confirm action'));
      callback && callback(true);
      throw err;
    });
  }, [pendingMapping, settings, updateRunLog, modifySettings]);

  return (
    <>
      <TopBar title={title}>
        <div className="agent-top-bar-content">
          <div className="w-100 text-truncate">{title}</div>
        </div>
      </TopBar>
      <div className="agent-container">
        <div
          className="agent-run-logs-section"
          style={suggestionDetailPanel ? {
            flex: `1 1 calc(100% - ${suggestionDetailPanelWidth}px)`,
            width: `calc(100% - ${suggestionDetailPanelWidth}px)`,
          } : undefined}
        >
          <div className="agent-run-logs-header">
            <span>{gettext('Run Logs')}</span>
            <RefreshBtn className="agent-run-logs-refresh" onClick={refresh} />
          </div>
          <RunLogs
            runLogs={runLogs}
            isLoading={isRunLogsLoading}
            hasMore={hasMore}
            loadMore={loadMore}
            onConfirmAction={handleConfirmAction}
            onCancelAction={handleCancelAction}
            onViewContent={openSuggestionDetailPanel}
            enabledAgent={enabledAgent}
          />
        </div>
        {suggestionDetailPanel && (
          <SuggestionDetailPanel
            title={suggestionDetailPanel.title}
            content={suggestionDetailPanel.content}
            mode={suggestionDetailPanel.mode}
            isSaving={isSavingContent}
            onSave={handleSaveContent}
            onClose={closeSuggestionDetailPanel}
            width={suggestionDetailPanelWidth}
            onWidthChange={setSuggestionDetailPanelWidth}
          />
        )}
      </div>
      {pendingMapping && (
        <AgentType2GithubTypeMappingDialog
          agentType={pendingMapping?.agentType || ''}
          githubIssueTypes={pendingMapping?.githubIssueTypes || []}
          onCancel={dismissMapping}
          onConfirm={submitMappingAndRetry}
        />
      )}
    </>
  );
};

export default Agent;
