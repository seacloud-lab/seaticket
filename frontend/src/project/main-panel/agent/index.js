import React, { useCallback } from 'react';
import TopBar from '../top-bar';
import SwitchSettingsItem from '../settings/switch-settings-item';
import RunLogs from './run-logs';
import RefreshBtn from '@/project/components/refresh-btn';
import { useAgentSettings, useAgentRunLogs } from './hooks';
import { agentAPI } from '@/project/api';
import { CenteredLoading } from '@/components';
import toaster from '@/components/toaster';
import { gettext } from '@/constants';

import './index.css';

const { projectUuid } = window.app.pageOptions;

const Agent = ({ title }) => {
  const { settings, isLoading: isSettingsLoading, updateSettings } = useAgentSettings();
  const {
    runLogs,
    isLoading: isRunLogsLoading,
    hasMore,
    loadMore,
    refresh,
  } = useAgentRunLogs();
  const [isExecuting, setIsExecuting] = React.useState(false);

  const handleConfirmAction = useCallback((actionId) => {
    for (const run of runLogs) {
      const items = run.items || [];
      for (const item of items) {
        const actions = item.actions || [];
        const action = actions.find(a => a.id === actionId);
        if (action) {
          return agentAPI.confirmAgentAction(projectUuid, run.id, actionId).then(() => {
            refresh();
          });
        }
      }
      // Check direct actions
      const directActions = run.actions || [];
      const directAction = directActions.find(a => a.id === actionId);
      if (directAction) {
        return agentAPI.confirmAgentAction(projectUuid, run.id, actionId).then(() => {
          refresh();
        });
      }
    }
  }, [runLogs, refresh]);

  const handleUpdateContent = useCallback((runId, actionId, content) => {
    return agentAPI.updateAgentAction(projectUuid, runId, actionId, { content }).then(() => {
      toaster.success(gettext('Content updated'));
      refresh();
    }).catch(err => {
      console.error('Failed to update action content:', err);
      toaster.danger(gettext('Failed to update content'));
      throw err;
    });
  }, [refresh]);

  const handleCancelAction = useCallback((actionId) => {
    for (const run of runLogs) {
      const items = run.items || [];
      for (const item of items) {
        const actions = item.actions || [];
        const action = actions.find(a => a.id === actionId);
        if (action) {
          return agentAPI.cancelAgentAction(projectUuid, run.id, actionId).then(() => {
            refresh();
          });
        }
      }
      // Check direct actions
      const directActions = run.actions || [];
      const directAction = directActions.find(a => a.id === actionId);
      if (directAction) {
        return agentAPI.cancelAgentAction(projectUuid, run.id, actionId).then(() => {
          refresh();
        });
      }
    }
  }, [runLogs, refresh]);

  const handleExecuteNow = useCallback(() => {
    setIsExecuting(true);
    agentAPI.executeAgent(projectUuid).then(() => {
      refresh();
      setIsExecuting(false);
    }).catch(err => {
      console.error('Failed to execute agent:', err);
      setIsExecuting(false);
    });
  }, [refresh]);

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
          {settings.agent?.enabled && (
            <button
              className="agent-execute-btn"
              onClick={handleExecuteNow}
              disabled={isExecuting}
            >
              {isExecuting ? gettext('Executing...') : gettext('Execute now')}
            </button>
          )}
        </div>
      </TopBar>
      <div className="agent-container">
        <SwitchSettingsItem
          title={gettext('Agent')}
          placeholder={gettext('Enable Agent')}
          tip={gettext('Enable agent to automatically analyze and process tickets, github issues, etc.')}
          className="mb-4"
          value={settings.agent?.enabled}
          onChange={(value, callback) => updateSettings({ enabled: value }, callback)}
        />
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
          />
        </div>
      </div>
    </>
  );
};

export default Agent;
