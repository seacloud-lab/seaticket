import React, { useState, useCallback, useMemo } from 'react';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import classnames from 'classnames';
import { IconTooltip, SecondaryBtn } from '@/components';
import { gettext } from '@/constants';
import DateFormatter from '@/project/main-panel/connections/components/cell-formatter/date-formatter';
import { FROM_NOW } from '@/sea-metadata/constants';
import { RUN_STATUS, RUN_EVENT_NAME, SUGGESTIONS_STATUS } from '../../../constants';
import { getDisplayActions, getEventSourceResource, getTriggerInfoFromRun } from '../../../utils';
import Action from './action';
import RunStatisticsDialog from './run-statistics-dialog';
import ThoughtProcessDialog from './thought-process-dialog';

import './index.css';

const thoughtProcessEnabled = window.app.pageOptions.thoughtProcessEnabled;

const RunDetail = ({
  run,
  index,
  isExpanded: initIsExpanded,
  onConfirmAction,
  onCancelAction,
  onViewContent,
  onChatToRefine,
}) => {
  const [isExpanded, setIsExpanded] = useState(Boolean(initIsExpanded));
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showStatisticsDialog, setShowStatisticsDialog] = useState(false);
  const [showThoughtProcessDialog, setShowThoughtProcessDialog] = useState(false);

  const statusTip = useMemo(() => {
    if (run.status === RUN_STATUS.COMPLETED) {
      const suggestionsStatus = (run.suggestions_status || '').trim();
      if (suggestionsStatus === SUGGESTIONS_STATUS.RESOLVED) {
        return {
          status: RUN_STATUS.COMPLETED,
          label: (
            <SecondaryBtn
              icon="check-circle"
              isSmall={true}
              className="seaqa-agent-run-status run-done"
              text={gettext('Done')}
            />
          )
        };
      }
      if (suggestionsStatus === SUGGESTIONS_STATUS.NONE) {
        return {
          status: RUN_STATUS.COMPLETED,
          label: (
            <SecondaryBtn
              isSmall={true}
              icon="info-filled"
              className="seaqa-agent-run-status run-no-action-needed"
              text={gettext('No action needed')}
            />
          )
        };
      }
    }
    if (run.status === RUN_STATUS.RUNNING) return {
      status: RUN_STATUS.RUNNING,
      label: (
        <SecondaryBtn
          icon="spinner"
          isSmall={true}
          className="seaqa-agent-run-status run-running font-weight-500 mr-4"
          text={gettext('Running')}
        />
      ),
    };
    if (run.status === RUN_STATUS.FAILED) return {
      status: RUN_STATUS.FAILED,
      label: (
        <SecondaryBtn
          isSmall={true}
          className="seaqa-agent-run-status run-failed font-weight-500 mr-4 text-danger"
          text={gettext('Failed')}
        />
      )
    };
    return null;
  }, [run]);

  const resource = useMemo(() => getEventSourceResource(run), [run]);
  const trigger = useMemo(() => getTriggerInfoFromRun(run), [run]);

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

  const handleChatToRefine = useCallback((e) => {
    e.stopPropagation();
    setDropdownOpen(false);
    onChatToRefine && onChatToRefine(run);
  }, [onChatToRefine, run]);

  const { id, started_at, actions = [], event } = run;
  const displayActions = getDisplayActions(actions);

  return (
    <>
      <div className={classnames('seaqa-agent-run-detail', { 'expanded': isExpanded, 'collapsed': !isExpanded })}>
        <div className="seaqa-agent-run-detail-header" onClick={toggleExpanded}>
          <div className="seaqa-agent-run-detail-header-left d-flex align-items-center flex-1 o-hidden">
            <DateFormatter className="seaqa-agent-run-time flex-shrink-0 font-weight-500" value={started_at} column={{ data: { format: FROM_NOW } }} />
            <div className="seaqa-agent-run-order text-secondary flex-shrink-0">{`${gettext('Run')} #${index + 1}`}</div>
            {event?.type && (
              <div
                className="seaqa-agent-run-event-type font-size-14 font-weight-500 text-truncate"
                title={RUN_EVENT_NAME[event.type]}
              >
                {RUN_EVENT_NAME[event.type]}
              </div>
            )}
            {statusTip && statusTip.status === RUN_STATUS.COMPLETED && statusTip.label}
          </div>
          <div className="d-flex align-items-center">
            {statusTip && statusTip.status !== RUN_STATUS.COMPLETED && statusTip.label}
            <Dropdown isOpen={dropdownOpen} toggle={toggleDropdown} className="d-flex">
              <DropdownToggle tag="span">
                <IconTooltip
                  icon="more"
                  tip={gettext('More options')}
                  className="mx-0"
                  placement="bottom"
                  hoverBackground={true}
                  size={{ btn: 24, icon: 16 }}
                />
              </DropdownToggle>
              <DropdownMenu end className="seaqa-agent-run-detail-dropdown-menu">
                <DropdownItem onClick={handleShowStatistics}>
                  {gettext('Running log details')}
                </DropdownItem>
                {thoughtProcessEnabled && (
                  <DropdownItem onClick={handleShowThoughtProcess}>
                    {gettext('Thought process')}
                  </DropdownItem>
                )}
                {run.status !== RUN_STATUS.RUNNING && (
                  <DropdownItem onClick={handleChatToRefine}>
                    {gettext('Chat to regenerate')}
                  </DropdownItem>
                )}
              </DropdownMenu>
            </Dropdown>
          </div>
        </div>
        {isExpanded && (
          <div className="seaqa-agent-run-detail-body">
            {displayActions.length > 0 && (
              <div className="seaqa-agent-run-actions-direct d-flex flex-column">
                {displayActions.map((action, actionIndex) => (
                  <Action
                    key={action.id || actionIndex}
                    action={action}
                    runId={id}
                    resource={resource}
                    trigger={trigger}
                    eventType={event?.type}
                    event={event}
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
