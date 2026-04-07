import React, { useState, useCallback } from 'react';
import classnames from 'classnames';
import dayjs from 'dayjs';
import ActionItem from './action-item';
import { gettext, siteRoot, mediaUrl } from '@/constants';
import { BAR_TYPE } from '@/project/constants';
import { ACTION_STATUS, RUN_STATUS } from './constants';
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

  const connectionIdParts = typeof source_id === 'string' ? source_id.split('_') : [];
  const connectionId = connectionIdParts[0];
  const recordId = connectionIdParts[1];
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
              <span>{gettext('GitHub Issue')} #{source_id}</span>
              <span className="sea-qa-text-orange"> {source_title}</span>
            </a>
          ) : (
            <>
              <span>{gettext('GitHub Issue')} #{source_id}</span>
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
              <span>{gettext('Discourse Forum')} #{source_id}</span>
              <span className="sea-qa-text-orange"> {source_title}</span>
            </a>
          ) : (
            <>
              <span>{gettext('Discourse Forum')} #{source_id}</span>
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
              <span>{gettext('Email')} #{source_id}</span>
              <span className="sea-qa-text-orange"> {source_title}</span>
            </a>
          ) : (
            <>
              <span>{gettext('Email')} #{source_id}</span>
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
        <span>{gettext(source_type)} #{source_id}:</span>
        <span className="sea-qa-text-orange"> {source_title}</span>
      </span>
    </div>
  );
};

const RunCard = ({
  run,
  onConfirmAction,
  onCancelAction,
  onViewContent,
}) => {
  const { id, started_at, items = [], actions = [] } = run;
  const hasPendingSuggestion = (run.status === RUN_STATUS.RUNNING) && items.some(item => item.actions.some(action => action.status === ACTION_STATUS.PENDING));
  const [isExpanded, setIsExpanded] = useState(hasPendingSuggestion);

  const toggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  return (
    <div className={classnames('agent-run-card', { 'run-card-collapsed': !isExpanded })}>
      <div className="run-card-header" >
        <div className="run-card-header-left">
          <span className="run-time">{dayjs(started_at).format('YYYY-MM-DD HH:mm')}</span>
          <span className="run-id">{gettext('Run')} #{id}</span>
          {!hasPendingSuggestion &&
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
                {(item.actions || []).map((action, actionIndex) => (
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
              {actions.map((action, actionIndex) => (
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
    </div>
  );
};

export default RunCard;
