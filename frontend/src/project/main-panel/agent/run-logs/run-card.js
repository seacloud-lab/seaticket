import React, { useState, useCallback } from 'react';
import classnames from 'classnames';
import ActionItem from './action-item';
import { gettext, siteRoot } from '@/constants';
import { BAR_TYPE } from '@/project/constants';

const { workspaceID, projectName } = window.app.pageOptions;

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

  const { id, started_at, tickets = [], actions = [] } = run;

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
          {tickets.map((ticket, index) => (
            <div key={ticket.id || index} className="run-ticket-section">
              <div className="ticket-header">
                <span className="ticket-icon">📋</span>
                <span className="ticket-title">
                  <a
                    href={`${siteRoot}workspace/${workspaceID}/project/${projectName}/${BAR_TYPE.TICKET}/${ticket.id}/`}
                    onClick={(event) => event.stopPropagation()}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ticket #{ticket.id}: {ticket.title}
                  </a>
                </span>
              </div>
              <div className="ticket-actions">
                {(ticket.actions || []).map((action, actionIndex) => (
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

          {/* If no tickets but has actions directly */}
          {tickets.length === 0 && actions.length > 0 && (
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
