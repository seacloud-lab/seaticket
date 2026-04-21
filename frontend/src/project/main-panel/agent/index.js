import React, { useCallback, useState } from 'react';
import TopBar from '../top-bar';
import RunLogs from './run-logs';
import RefreshBtn from '@/project/components/refresh-btn';
import { useAgentSettings } from './hooks/useAgentSettings';
import { useAgentRunLogs } from './hooks/useAgentRunLogs';
import { agentAPI } from '@/project/api';
import { CenteredLoading } from '@/components';
import toaster from '@/components/toaster';
import { gettext } from '@/constants';

import './index.css';

const { projectUuid } = window.app.pageOptions;

const Agent = ({ title }) => {
  const { isLoading: isSettingsLoading, settings } = useAgentSettings();
  const enabledAgent = settings.agent.enabled;
  const [pendingMapping, setPendingMapping] = useState(null);
  const {
    runLogs,
    isLoading: isRunLogsLoading,
    hasMore,
    loadMore,
    refresh,
    updateRunLog,
  } = useAgentRunLogs();

  const findRunIdByActionId = useCallback((actionId) => {
    for (const run of runLogs) {
      const items = run.items || [];
      for (const item of items) {
        const actions = item.actions || [];
        const action = actions.find(a => a.id === actionId);
        if (action) {
          return run.id;
        }
      }
      const directActions = run.actions || [];
      const directAction = directActions.find(a => a.id === actionId);
      if (directAction) {
        return run.id;
      }
    }
    return null;
  }, [runLogs]);

  const handleConfirmAction = useCallback((actionId) => {
    const runId = findRunIdByActionId(actionId);
    if (!runId) {
      return Promise.resolve();
    }

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
      if (payload?.detail) {
        toaster.danger(payload.detail);
        return;
      }
      toaster.danger(gettext('Failed to confirm action'));
      throw err;
    });
  }, [findRunIdByActionId, updateRunLog]);

  const handleUpdateContent = useCallback((runId, actionId, content) => {
    return agentAPI.updateAgentAction(projectUuid, runId, actionId, { content }).then(() => {
      toaster.success(gettext('Content updated'));
      updateRunLog(runId);
    }).catch(err => {
      console.error('Failed to update action content:', err);
      toaster.danger(gettext('Failed to update content'));
      throw err;
    });
  }, [updateRunLog]);

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

  const submitMappingAndRetry = useCallback((selectedGithubType) => {
    if (!pendingMapping?.agentType || !pendingMapping?.actionId || !pendingMapping?.runId) {
      return Promise.resolve();
    }

    const { runId, actionId, agentType } = pendingMapping;
    return agentAPI.getAgentSettings(projectUuid).then((res) => {
      const existingMapping = res?.data?.github_issue_type_mapping || {};
      return agentAPI.updateAgentSettings(projectUuid, {
        github_issue_type_mapping: {
          ...existingMapping,
          [agentType]: selectedGithubType,
        },
      });
    }).then(() => {
      setPendingMapping(null);
      return agentAPI.confirmAgentAction(projectUuid, runId, actionId);
    }).then(() => {
      updateRunLog(runId);
      toaster.success(gettext('Action confirmed'));
    }).catch((err) => {
      console.error('Failed to save mapping and confirm action:', err);
      toaster.danger(gettext('Failed to confirm action'));
      throw err;
    });
  }, [pendingMapping, updateRunLog]);

  if (isSettingsLoading) {
    return (
      <>
        <TopBar title={title}>
          <div className="w-100 text-truncate">{title}</div>
        </TopBar>
        <div className="flex-1 w-100">
          <CenteredLoading />
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title={title}>
        <div className="agent-top-bar-content">
          <div className="w-100 text-truncate">{title}</div>
        </div>
      </TopBar>
      <div className="agent-container">
        <div className="agent-run-logs-section">
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
            onUpdateContent={handleUpdateContent}
            enabledAgent={enabledAgent}
            pendingMapping={pendingMapping}
            onDismissMapping={dismissMapping}
            onSubmitMappingAndRetry={submitMappingAndRetry}
          />
        </div>
      </div>
    </>
  );
};

export default Agent;
