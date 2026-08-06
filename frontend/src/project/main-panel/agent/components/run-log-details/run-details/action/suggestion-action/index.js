import React, { useState, useCallback, useEffect, useMemo } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { ACTION_STATUS, SUGGESTION_TOOL_NAME_MAP } from '../../../../../constants';
import { Icon, IconTooltip, IconPopoverTip, IconButton, SecondaryBtn } from '@/components';
import SuggestionPreview from './suggestion-preview';
import { parseSuggestionActionResult, getAgentResource } from '../../../../../utils';
import RunLogTitle from '../../../../resource-title';

import './index.css';

const SuggestionAction = ({
  runId,
  action,
  isShowTitle,
  onConfirm,
  onCancel,
  onViewContent,
}) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const {
    id,
    status,
    result,
    tool_name,
    suggestion_text,
    suggestion_content,
    suggestion_reason,
  } = action;

  const resource = useMemo(() => getAgentResource(action), [action]);

  const handleConfirm = useCallback((e) => {
    e.stopPropagation();
    if (isConfirming || !onConfirm) return;

    setIsConfirming(true);
    const confirmResult = onConfirm(id);
    if (confirmResult && typeof confirmResult.finally === 'function') {
      confirmResult.finally(() => setIsConfirming(false));
    }
  }, [id, isConfirming, onConfirm]);

  const handleCancel = useCallback((e) => {
    e.stopPropagation();
    onCancel && onCancel(id);
  }, [id, onCancel]);

  const handleEditContent = useCallback((e) => {
    e.stopPropagation();
    onViewContent && onViewContent(runId, id, 'edit');
  }, [runId, id, onViewContent]);

  const handleViewDetails = useCallback((e) => {
    e.stopPropagation();
    onViewContent && onViewContent(runId, id, 'view');
  }, [runId, id, onViewContent]);

  const renderSuggestionIcon = useCallback(() => {
    switch (tool_name) {
      case 'suggest_reply': {
        return 'reply-filled';
      }
      case 'suggest_create_ticket': {
        return 'ticket-filled';
      }
      case 'suggest_modify_type': {
        return 'suitable-issue-type-or-labels';
      }
      case 'suggest_assign_labels': {
        return 'suitable-issue-type-or-labels';
      }
      case 'suggest_notify_assignee': {
        return 'notifications-filled';
      }
      case 'suggest_move_to_spam': {
        return 'trash';
      }
      default:
        return 'reply-filled';
    }
  }, [tool_name]);

  const renderSuggestionReasonTooltip = useCallback(() => {
    if (!suggestion_reason) return null;

    return (
      <IconPopoverTip
        icon="question-circle-stroked"
        tip={suggestion_reason}
        className="suggestion-reason-tooltip mx-0"
        onClick={(e) => e.stopPropagation()}
      />
    );
  }, [suggestion_reason]);

  const renderTicketLink = useCallback((ticket, customText) => {
    if (!ticket?.ticket_url) return null;
    const linkText = customText || ticket.ticket_title || `${gettext('Ticket')} #${ticket.ticket_pk}`;
    return (
      <>
        <a
          className="seaqa-agent-ticket-result-link"
          href={ticket.ticket_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {linkText}
        </a>
      </>
    );
  }, []);

  const renderCompletedTicketMessage = useCallback((ticket, message = '') => {
    const normalizedMessage = typeof message === 'string' ? message : String(message || '');
    const ticketRef = ticket?.ticket_pk ? `#${ticket.ticket_pk}` : '';
    if (!ticketRef) return normalizedMessage;

    const ticketLink = renderTicketLink(ticket, ticketRef);
    if (!ticketLink) return normalizedMessage;

    const ticketIndex = normalizedMessage.indexOf(ticketRef);
    if (ticketIndex === -1) {
      return (
        <>
          {ticketLink}
          {normalizedMessage ? <span> {normalizedMessage}</span> : null}
        </>
      );
    }

    const before = normalizedMessage.slice(0, ticketIndex);
    const after = normalizedMessage.slice(ticketIndex + ticketRef.length);
    return (
      <>
        {before}
        {ticketLink}
        {after}
      </>
    );
  }, [renderTicketLink]);

  useEffect(() => {
    if (status !== ACTION_STATUS.PENDING) {
      setIsConfirming(false);
    }
  }, [status]);

  const isCompletedStatus = [ACTION_STATUS.COMPLETED, ACTION_STATUS.EXECUTED].includes(status);
  const isFailedStatus = status === ACTION_STATUS.FAILED;
  const isExecutingStatus = status === ACTION_STATUS.EXECUTING;

  const hasEditableContent = SUGGESTION_TOOL_NAME_MAP[tool_name];
  const hasContent = !!suggestion_content;
  const isCancelled = status === ACTION_STATUS.CANCELLED;
  const canEdit = hasEditableContent && hasContent && status === ACTION_STATUS.PENDING;
  const showActions = !isCancelled && (canEdit || hasContent);
  const parsedResult = parseSuggestionActionResult(result);
  return (
    <div className="seaqa-agent-suggestion-action-container d-flex flex-column w-100">
      {isShowTitle && (
        <div className="seaqa-agent-action-suggestion-resource-info d-flex align-items-center">
          <div className="seaqa-agent-action-suggestion-resource-icon d-flex align-items-center justify-content-center">
            <img src={resource.icon} alt="" />
          </div>
          <div className="seaqa-agent-action-suggestion-resource-type-order text-secondary font-size-12">
            {`${resource.type_name} #${resource._id}`}
          </div>
          <RunLogTitle resource={resource} className="seaqa-agent-action-suggestion-resource-title flex-1 text-truncate font-size-12 line-height-20" />
        </div>
      )}
      <div className={classnames('seaqa-agent-action-suggestion-card', { 'seaqa-agent-action-suggestion-card-cancelled': isCancelled })}>
        <div className="seaqa-agent-action-suggestion-card-header d-flex align-items-center">
          <Icon symbol={renderSuggestionIcon()} />
          {suggestion_text && (
            <div className="seaqa-agent-action-suggestion-text-container">
              <span className="text-truncate seaqa-agent-action-suggestion-text" title={suggestion_text}>{suggestion_text}</span>
              {!isCancelled && (<>{renderSuggestionReasonTooltip()}</>)}
            </div>
          )}
          {isCancelled && (<span className="flex-shrink-0">{parsedResult.message}</span>)}
          {showActions && (
            <div className="seaqa-agent-action-suggestion-ops-container ml-auto d-flex align-items-center">
              {canEdit && (
                <IconTooltip
                  icon="edit"
                  tip={gettext('Edit')}
                  className="m-0"
                  placement="bottom"
                  hoverBackground={true}
                  size={{ btn: 24, icon: 16 }}
                  onClick={handleEditContent}
                />
              )}
              {hasContent && (
                <IconTooltip
                  icon="view-issue"
                  tip={gettext('Details')}
                  className="m-0"
                  placement="bottom"
                  hoverBackground={true}
                  size={{ btn: 24, icon: 16 }}
                  onClick={handleViewDetails}
                />
              )}
            </div>
          )}
        </div>
        {hasContent && !isCancelled && (
          <SuggestionPreview type={tool_name} value={suggestion_content} />
        )}
        {status === ACTION_STATUS.PENDING && (
          <div className="seaqa-agent-action-buttons d-flex align-items-center mt-2">
            <SecondaryBtn icon="approve" isSmall={true} text={gettext('Approve')} disabled={isConfirming} onClick={handleConfirm} />
            <SecondaryBtn icon="close" isSmall={true} text={gettext('Discard')} onClick={handleCancel} />
          </div>
        )}
        {isExecutingStatus && (
          <div className="seaqa-agent-action-suggestion-resolved d-flex align-items-center">
            <span className="seaqa-agent-action-tool-result-text">{gettext('Executing...')}</span>
          </div>
        )}
        {isCompletedStatus && (
          <div className="seaqa-agent-action-suggestion-resolved d-flex align-items-center">
            <IconButton icon="check-circle-filled" className="no-hover-bg" iconClassName="text-success" size={16} />
            <span className="seaqa-agent-action-tool-result-text">
              {parsedResult.ticket ? (
                renderCompletedTicketMessage(parsedResult.ticket, parsedResult.message)
              ) : (
                parsedResult.message
              )}
            </span>
          </div>
        )}
        {isFailedStatus && (
          <div className="seaqa-agent-suggestion-action-result-failed">
            <IconButton icon="close" className="no-hover-bg" iconClassName="text-danger" size={{ btn: 20, icon: 12 }} />
            <div className="seaqa-agent-action-tool-result-text">
              {parsedResult.message}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuggestionAction;
