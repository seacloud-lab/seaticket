import React, { useState, useCallback } from 'react';
import classnames from 'classnames';
import dayjs from 'dayjs';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import ActionItem from './action-item';
import RunStatisticsDialog from './run-statistics-dialog';
import { gettext, siteRoot, mediaUrl } from '@/constants';
import { BAR_TYPE } from '@/project/constants';
import { ACTION_STATUS, ACTION_TYPE, RUN_STATUS } from './constants';
import IconTooltip from '@/components/icon-tooltip';
import Icon from '@/components/icon';
import { CONNECTION_TYPE } from '@/project/main-panel/connections/constants';
import { TICKET_TYPE } from '@/project/main-panel/tickets/constants';

const { workspaceID, projectName } = window.app.pageOptions;

const RunCardHeader = ({ item }) => {
  const { source_type, source_id, source_title } = item;

  if (source_type === TICKET_TYPE) {
    return (
      <div className="ticket-header">
        <span className="ticket-icon">
          <img src={`${mediaUrl}/img/ticket.png`} alt="Ticket" width={16} height={16} />
        </span>
        <span className="ticket-title">
          <a
            href={`${siteRoot}workspace/${workspaceID}/project/${projectName}/${BAR_TYPE.TICKET}/${source_id}/`}
            onClick={(event) => event.stopPropagation()}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>{gettext('Ticket')} #{source_id}</span>
            <span className="sea-qa-text-orange"> {source_title}</span>
          </a>
        </span>
      </div>
    );
  }

  const separatorIndex = source_id.indexOf('_');
  const connectionId = separatorIndex > -1 ? source_id.slice(0, separatorIndex) : '';
  const recordId = separatorIndex > -1 ? source_id.slice(separatorIndex + 1) : '';
  const connectionDisplayId = recordId || source_id;
  const href = connectionId && recordId
    ? `${siteRoot}workspace/${workspaceID}/project/${projectName}/${BAR_TYPE.CONNECTION}/${connectionId}/records/${recordId}/`
    : '';

  if (source_type === CONNECTION_TYPE.GITHUB_ISSUE) {
    return (
      <div className="ticket-header">
        <span className="ticket-icon">
          <img src={`${mediaUrl}/img/connection/github-issues.png`} alt="GitHub Issues" width={16} height={16} />
        </span>
        <span className="ticket-title">
          {href ? (
            <a
              href={href}
              onClick={(event) => event.stopPropagation()}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>{gettext('GitHub Issue')} #{connectionDisplayId}</span>
              <span className="sea-qa-text-orange"> {source_title}</span>
            </a>
          ) : (
            <>
              <span>{gettext('GitHub Issue')} #{connectionDisplayId}</span>
              <span className="sea-qa-text-orange"> {source_title}</span>
            </>
          )}
        </span>
      </div>
    );
  }

  if (source_type === CONNECTION_TYPE.DISCOURSE_FORUM) {
    return (
      <div className="ticket-header">
        <span className="ticket-icon">
          <img src={`${mediaUrl}/img/connection/discourse-logo.png`} alt="Discourse Forum" width={16} height={16} />
        </span>
        <span className="ticket-title">
          {href ? (
            <a
              href={href}
              onClick={(event) => event.stopPropagation()}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>{gettext('Discourse Forum')} #{connectionDisplayId}</span>
              <span className="sea-qa-text-orange"> {source_title}</span>
            </a>
          ) : (
            <>
              <span>{gettext('Discourse Forum')} #{connectionDisplayId}</span>
              <span className="sea-qa-text-orange"> {source_title}</span>
            </>
          )}
        </span>
      </div>
    );
  }

  if (source_type === CONNECTION_TYPE.EMAIL) {
    return (
      <div className="ticket-header">
        <span className="ticket-icon">
          <img src={`${mediaUrl}/img/connection/email.png`} alt="Email" width={16} height={16} />
        </span>
        <span className="ticket-title">
          {href ? (
            <a
              href={href}
              onClick={(event) => event.stopPropagation()}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>{gettext('Email')} #{connectionDisplayId}</span>
              <span className="sea-qa-text-orange"> {source_title}</span>
            </a>
          ) : (
            <>
              <span>{gettext('Email')} #{connectionDisplayId}</span>
              <span className="sea-qa-text-orange"> {source_title}</span>
            </>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="ticket-header">
      <span className="ticket-icon">
        <img src={`${mediaUrl}/img/connection/ticket.png`} alt="Ticket" width={16} height={16} />
      </span>
      <span className="ticket-title">
        <span>{gettext(source_type)} #{connectionDisplayId}:</span>
        <span className="sea-qa-text-orange"> {source_title}</span>
      </span>
    </div>
  );
};

const getUniqueEventTypes = (events) => {
  if (!Array.isArray(events) || events.length === 0) return [];
  const seen = new Set();
  return events.reduce((acc, e) => {
    const type = e && e.type;
    if (type && !seen.has(type)) {
      seen.add(type);
      acc.push(type);
    }
    return acc;
  }, []);
};

const RunCard = ({
  run,
  onConfirmAction,
  onCancelAction,
  onViewContent,
}) => {
  const { id, started_at, items = [], actions = [], events } = run;
  const eventTypes = getUniqueEventTypes(events);

  let isShowResolved;
  let isCardExpanded;
  if (run.status === RUN_STATUS.FAILED) {
    isShowResolved = false;
    isCardExpanded = false;
  }
  else if (run.status === RUN_STATUS.RUNNING) {
    isShowResolved = false;
    isCardExpanded = true;
  }
  else if (run.status === RUN_STATUS.COMPLETED) {
    isShowResolved = !items.some(item => item.actions.some(action => action.status === ACTION_STATUS.PENDING));
    isCardExpanded = !isShowResolved;
  }

  const [isExpanded, setIsExpanded] = useState(isCardExpanded);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showStatisticsDialog, setShowStatisticsDialog] = useState(false);

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

  return (
    <div className={classnames('agent-run-card', { 'run-card-collapsed': !isExpanded })}>
      <div className="run-card-header" >
        <div className="run-card-header-left">
          <span className="run-time">{dayjs(started_at).format('YYYY-MM-DD HH:mm')}</span>
          <span className="run-id">{gettext('Run')} #{id}</span>
          {eventTypes.map(type => (
            <span key={type} className="run-event-type-badge">{type}</span>
          ))}
          {isShowResolved &&
            <span className="run-card-resolved">
              <Icon symbol="check-circle" className="mr-1" />
              {gettext('Resolved')}
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
                tip={gettext('More options')}
                className="sea-ticket-project-refresh-btn"
                placement="bottom"
                hoverBackground={true}
              />
            </DropdownToggle>
            <DropdownMenu right>
              <DropdownItem onClick={handleShowStatistics}>
                {gettext('Running log details')}
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
          <IconTooltip
            icon="arrow-down"
            tip={isExpanded ? gettext('Collapse') : gettext('Expand')}
            className={classnames('sea-ticket-project-refresh-btn', { 'rotate-180': isExpanded })}
            placement="bottom"
            hoverBackground={true}
            onClick={toggleExpand}
          />
        </div>
      </div>

      {isExpanded && (
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
      )}
      {showStatisticsDialog && (
        <RunStatisticsDialog run={run} onToggle={handleCloseStatistics} />
      )}
    </div>
  );
};

export default RunCard;
