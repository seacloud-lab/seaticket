import React, { useState, useCallback, useMemo } from 'react';
import classnames from 'classnames';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { ACTION_STATUS, ACTION_TYPE, RUN_STATUS } from './constants';
import { gettext } from '@/constants';
import Action from './action';
import RunStatisticsDialog from './run-statistics-dialog';
import ThoughtProcessDialog from './thought-process-dialog';
import { IconTooltip, Icon } from '@/components';
import DateFormatter from '@/project/main-panel/connections/components/cell-formatter/date-formatter';

import './index.css';

const thoughtProcessEnabled = window.app.pageOptions.thoughtProcessEnabled;
const normalizeRunEvents = (Events) => {
  if (Array.isArray(Events)) return Events.filter(Boolean);
  if (!Events || typeof Events !== 'object') return [];

  // New schema: bare event object
  if (typeof Events.type === 'string') {
    return [Events];
  }

  return [];
};

const getUniqueEventTypes = (Events) => {
  const normalizedEvents = normalizeRunEvents(Events);
  if (normalizedEvents.length === 0) return [];
  const seen = new Set();
  return normalizedEvents.reduce((acc, e) => {
    const type = e && e.type;
    if (type && !seen.has(type)) {
      seen.add(type);
      acc.push(type);
    }
    return acc;
  }, []);
};

const collectRunActions = (run) => {
  const { items = [], actions = [] } = run;
  const fromItems = items.flatMap(item => item.actions || []);
  return [...fromItems, ...actions];
};

const getDisplayActions = (actions) => {
  if (!Array.isArray(actions) || actions.length === 0) return [];
  return actions.filter((action, actionIndex, arr) => {
    if (action.type !== ACTION_TYPE.THOUGHT) return true;
    const nextAction = arr[actionIndex + 1];
    return !(nextAction && nextAction.type === ACTION_TYPE.SUMMARY);
  }).filter(action => {
    if (action.type === ACTION_TYPE.SUMMARY) return false;
    if (action.type === ACTION_TYPE.TOOL_CALL) return false;
    return true;
  });
};

const RunDetail = ({
  run,
  isExpanded: initIsExpanded,
  onConfirmAction,
  onCancelAction,
  onViewContent,
}) => {
  const [isExpanded, setIsExpanded] = useState(Boolean(initIsExpanded));
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showStatisticsDialog, setShowStatisticsDialog] = useState(false);
  const [showThoughtProcessDialog, setShowThoughtProcessDialog] = useState(false);

  const statusTip = useMemo(() => {
    if (run.status === RUN_STATUS.COMPLETED) {
      const allActions = collectRunActions(run);
      const hasPending = allActions.some(action =>
        [ACTION_STATUS.PENDING, ACTION_STATUS.EXECUTING].includes(action?.status)
      );
      const hasFailed = allActions.some(action => action?.status === ACTION_STATUS.FAILED);
      const hasSuggestion = allActions.some(a => a && a.type === ACTION_TYPE.SUGGESTION);
      const noPending = !hasPending;
      if (noPending && !hasFailed) {
        if (hasSuggestion) return (
          <div className="seaqa-agent-run-status run-done">
            <Icon symbol="check-circle" className="mr-1" />
            {gettext('Done')}
          </div>
        );
        return (
          <div className="seaqa-agent-run-status run-no-action-needed">
            {gettext('No action needed')}
          </div>
        );
      }
    }
    if (run.status === RUN_STATUS.RUNNING) return (
      <div className="seaqa-agent-run-status run-running font-weight-500">
        <Icon symbol="spinner" className="mr-1" />
        {gettext('Running')}
      </div>
    );
    if (run.status === RUN_STATUS.FAILED) return (
      <div className="seaqa-agent-run-status run-failed font-weight-500">
        {gettext('Failed')}
      </div>
    );
    return null;
  }, [run]);
  const eventTypes = useMemo(() => getUniqueEventTypes(run?.events), [run]);

  const toggleExpanded = useCallback((event) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    setIsExpanded(pre => !pre);
  }, []);

  const toggleDropdown = useCallback((e) => {
    if (e) e.stopPropagation();
    setDropdownOpen(prev => !prev);
  }, []);

  const handleShowStatistics = useCallback((e) => {
    e.stopPropagation();
    setShowStatisticsDialog(true);
  }, []);

  const handleCloseStatistics = useCallback(() => {
    setShowStatisticsDialog(false);
  }, []);

  const handleShowThoughtProcess = useCallback((e) => {
    e.stopPropagation();
    setShowThoughtProcessDialog(true);
    setDropdownOpen(false);
  }, []);

  const handleCloseThoughtProcess = useCallback(() => {
    setShowThoughtProcessDialog(false);
  }, []);

  const { id, started_at, items = [], actions = [] } = run;
  const displayActions = getDisplayActions(actions);

  return (
    <>
      <div className={classnames('seaqa-agent-run-detail', { 'expanded': isExpanded, 'collapsed': !isExpanded })}>
        <div className="seaqa-agent-run-detail-header" onClick={toggleExpanded}>
          <div className="seaqa-agent-run-detail-header-left">
            <DateFormatter className="seaqa-agent-run-time font-weight-500" value={started_at} />
            {eventTypes.map(type => (
              <div key={type} className="seaqa-agent-run-event-type ">{type}</div>
            ))}
            {statusTip}
          </div>
          <div className="seaqa-agent-run-detail-header-right">
            <Dropdown isOpen={dropdownOpen} toggle={toggleDropdown} className="run-card-more-dropdown">
              <DropdownToggle tag="span" className="run-card-more-toggle">
                <IconTooltip
                  icon="more"
                  tip={gettext('More options')}
                  className="mx-0"
                  placement="bottom"
                  hoverBackground={true}
                  size={{ btn: 24, size: 14 }}
                />
              </DropdownToggle>
              <DropdownMenu end className="seaqa-dropdown-menu">
                <DropdownItem onClick={handleShowStatistics}>
                  {gettext('Running log details')}
                </DropdownItem>
                {thoughtProcessEnabled && (
                  <DropdownItem onClick={handleShowThoughtProcess}>
                    {gettext('Thought process')}
                  </DropdownItem>
                )}
              </DropdownMenu>
            </Dropdown>
          </div>
        </div>
        {isExpanded && (
          <div className="seaqa-agent-run-detail-body">
            {items.map((item, index) => {
              const itemDisplayActions = getDisplayActions(item.actions);
              if (itemDisplayActions.length === 0) return null;
              return (
                <div key={`${item.source_type}-${item.source_id}-${index}`} className="run-ticket-section">
                  <div className="ticket-actions">
                    {itemDisplayActions.map((action, actionIndex) => (
                      <Action
                        key={action.id || actionIndex}
                        action={action}
                        runId={id}
                        onConfirm={onConfirmAction}
                        onCancel={onCancelAction}
                        onViewContent={onViewContent}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Fallback: if no items but has top-level direct actions */}
            {items.length === 0 && displayActions.length > 0 && (
              <div className="seaqa-agent-run-actions-direct">
                {displayActions.map((action, actionIndex) => (
                  <Action
                    key={action.id || actionIndex}
                    action={action}
                    runId={id}
                    onConfirm={onConfirmAction}
                    onCancel={onCancelAction}
                    onViewContent={onViewContent}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {showStatisticsDialog && (
        <RunStatisticsDialog run={run} runId={id} onToggle={handleCloseStatistics} />
      )}
      {showThoughtProcessDialog && (
        <ThoughtProcessDialog runId={id} onToggle={handleCloseThoughtProcess} />
      )}
    </>
  );
};

export default RunDetail;
