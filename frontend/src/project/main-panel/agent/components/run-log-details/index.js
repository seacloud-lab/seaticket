import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { CenteredLoading, IconTooltip, toaster, EmptyTip } from '@/components';
import { gettext, mediaUrl } from '@/constants';
import { agentAPI, ticketsAPI } from '@/project/api';
import { useCloseLinkedIssues } from '@/project/main-panel/tickets/hooks';
import { Utils } from '@/utils/utils';
import { getAgentResource, getRunLogStatusByRuns } from '../../utils';
import AgentType2GithubTypeMappingDialog from '../agent-type-to-github-type-mapping-dialog';
import ResourceTitle from '../resource-title';
import RegenerateChatPanel from './regenerate-chat-panel';
import RunDetail from './run-details';
import SuggestionDetailPanel from './suggestion-detail-panel';

import './index.css';

const { projectUuid } = window.app.pageOptions;

const RunLogDetails = ({
  isShowLogs,
  runLog,
  runLogs,
  isRunLogsLoading,
  showLogs,
  settings,
  statusFilterValue,
  statusFilterOptions,
  modifySettings,
  hideLogs,
  updateRunLog,
  updatedRuns,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [runs, setRuns] = useState([]);
  const [pendingMapping, setPendingMapping] = useState(null);
  const [suggestionInfo, setSuggestionInfo] = useState(null);
  const [regenerateInfo, setRegenerateInfo] = useState(null);
  const [hasUnappliedRegenerateDrafts, setHasUnappliedRegenerateDrafts] = useState(false);
  const { openCloseLinkedGitHubIssuesWarningDialog } = useCloseLinkedIssues();
  const [isShowAll, setIsShowAll] = useState(true);
  const runsRequestVersionRef = useRef(0);
  const [runsRefreshKey, setRunsRefreshKey] = useState(0);

  const { owner_source_id, owner_source_type } = useMemo(() => ({
    owner_source_id: runLog?.owner_source_id,
    owner_source_type: runLog?.owner_source_type,
  }), [runLog]);
  const resource = useMemo(() => getAgentResource(runLog), [runLog]);
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
    return { runId, action, mode, event: run.event };
  }, [runs, suggestionInfo]);

  const statusFilterOptionName = useMemo(() => {
    if (!statusFilterValue) return '';
    const option = statusFilterOptions.find(item => item.value === statusFilterValue) || statusFilterOptions[0];
    return option.label;
  }, [statusFilterValue, statusFilterOptions]);

  const regenerateRun = useMemo(() => {
    if (!regenerateInfo) return null;
    if (!Array.isArray(runs) || runs.length === 0) return null;
    return runs.find(run => run.id === regenerateInfo.runId) || null;
  }, [runs, regenerateInfo]);

  const openSuggestionDetailPanel = useCallback((runId, actionId, mode = 'view') => {
    setRegenerateInfo(null);
    setHasUnappliedRegenerateDrafts(false);
    setSuggestionInfo({ runId, actionId, mode });
    hideLogs();
  }, [hideLogs]);

  const closeSuggestionDetailPanel = useCallback(() => {
    setSuggestionInfo(null);
    showLogs();
  }, [showLogs]);

  const openRegeneratePanel = useCallback((run) => {
    setSuggestionInfo(null);
    setRegenerateInfo({ runId: run.id });
    hideLogs();
  }, [hideLogs]);

  const closeRegeneratePanel = useCallback(() => {
    setRegenerateInfo(null);
    setHasUnappliedRegenerateDrafts(false);
    showLogs();
  }, [showLogs]);

  const handleRegenerateApplied = useCallback(() => {
    setHasUnappliedRegenerateDrafts(false);
    setRunsRefreshKey(key => key + 1);
  }, []);

  const updateRunAction = useCallback((runId, actionId, update, runUpdate = null) => {
    setRuns(runs => {
      const nextRuns = runs.map(run => {
        if (run.id === runId) {
          const { actions } = run;
          const nextActions = Array.isArray(actions)
            ? actions.map(action => action.id === actionId ? { ...action, ...update } : action)
            : actions;
          return {
            ...run,
            ...(runUpdate || {}),
            actions: nextActions,
          };
        }
        return run;
      });
      const status = getRunLogStatusByRuns(nextRuns);
      updateRunLog(owner_source_id, owner_source_type, { status });
      return nextRuns;
    });
  }, [owner_source_id, owner_source_type, updateRunLog]);

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
        }, {
          suggestions_status: res.data.suggestions_status,
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
          if (typeof payload.suggestions_status === 'string') {
            setRuns(runs => {
              const nextRuns = runs.map(run => (
                run.id === runId ? { ...run, suggestions_status: payload.suggestions_status } : run
              ));
              const status = getRunLogStatusByRuns(nextRuns);
              updateRunLog(owner_source_id, owner_source_type, { status });
              return nextRuns;
            });
          }
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

    const sourceType = item?.source_type || action?.target_item_type;
    const sourceId = item?.source_id || action?.target_item_id;
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
  }, [findActionContext, openCloseLinkedGitHubIssuesWarningDialog, updateRunAction, owner_source_id, owner_source_type, updateRunLog]);

  const handleApproveAction = useCallback((runId, actionId, suggestionContent) => {
    const key = `${runId}_${actionId}`;
    const currentContent = findActionContext(actionId)?.action?.suggestion_content;

    const savePromise = currentContent === suggestionContent
      ? Promise.resolve()
      : agentAPI.updateAgentAction(projectUuid, runId, actionId, { suggestion_content: suggestionContent }).then((res) => {
        updateRunAction(runId, actionId, { suggestion_content: res.data.suggestion_content });
      }).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Failed to update action content:', err);
        toaster.danger(gettext('Failed to update content'));
        throw err;
      });

    return savePromise.then(() => {
      return Promise.resolve(onConfirmAction(actionId)).then((result) => {
        if (result?.success) {
          closeSuggestionDetailPanel();
        }
        return key;
      });
    }).catch(() => key);
  }, [findActionContext, onConfirmAction, updateRunAction, closeSuggestionDetailPanel]);

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
            }, {
              suggestions_status: res.data.suggestions_status,
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
          }, {
            suggestions_status: res.data.suggestions_status,
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
      }, {
        suggestions_status: res.data.suggestions_status,
      });
      if (res.data.success) {
        toaster.success(gettext('Action confirmed'));
        callback && callback();
      } else {
        toaster.danger(gettext('Failed to confirm action'));
        callback && callback(true);
      }
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Failed to save mapping and confirm action:', err);
      toaster.danger(gettext('Failed to confirm action'));
      callback && callback(true);
      throw err;
    });
  }, [pendingMapping, settings, updateRunAction, modifySettings]);

  useEffect(() => {
    const controller = new AbortController();
    const requestVersion = ++runsRequestVersionRef.current;

    if (!owner_source_id || !owner_source_type) {
      setIsLoading(false);
      setRuns([]);
      setSuggestionInfo(null);
      setRegenerateInfo(null);
      setHasUnappliedRegenerateDrafts(false);
      setPendingMapping(null);
      return () => controller.abort();
    }

    setIsLoading(true);
    setRuns([]);
    setSuggestionInfo(null);
    setRegenerateInfo(null);
    setHasUnappliedRegenerateDrafts(false);
    setPendingMapping(null);
    agentAPI.listAgentLogRuns(projectUuid, owner_source_id, owner_source_type, controller.signal).then(res => {
      if (controller.signal.aborted || requestVersion !== runsRequestVersionRef.current) return;
      const runs = res.data?.runs || [];
      setRuns(runs);
      const status = getRunLogStatusByRuns(runs);
      updateRunLog(owner_source_id, owner_source_type, { status });
      setIsShowAll(runs.length <= 8);
    }).catch(error => {
      if (axios.isCancel(error)) return;
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setRuns([]);
    }).finally(() => {
      if (controller.signal.aborted || requestVersion !== runsRequestVersionRef.current) return;
      setIsLoading(false);
    });

    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner_source_id, owner_source_type, runsRefreshKey]);

  useEffect(() => {
    if (!updatedRuns) return;
    if (
      updatedRuns.owner_source_id !== owner_source_id ||
      updatedRuns.owner_source_type !== owner_source_type
    ) return;
    if (regenerateInfo && hasUnappliedRegenerateDrafts) return;
    runsRequestVersionRef.current += 1;
    setRuns(updatedRuns.runs);
    setSuggestionInfo(null);
    setRegenerateInfo(null);
    setHasUnappliedRegenerateDrafts(false);
    setPendingMapping(null);
    setIsShowAll(updatedRuns.runs.length <= 8);
  }, [owner_source_id, owner_source_type, updatedRuns, regenerateInfo, hasUnappliedRegenerateDrafts]);

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
          <ResourceTitle resource={resource} className="font-size-16 font-weight-500 text-truncate" />
        </div>
        <div className="seaqa-agent-run-log-details-body d-flex flex-1 o-hidden">
          {runLogs.length === 0 && isRunLogsLoading ? (
            <CenteredLoading />
          ) : (
            <>
              {(isLoading) && (<CenteredLoading />)}
              {!isLoading && runs.length === 0 && (
                <>
                  {statusFilterValue && (
                    <EmptyTip
                      text={gettext('No logs match Status: %s in the list on the left, so there are no details to display').replace('%s', statusFilterOptionName)}
                      className="w-100"
                    />
                  )}
                  {!statusFilterValue && (
                    <EmptyTip
                      src={`${mediaUrl}img/no-items-tip.png`}
                      title={gettext('No agent runs')}
                      className="w-100"
                    />
                  )}
                </>
              )}
              {!isLoading && runs.length !== 0 && runLog && (
                <>
                  <div className="seaqa-agent-run-log-details h-100 d-flex flex-column p-4 w-100">
                    {!isShowAll && (
                      <div className="seaqa-agent-run-detail collapsed seaqa-agent-run-detail-more-tip">
                        <div className="seaqa-agent-run-detail-header">
                          <div className="flex-1 text-truncate">
                            <span className="font-weight-500">{gettext('% runs').replace('%', runs.length - 1)}</span>
                            {` ${gettext('more')}`}
                          </div>
                          <div className="d-flex align-items-center">
                            <IconTooltip
                              icon="arrow-down-b"
                              tip={gettext('Display more runs')}
                              className="mx-0"
                              placement="bottom"
                              hoverBackground={true}
                              size={{ btn: 24, icon: 16 }}
                              onClick={() => setIsShowAll(true)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    {runs.map(((run, index) => {
                      if (!isShowAll && index < (runs.length - 1)) return null;
                      return (
                        <RunDetail
                          key={run.id || index}
                          run={run}
                          index={index}
                          isExpanded={index === runs.length - 1 }
                          onConfirmAction={onConfirmAction}
                          onCancelAction={onCancelAction}
                          onViewContent={openSuggestionDetailPanel}
                          onChatToRefine={openRegeneratePanel}
                        />
                      );
                    }))}
                  </div>
                  {suggestionDetail && (
                    <SuggestionDetailPanel
                      suggestionDetail={suggestionDetail}
                      onApprove={handleApproveAction}
                      onClose={closeSuggestionDetailPanel}
                    />
                  )}
                </>
              )}
              {regenerateRun && !suggestionDetail && (
                <RegenerateChatPanel
                  key={regenerateRun.id}
                  run={regenerateRun}
                  onClose={closeRegeneratePanel}
                  onApplied={handleRegenerateApplied}
                  onDraftsChange={setHasUnappliedRegenerateDrafts}
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
