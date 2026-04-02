import React, { useCallback } from 'react';
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
  const {
    runLogs,
    isLoading: isRunLogsLoading,
    hasMore,
    loadMore,
    refresh,
    updateRunLog,
  } = useAgentRunLogs();

  const handleConfirmAction = useCallback((actionId) => {
    for (const run of runLogs) {
      const items = run.items || [];
      for (const item of items) {
        const actions = item.actions || [];
        const action = actions.find(a => a.id === actionId);
        if (action) {
          return agentAPI.confirmAgentAction(projectUuid, run.id, actionId).then(() => {
            updateRunLog(run.id);
          });
        }
      }
      // Check direct actions
      const directActions = run.actions || [];
      const directAction = directActions.find(a => a.id === actionId);
      if (directAction) {
        return agentAPI.confirmAgentAction(projectUuid, run.id, actionId).then(() => {
          updateRunLog(run.id);
        });
      }
    }
  }, [runLogs, updateRunLog]);

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
      // Check direct actions
      const directActions = run.actions || [];
      const directAction = directActions.find(a => a.id === actionId);
      if (directAction) {
        return agentAPI.cancelAgentAction(projectUuid, run.id, actionId).then(() => {
          updateRunLog(run.id);
        });
      }
    }
  }, [runLogs, updateRunLog]);

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
        <div className="agent-topbar-content">
          <div className="w-100 text-truncate">{title}</div>
        </div>
      </TopBar>
      <div className="agent-container">
        <div className="agent-run-logs-section">
          <div className="agent-run-logs-header">
            <span>
              {gettext('Run Logs')}
              <RefreshBtn className="agent-run-logs-refresh" onClick={refresh} />
            </span>
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
          />
        </div>
      </div>
    </>
  );
};

export default Agent;
