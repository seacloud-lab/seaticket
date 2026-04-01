import React, { useState, useCallback } from 'react';
import classnames from 'classnames';
import ActionItem from './action-item';
import { gettext, siteRoot } from '@/constants';
import { BAR_TYPE } from '@/project/constants';

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

const ItemHeader = ({ item }) => {
  const { source_type, source_id, source_title } = item;

  if (source_type === SOURCE_TYPE.TICKET) {
    return (
      <div className="ticket-header">
        <span className="ticket-icon">📋</span>
        <span className="ticket-title">
          <a
            href={`${siteRoot}workspace/${workspaceID}/project/${projectName}/${BAR_TYPE.TICKET}/${source_id}/`}
            onClick={(event) => event.stopPropagation()}
            target="_blank"
            rel="noopener noreferrer"
          >
            {gettext('Ticket')} #{source_id}: {source_title}
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
        <span className="ticket-icon">🐙</span>
        <span className="ticket-title">
          {href ? (
            <a
              href={href}
              onClick={(event) => event.stopPropagation()}
              target="_blank"
              rel="noopener noreferrer"
            >
              {gettext('GitHub Issue')} #{source_id}: {source_title}
            </a>
          ) : (
            <>
              {gettext('GitHub Issue')} #{source_id}: {source_title}
            </>
          )}
        </span>
      </div>
    );
  }

  if (source_type === SOURCE_TYPE.DISCOURSE_FORUM) {
    return (
      <div className="ticket-header">
        <span className="ticket-icon">💬</span>
        <span className="ticket-title">
          {href ? (
            <a
              href={href}
              onClick={(event) => event.stopPropagation()}
              target="_blank"
              rel="noopener noreferrer"
            >
              {gettext('Discourse Forum')} #{source_id}: {source_title}
            </a>
          ) : (
            <>
              {gettext('Discourse Forum')} #{source_id}: {source_title}
            </>
          )}
        </span>
      </div>
    );
  }

  if (source_type === SOURCE_TYPE.EMAIL) {
    return (
      <div className="ticket-header">
        <span className="ticket-icon">✉️</span>
        <span className="ticket-title">
          {href ? (
            <a
              href={href}
              onClick={(event) => event.stopPropagation()}
              target="_blank"
              rel="noopener noreferrer"
            >
              {gettext('Email')} #{source_id}: {source_title}
            </a>
          ) : (
            <>
              {gettext('Email')} #{source_id}: {source_title}
            </>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="ticket-header">
      <span className="ticket-icon">•</span>
      <span className="ticket-title">
        {gettext(source_type)} #{source_id}: {source_title}
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
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const { id, started_at, items = [], actions = [] } = run;

  return (
    <div className={classnames('agent-run-card', { 'run-card-collapsed': !isExpanded })}>
      <div className="run-card-header" onClick={toggleExpand}>
        <div className="run-card-header-left">
          <span className="run-status-dot"></span>
          <span className="run-time">{formatDateTime(started_at)}</span>
          <span className="run-id">{gettext('Run')} #{id}</span>
        </div>
        <div className="run-card-header-right">
          <span className="expand-toggle">
            [{isExpanded ? gettext('Collapse') : gettext('Expand')}]
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="run-card-body">
          {items.map((item, index) => (
            <div key={`${item.source_type}-${item.source_id}-${index}`} className="run-ticket-section">
              <ItemHeader item={item} />
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
