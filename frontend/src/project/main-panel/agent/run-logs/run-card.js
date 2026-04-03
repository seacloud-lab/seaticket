import React, { useState, useCallback } from 'react';
import classnames from 'classnames';
import ActionItem from './action-item';
import { gettext, siteRoot, mediaUrl } from '@/constants';
import { BAR_TYPE } from '@/project/constants';
import { ACTION_STATUS, RUN_STATUS } from './constants';
import IconTooltip from '@/components/icon-tooltip';
import Icon from '@/components/icon';

const { workspaceID, projectName } = window.app.pageOptions;

const SOURCE_TYPE = {
  TICKET: 'ticket',
  GITHUB_ISSUE: 'github_issue',
  DISCOURSE_FORUM: 'discourse_forum',
  EMAIL: 'email',
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

const RunCardHeader = ({ item }) => {
  const { source_type, source_id, source_title } = item;

  if (source_type === SOURCE_TYPE.TICKET) {
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
            <span style={{ color: '#212529' }}>{gettext('Ticket')} #{source_id}</span> {source_title}
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

  if (source_type === SOURCE_TYPE.GITHUB_ISSUE) {
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
              <span style={{ color: '#212529' }}>{gettext('GitHub Issue')} #{source_id}</span> {source_title}
            </a>
          ) : (
            <>
              <span style={{ color: '#212529' }}>{gettext('GitHub Issue')} #{source_id}</span> {source_title}
            </>
          )}
        </span>
      </div>
    );
  }

  if (source_type === SOURCE_TYPE.DISCOURSE_FORUM) {
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
              <span style={{ color: '#212529' }}>{gettext('Discourse Forum')} #{source_id}</span> {source_title}
            </a>
          ) : (
            <>
              <span style={{ color: '#212529' }}>{gettext('Discourse Forum')} #{source_id}</span> {source_title}
            </>
          )}
        </span>
      </div>
    );
  }

  if (source_type === SOURCE_TYPE.EMAIL) {
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
              <span style={{ color: '#212529' }}>{gettext('Email')} #{source_id}</span> {source_title}
            </a>
          ) : (
            <>
              <span style={{ color: '#212529' }}>{gettext('Email')} #{source_id}</span> {source_title}
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
        <span style={{ color: '#212529' }}>{gettext(source_type)} #{source_id}:</span> {source_title}
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
  const hasPendingSuggestion = items.some(item => item.actions.some(action => action.status === ACTION_STATUS.PENDING));
  const [isExpanded, setIsExpanded] = useState(hasPendingSuggestion);

  const toggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  return (
    <div className={classnames('agent-run-card', { 'run-card-collapsed': !isExpanded })}>
      <div className="run-card-header" >
        <div className="run-card-header-left">
          <span className="run-time">{formatDateTime(started_at)}</span>
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
