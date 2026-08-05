import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { agentAPI, ticketsAPI } from '@/project/api';
import { CenteredLoading, IconTooltip, toaster } from '@/components';
import { gettext } from '@/constants';
import RunDetail from './run-details';
import SuggestionDetailPanel from './suggestion-detail-panel';
import AgentType2GithubTypeMappingDialog from '../agent-type-to-github-type-mapping-dialog';
import { useCloseLinkedIssues } from '@/project/main-panel/tickets/hooks';
import { CONNECTION_TYPES } from '@/project/main-panel/connections/constants';
import RunLogTitle from '../run-log-title';

import './index.css';

const { projectUuid } = window.app.pageOptions;

const RunLogDetails = ({
  isShowLogs,
  runLog,
  showLogs,
  settings,
  modifySettings,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [runs, setRuns] = useState([]);
  const [pendingMapping, setPendingMapping] = useState(null);
  const [suggestionInfo, setSuggestionInfo] = useState(null);

  const { openCloseLinkedGitHubIssuesWarningDialog } = useCloseLinkedIssues();

  const { source_id, source_type } = useMemo(() => ({
    source_id: runLog.source_id,
    source_type: runLog.source_type,
  }), [runLog]);
  const actualSourceId = useMemo(() => {
    let sourceId = source_id;
    if (CONNECTION_TYPES.find(connection => connection.type === source_type)) {
      const source_ids = source_id.split('_');
      sourceId = source_ids[1];
    }
    return sourceId;
  }, [source_type, source_id]);
  const suggestionDetail = useMemo(() => {
    if (!suggestionInfo) return null;
    if (!Array.isArray(runs) || runs.length === 0) return null;
    const { runId, actionId, mode } = suggestionInfo;
    const run = runs.find(run => run.id === runId);
    if (!run) return null;
    const { actions } = run;
    if (!Array.isArray(actions) || actions.length === 0) return null;
    const action = actions.find(action => action.id === actionId);
    if (!action) return null;
    return { runId, action, mode };
  }, [runs, suggestionInfo]);

  const openSuggestionDetailPanel = useCallback((action, runId, mode = 'view') => {
    setSuggestionInfo({
      runId,
      actionId: action.id,
      mode,
    });
  }, []);

  const closeSuggestionDetailPanel = useCallback(() => {
    setSuggestionInfo(null);
  }, []);

  const updateRunAction = useCallback((runId, actionId, update) => {
    setRuns(runs => runs.map(run => {
      if (run.id === runId) {
        const { actions } = run;
        if (!Array.isArray(actions) || actions.length === 0) return run;
        return {
          ...run,
          actions: actions.map(action => action.id === actionId ? { ...action, ...update } : action)
        };
      }
      return run;
    }));
  }, []);

  const findActionContext = useCallback((actionId) => {
    for (const run of runs) {
      const items = run.items || [];
      for (const item of items) {
        const actions = item.actions || [];
        const action = actions.find(a => a.id === actionId);
        if (action) return { runId: run.id, item, action };
      }
      const directActions = run.actions || [];
      const directAction = directActions.find(a => a.id === actionId);
      if (directAction) return { runId: run.id, item: null, action: directAction };
    }
    return null;
  }, [runs]);

  const onConfirmAction = useCallback((actionId) => {
    const actionContext = findActionContext(actionId);
    if (!actionContext?.runId) return '';
    const { runId, item, action } = actionContext;

    const executeConfirm = (options = null) => {
      return agentAPI.confirmAgentAction(projectUuid, runId, actionId, options || {}).then((res) => {
        updateRunAction(runId, actionId, {
          status: res.data.status,
          result: res.data.result,
        });
        return { success: res.data.success };
      }).catch((err) => {
        const payload = err?.response?.data;
        if (payload?.error_code === 'mapping_required') {
          setPendingMapping({
            runId,
            actionId,
            agentType: payload.agent_type,
            githubIssueTypes: payload.github_issue_types || [],
          });
          return { success: false, reason: 'mapping_required' };
        }
        if (payload?.detail) {
          toaster.danger(payload.detail);
          return { success: false, reason: 'error' };
        }
        toaster.danger(gettext('Failed to confirm action'));
        return { success: false, reason: 'error' };
      });
    };

    if (action?.tool_name !== 'suggest_close_ticket') {
      return executeConfirm();
    }

    const sourceType = item?.source_type;
    const sourceId = item?.source_id;
    if (sourceType !== 'ticket' || !sourceId) {
      return executeConfirm();
    }

    const ticketId = Number(sourceId);
    if (!Number.isInteger(ticketId)) {
      return executeConfirm();
    }

    return ticketsAPI.checkLinkedGithubIssues(projectUuid, [ticketId]).then((res) => {
      const tickets = res?.data?.tickets || [];
      if (tickets.length > 0) {
        const ticket = tickets[0];
        openCloseLinkedGitHubIssuesWarningDialog({
          ticket,
          stateReason: '',
          onCloseTicketOnly: () => {
            return executeConfirm().then((result) => {
              if (result?.success) {
                toaster.success(gettext('Action confirmed'));
              }
              return result;
            });
          },
          onCloseTicketAndGitHubIssues: () => {
            return executeConfirm({ linked_github_issues_to_close: tickets }).then((result) => {
              if (result?.success) {
                toaster.success(gettext('Action confirmed'));
              }
              return result;
            });
          },
        });
        return;
      }
      return executeConfirm();
    }).catch((err) => {
      const payload = err?.response?.data || {};
      toaster.danger(payload?.detail || gettext('Failed to check linked GitHub issues'));
    });
  }, [findActionContext, openCloseLinkedGitHubIssuesWarningDialog, updateRunAction]);

  const handleUpdateContent = useCallback((runId, actionId, suggestionContent) => {
    return agentAPI.updateAgentAction(projectUuid, runId, actionId, { suggestion_content: suggestionContent }).then((res) => {
      toaster.success(gettext('Content updated'));
      updateRunAction(runId, actionId, { suggestion_content: res.data.suggestion_content });
      return `${runId}_${actionId}`;
    }).catch(err => {
      console.error('Failed to update action content:', err);
      toaster.danger(gettext('Failed to update content'));
      return `${runId}_${actionId}`;
    });
  }, [updateRunAction]);

  const onCancelAction = useCallback((actionId) => {
    for (const run of runs) {
      const items = run.items || [];
      for (const item of items) {
        const actions = item.actions || [];
        const action = actions.find(a => a.id === actionId);
        if (action) {
          return agentAPI.cancelAgentAction(projectUuid, run.id, actionId).then((res) => {
            updateRunAction(run.id, actionId, {
              status: res.data.status,
              result: res.data.result,
            });
          });
        }
      }
      const directActions = run.actions || [];
      const directAction = directActions.find(a => a.id === actionId);
      if (directAction) {
        return agentAPI.cancelAgentAction(projectUuid, run.id, actionId).then((res) => {
          updateRunAction(run.id, actionId, {
            status: res.data.status,
            result: res.data.result,
          });
        });
      }
    }
    return Promise.resolve();
  }, [runs, updateRunAction]);

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
    modifySettings({ agent: newAgentSettings }).then(() => {
      setPendingMapping(null);
      return agentAPI.confirmAgentAction(projectUuid, runId, actionId);
    }).then((res) => {
      updateRunAction(runId, actionId, {
        status: res.data.status,
        result: res.data.result,
      });
      if (res.data.success) {
        toaster.success(gettext('Action confirmed'));
        callback && callback();
      } else {
        toaster.danger(gettext('Failed to confirm action'));
        callback && callback(true);
      }
    }).catch((err) => {
      console.error('Failed to save mapping and confirm action:', err);
      toaster.danger(gettext('Failed to confirm action'));
      callback && callback(true);
      throw err;
    });
  }, [pendingMapping, settings, updateRunAction, modifySettings]);

  useEffect(() => {
    setIsLoading(true);
    agentAPI.testListAgentItemLogs(projectUuid, source_id, source_type).then(res => {
      const { runs } = res.data;
      setRuns(runs || []);
    }).catch(error => {
      //
    }).finally(() => {
      setIsLoading(false);
    });
  }, [source_id, source_type]);

  return (
    <>
      <div className="seaqa-agent-run-log-details-container h-100 flex-1 o-hidden d-flex flex-column">
        <div className="seaqa-agent-run-log-details-header px-4 flex-shrink-0 d-flex align-items-center">
          {!isShowLogs && (
            <IconTooltip
              icon="side-bar"
              tip={gettext('Open the panel')}
              placement="bottom"
              className="mx-0"
              hoverBackground={true}
              size={{ btn: 24, icon: 16 }}
              onClick={showLogs}
            />
          )}
          <RunLogTitle runLog={runLog} className="font-size-16 font-weight-500 text-truncate" />
          <div className="seaqa-agent-run-log-source-id flex-shrink-0 px-2 font-size-12">
            {`# ${actualSourceId}`}
          </div>
        </div>
        <div className="seaqa-agent-run-log-details-body d-flex flex-1 o-hidden">
          {isLoading && (<CenteredLoading />)}
          {!isLoading && (
            <>
              <div className="seaqa-agent-run-log-details h-100 d-flex flex-column p-4 w-100">
                {runs.map(((run, index) => {
                  return (
                    <RunDetail
                      key={run.id || index}
                      run={run}
                      isExpanded={index === runs.length - 1 }
                      onConfirmAction={onConfirmAction}
                      onCancelAction={onCancelAction}
                      onViewContent={openSuggestionDetailPanel}
                    />
                  );
                }))}
              </div>
              {suggestionDetail && (
                <SuggestionDetailPanel
                  suggestionDetail={suggestionDetail}
                  onSave={handleUpdateContent}
                  onClose={closeSuggestionDetailPanel}
                />
              )}
            </>
          )}
        </div>
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

export default RunLogDetails;
