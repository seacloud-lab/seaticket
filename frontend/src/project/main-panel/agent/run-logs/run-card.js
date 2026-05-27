import React, { useState, useCallback, useMemo } from 'react';
import classnames from 'classnames';
import dayjs from 'dayjs';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import ActionItem from './action-item';
import RunStatisticsDialog from './run-statistics-dialog';
import ThoughtProcessDialog from './thought-process-dialog';
import { gettext } from '@/constants';
import { ACTION_STATUS, ACTION_TYPE, RUN_STATUS } from './constants';
import IconTooltip from '@/components/icon-tooltip';
import Icon from '@/components/icon';
import { CONNECTION_TYPE } from '@/project/main-panel/connections/constants';
import { TICKET_TYPE } from '@/project/main-panel/tickets/constants';
import { ResourceDetailsDialog } from '@/project/components';
import { getResourceIconURL } from '@/project/utils';

const { projectUuid } = window.app.pageOptions;
const thoughtProcessEnabled = window.app.pageOptions.thoughtProcessEnabled;

const RunCardHeader = ({ item }) => {
  const [isShowDetails, setIsShowDetails] = useState(false);

  const resource = useMemo(() => {
    const { source_type, source_id, source_title } = item;
    const icon = getResourceIconURL(source_type);
    if (source_type === TICKET_TYPE) return { type: TICKET_TYPE, title: source_title, _id: source_id, icon };

    const separatorIndex = source_id.indexOf('_');
    const connectionId = separatorIndex > -1 ? source_id.slice(0, separatorIndex) : '';
    const recordId = separatorIndex > -1 ? source_id.slice(separatorIndex + 1) : '';
    return {
      type: source_type,
      _id: recordId || source_id,
      title: source_title,
      connection_id: connectionId,
      icon: [CONNECTION_TYPE.GITHUB_ISSUE, CONNECTION_TYPE.DISCOURSE_FORUM, CONNECTION_TYPE.EMAIL].includes(source_type) ? icon : getResourceIconURL(TICKET_TYPE),
    };
  }, [item]);

  const titleTip = useMemo(() => {
    const { type, _id } = resource;
    if (type === TICKET_TYPE) return `${gettext('Ticket')} #${_id}`;
    if (type === CONNECTION_TYPE.GITHUB_ISSUE) return `${gettext('Github issue')} #${_id}`;
    if (type === CONNECTION_TYPE.DISCOURSE_FORUM) return `${gettext('Discourse Forum')} #${_id}`;
    if (type === CONNECTION_TYPE.EMAIL) return `${gettext('Email')} #${_id}`;
    return `${gettext(type)} #${_id}:`;
  }, [resource]);

  const openDetails = useCallback(() => {
    setIsShowDetails(true);
  }, []);

  const hasDetails = resource.type === TICKET_TYPE || (resource.connection_id && resource._id);

  return (
    <>
      <div className="ticket-header">
        <span className="ticket-icon">
          <img src={resource.icon} alt="Ticket" width={16} height={16} />
        </span>
        <span
          className={classnames('ticket-title text-truncate', { 'cursor-pointer': hasDetails })}
          onClick={hasDetails ? openDetails : () => {}}
        >
          <span>{titleTip}</span>
          <span className="seaqa-text-orange ml-1" title={resource.title}>{resource.title}</span>
        </span>
      </div>
      {isShowDetails && (
        <ResourceDetailsDialog
          projectUuid={projectUuid}
          resource={resource}
          onToggle={() => setIsShowDetails(false)}
        />
      )}
    </>
  );
};

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

const runHasSuggestionAction = (run) =>
  collectRunActions(run).some(a => a && a.type === ACTION_TYPE.SUGGESTION);

const RunCard = ({
  run,
  onConfirmAction,
  onCancelAction,
  onViewContent,
}) => {
  const { id, started_at, items = [], actions = [], events } = run;
  const eventTypes = getUniqueEventTypes(events);

  let isShowDone;
  let isShowNoActionNeeded;
  let isCardExpanded;
  if (run.status === RUN_STATUS.FAILED) {
    isShowDone = false;
    isShowNoActionNeeded = false;
    isCardExpanded = false;
  }
  else if (run.status === RUN_STATUS.RUNNING) {
    isShowDone = false;
    isShowNoActionNeeded = false;
    isCardExpanded = true;
  }
  else if (run.status === RUN_STATUS.COMPLETED) {
    const noPending = !items.some(item => (item.actions || []).some(action => action.status === ACTION_STATUS.PENDING));
    const hasSuggestion = runHasSuggestionAction(run);
    isShowDone = noPending && hasSuggestion;
    isShowNoActionNeeded = noPending && !hasSuggestion;
    isCardExpanded = !noPending;
  }

  const [isExpanded, setIsExpanded] = useState(isCardExpanded);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showStatisticsDialog, setShowStatisticsDialog] = useState(false);
  const [showThoughtProcessDialog, setShowThoughtProcessDialog] = useState(false);

  const toggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const toggleDropdown = useCallback((e) => {
    if (showStatisticsDialog) return;
    if (e) e.stopPropagation();
    setDropdownOpen(prev => !prev);
  }, [showStatisticsDialog]);

  const handleShowStatistics = useCallback((e) => {
    e.stopPropagation();
    setShowStatisticsDialog(true);
    setDropdownOpen(false);
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

  return (
    <div className={classnames('agent-run-card', { 'run-card-collapsed': !isExpanded })}>
      <div className="run-card-header" >
        <div className="run-card-header-left">
          <span className="run-time">{dayjs(started_at).format('YYYY-MM-DD HH:mm')}</span>
          <span className="run-id">{gettext('Run')} #{id}</span>
          {eventTypes.map(type => (
            <span key={type} className="run-event-type-badge">{type}</span>
          ))}
          {isShowDone &&
            <span className="run-card-done">
              <Icon symbol="check-circle" className="mr-1" />
              {gettext('Done')}
            </span>
          }
          {isShowNoActionNeeded &&
            <span className="run-card-no-action-needed">
              {gettext('No action needed')}
            </span>
          }
        </div>
        <div className="run-card-header-right">
          {run.status === RUN_STATUS.RUNNING &&
            <span className="run-card-running mr-4">
              <Icon symbol="spinner" className="mr-1" />
              {gettext('Running')}
            </span>
          }
          {run.status === RUN_STATUS.FAILED &&
            <span className="run-card-failed mr-4">
              {gettext('Failed')}
            </span>
          }
          <Dropdown isOpen={dropdownOpen} toggle={toggleDropdown} className="run-card-more-dropdown">
            <DropdownToggle tag="span" className="run-card-more-toggle">
              <IconTooltip
                icon="more"
                tip={dropdownOpen ? null : gettext('More options')}
                className="seaqa-project-refresh-btn"
                placement="bottom"
                hoverBackground={true}
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
          <IconTooltip
            icon="arrow-down"
            tip={isExpanded ? gettext('Collapse') : gettext('Expand')}
            className={classnames('seaqa-project-refresh-btn m-0', { 'rotate-180': isExpanded })}
            placement="bottom"
            hoverBackground={true}
            onClick={toggleExpand}
          />
        </div>
      </div>

      {isExpanded ? (
        <div className="run-card-body">
          {items.map((item, index) => (
            <div key={`${item.source_type}-${item.source_id}-${index}`} className="run-ticket-section">
              <RunCardHeader item={item} />
              <div className="ticket-actions">
                {(item.actions || []).filter((action, actionIndex, arr) => {
                  if (action.type !== ACTION_TYPE.THOUGHT) return true;
                  const nextAction = arr[actionIndex + 1];
                  return !(nextAction && nextAction.type === ACTION_TYPE.SUMMARY);
                }).map((action, actionIndex) => (
                  <ActionItem
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
          ))}

          {/* Fallback: if no items but has top-level direct actions */}
          {items.length === 0 && actions.length > 0 && (
            <div className="run-actions-direct">
              {actions.filter((action, actionIndex, arr) => {
                if (action.type !== ACTION_TYPE.THOUGHT) return true;
                const nextAction = arr[actionIndex + 1];
                return !(nextAction && nextAction.type === ACTION_TYPE.SUMMARY);
              }).map((action, actionIndex) => (
                <ActionItem
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
      )
        :
        <div className="run-card-body">
          {items.map((item, index) => (
            <div key={`${item.source_type}-${item.source_id}-${index}`} className="run-ticket-section">
              <RunCardHeader item={item} />
            </div>
          ))}
        </div>
      }
      {showStatisticsDialog && (
        <RunStatisticsDialog run={run} onToggle={handleCloseStatistics} />
      )}
      {showThoughtProcessDialog && (
        <ThoughtProcessDialog runId={id} onToggle={handleCloseThoughtProcess} />
      )}
    </div>
  );
};

export default RunCard;
