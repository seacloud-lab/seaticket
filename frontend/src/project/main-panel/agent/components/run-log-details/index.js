import React, { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import { agentAPI, ticketsAPI } from '@/project/api';
import { CenteredLoading, IconTooltip, toaster, EmptyTip } from '@/components';
import { gettext, mediaUrl } from '@/constants';
import RunDetail from './run-details';
import SuggestionDetailPanel from './suggestion-detail-panel';
import AgentType2GithubTypeMappingDialog from '../agent-type-to-github-type-mapping-dialog';
import { useCloseLinkedIssues } from '@/project/main-panel/tickets/hooks';
import ResourceTitle from '../resource-title';
import { getAgentResource, getRunLogStatusByRuns } from '../../utils';
import { Utils } from '@/utils/utils';

import './index.css';

const { projectUuid } = window.app.pageOptions;

const RunLogDetails = ({
  isShowLogs,
  runLog,
  showLogs,
  settings,
  modifySettings,
  hideLogs,
  updateRunLog,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [runs, setRuns] = useState([]);
  const [pendingMapping, setPendingMapping] = useState(null);
  const [suggestionInfo, setSuggestionInfo] = useState(null);
  const { openCloseLinkedGitHubIssuesWarningDialog } = useCloseLinkedIssues();
  const [isShowAll, setIsShowAll] = useState(true);

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
    return { runId, action, mode };
  }, [runs, suggestionInfo]);

  const openSuggestionDetailPanel = useCallback((runId, actionId, mode = 'view') => {
    setSuggestionInfo({ runId, actionId, mode });
    hideLogs();
  }, [hideLogs]);

  const closeSuggestionDetailPanel = useCallback(() => {
    setSuggestionInfo(null);
    showLogs();
  }, [showLogs]);

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

    const sourceType = item?.source_type || action?.target_source_type;
    const sourceId = item?.source_id || action?.target_source_id;
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
      console.error('Failed to save mapping and confirm action:', err);
      toaster.danger(gettext('Failed to confirm action'));
      callback && callback(true);
      throw err;
    });
  }, [pendingMapping, settings, updateRunAction, modifySettings]);

  useEffect(() => {
    const controller = new AbortController();

    if (!owner_source_id || !owner_source_type) {
      setIsLoading(false);
      setRuns([]);
      setSuggestionInfo(null);
      setPendingMapping(null);
      return () => controller.abort();
    }

    setIsLoading(true);
    setRuns([]);
    setSuggestionInfo(null);
    setPendingMapping(null);
    agentAPI.listAgentLogRuns(projectUuid, owner_source_id, owner_source_type, controller.signal).then(res => {
      if (controller.signal.aborted) return;
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
      if (controller.signal.aborted) return;
      setIsLoading(false);
    });

    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner_source_id, owner_source_type]);

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
          {isLoading && (<CenteredLoading />)}
          {!isLoading && runs.length === 0 && (
            <EmptyTip
              src={`${mediaUrl}img/no-items-tip.png`}
              title={gettext('No agent runs')}
              className="w-100"
            />
          )}
          {!isLoading && runs.length !== 0 && (
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
