import React, { useState, useCallback, useEffect } from 'react';
import classnames from 'classnames';
import { Button } from 'reactstrap';
import { gettext } from '@/constants';
import { ACTION_STATUS, ACTION_TYPE, SUGGESTION_TOOL_NAME_MAP, ACTION_ICON_MAPPER } from '../constants';
import { Icon, IconButton, IconTooltip, CustomizeMarkdownViewer, IconPopoverTip } from '@/components';
import AIReply from '@/project/components/ai-reply';
import SuggestionPreview from '../suggestion-preview';

import './index.css';

const { projectUuid, projectName } = window?.app?.pageOptions || {};

const formatResultText = (result) => {
  if (!result) return '';
  if (typeof result === 'string') return result;
  return JSON.stringify(result);
};

const parseActionResult = (result) => {
  if (!result) return { message: '' };

  if (typeof result === 'object') {
    return {
      message: result.message || result.result || JSON.stringify(result),
      ticket: result.ticket,
    };
  }

  if (typeof result !== 'string') {
    return { message: String(result) };
  }

  try {
    const parsed = JSON.parse(result);
    if (parsed && typeof parsed === 'object') {
      return {
        message: parsed.message || result,
        ticket: parsed.ticket,
      };
    }
  } catch {
    return { message: result };
  }

  return { message: result };
};

const ActionItem = React.memo(({
  action,
  runId,
  onConfirm,
  onCancel,
  onViewContent,
}) => {
  const {
    id,
    type,
    status,
    result,
    tool_name,
    sources,
    suggestion_text,
    suggestion_content,
    suggestion_reason,
  } = action;
  const [isThoughtExpanded, setIsThoughtExpanded] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (status !== ACTION_STATUS.PENDING) {
      setIsConfirming(false);
    }
  }, [status]);

  const toggleThoughtExpand = useCallback((e) => {
    e.stopPropagation();
    setIsThoughtExpanded(prev => !prev);
  }, []);

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
    onViewContent && onViewContent(action, runId, 'edit');
  }, [action, runId, onViewContent]);

  const handleViewDetails = useCallback((e) => {
    e.stopPropagation();
    onViewContent && onViewContent(action, runId, 'view');
  }, [action, runId, onViewContent]);

  const formatErrorMessage = (errorContent) => {
    errorContent = formatResultText(errorContent);
    if (!errorContent || !errorContent.includes('geminiException') || !errorContent.includes('Quota exceeded')) {
      return <div>{errorContent}</div>;
    }

    try {
      const jsonStr = errorContent.substring(errorContent.indexOf('{'), errorContent.lastIndexOf('}') + 1);
      const errorData = JSON.parse(jsonStr)?.error;
      if (errorData) {
        return (
          <ul className="seaqa-agent-action-errors mb-0">
            <li>
              <strong>{gettext('Error code')}:</strong> {errorData.code}
            </li>
            <li>
              <strong>{gettext('Error type')}:</strong> {errorData.status}
            </li>
            <li>
              <strong>{gettext('Error message')}:</strong> {errorData.message.split('\n')[0]}
            </li>
            <li>
              <strong>{gettext('Quota limit')}:</strong> {errorData.details?.find(d => d['@type']?.includes('QuotaFailure'))?.violations?.[0]?.quotaValue || gettext('Unknown')} tokens
            </li>
            <li>
              <strong>{gettext('Model')}:</strong> {errorData.details?.find(d => d['@type']?.includes('QuotaFailure'))?.violations?.[0]?.quotaDimensions?.model || gettext('Unknown')}
            </li>
            <li>
              <strong>{gettext('Retry time')}:</strong> {errorData.details?.find(d => d['@type']?.includes('RetryInfo'))?.retryDelay || gettext('Unknown')}
            </li>
          </ul>
        );
      }
    } catch (e) {
      console.warn('Failed to parse error JSON:', e);
    }
    return <div>{errorContent}</div>;
  };

  const renderTicketLink = (ticket, customText) => {
    if (!ticket?.ticket_url) return null;
    const linkText = customText || ticket.ticket_title || `${gettext('Ticket')} #${ticket.ticket_pk}`;
    return (
      <>
        <a
          className="agent-ticket-result-link"
          href={ticket.ticket_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {linkText}
        </a>
      </>
    );
  };

  const renderCompletedTicketMessage = (ticket, message = '') => {
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
  };

  // Don't render SUMMARY and TOOL_CALL type actions
  if (type === ACTION_TYPE.SUMMARY || type === ACTION_TYPE.TOOL_CALL) return null;

  const renderIcon = () => {
    let icon = ACTION_ICON_MAPPER[type];
    if (!icon) return null;
    return (
      <IconButton
        icon={icon}
        className="no-hover-bg"
        iconClassName={type === ACTION_TYPE.ERROR ? 'text-danger' : ''}
        size={{ btn: 22 }}
      />
    );
  };

  const renderSuggestionIcon = () => {
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
  };

  const renderSuggestionReasonTooltip = () => {
    if (!suggestion_reason) return null;

    return (
      <IconPopoverTip
        icon="question-circle-stroked"
        tip={suggestion_reason}
        className="suggestion-reason-tooltip mx-0"
        onClick={(e) => e.stopPropagation()}
      />
    );
  };

  const renderContent = () => {
    const isCompletedStatus = [ACTION_STATUS.COMPLETED, ACTION_STATUS.EXECUTED].includes(status);
    const isFailedStatus = status === ACTION_STATUS.FAILED;
    const isExecutingStatus = status === ACTION_STATUS.EXECUTING;

    switch (type) {
      case ACTION_TYPE.EVENT:
        return (
          <div className="seaqa-agent-action-content seaqa-agent-action-content-event">
            <div className="seaqa-agent-action-label">{gettext('Event')}</div>
            {result && <CustomizeMarkdownViewer value={result} showTOC={false} />}
          </div>
        );
      case ACTION_TYPE.ANALYSIS:
        return (
          <div className="seaqa-agent-action-content seaqa-agent-action-content-analysis">
            <div className="seaqa-agent-action-label">{gettext('Analysis')}</div>
            {result && (
              <AIReply
                message={{ ai_reply: result, sources: Array.isArray(sources) ? sources : [] }}
                projectUuid={projectUuid}
                projectName={projectName}
              />
            )}
          </div>
        );
      case ACTION_TYPE.TOOL_CALL:
        return (
          <div className="seaqa-agent-action-content">
            <div className="seaqa-agent-action-tool-header">
              <div className="seaqa-agent-action-label">{gettext('Tool call')}: {tool_name}</div>
            </div>
            {result && (
              <div className="seaqa-agent-action-tool">
                {isCompletedStatus && (
                  <span className="seaqa-agent-action-tool-status-completed">
                    <Icon symbol="check-mark" />
                  </span>
                )}
                <span className="seaqa-agent-action-tool-content">{result}</span>
              </div>
            )}
          </div>
        );
      case ACTION_TYPE.SUGGESTION: {
        const hasEditableContent = SUGGESTION_TOOL_NAME_MAP[tool_name];
        const hasContent = !!suggestion_content;
        const isCancelled = status === ACTION_STATUS.CANCELLED;
        const canEdit = hasEditableContent && hasContent && status === ACTION_STATUS.PENDING;
        const showActions = !isCancelled && (canEdit || hasContent);
        const parsedResult = parseActionResult(result);
        return (
          <div className="seaqa-agent-action-content seaqa-agent-action-content-suggestion">
            <div className="seaqa-agent-action-label">{gettext('Suggestion')}</div>
            <div className={classnames('seaqa-agent-action-card', { 'seaqa-agent-action-card-cancelled': isCancelled })}>
              <div className="seaqa-agent-action-card-header d-flex align-items-center">
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
                        className="seaqa-agent-action-suggestion-op-btn"
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
                        className="seaqa-agent-action-suggestion-op-btn"
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
                <div className="seaqa-agent-action-buttons">
                  <Button color="secondary" onClick={handleConfirm} size="sm" disabled={isConfirming}>
                    <Icon symbol="approve" className="mr-1" />
                    {gettext('Approve')}
                  </Button>
                  <Button color="secondary" onClick={handleCancel} size="sm">
                    <Icon symbol="close" className="mr-1" />
                    {gettext('Discard')}
                  </Button>
                </div>
              )}
              {isExecutingStatus && (
                <div className="seaqa-agent-action-suggestion-resolved d-flex align-items-center">
                  <span className="seaqa-agent-action-tool-result-text">{gettext('Executing...')}</span>
                </div>
              )}
              {isCompletedStatus && (
                <div className="seaqa-agent-action-suggestion-resolved d-flex align-items-center">
                  <span className="seaqa-agent-action-tool-status-completed">
                    <Icon symbol="check-circle-filled" />
                  </span>
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
                <div
                  className="seaqa-agent-suggestion-action-result seaqa-agent-suggestion-action-result-failed"
                  style={{ marginLeft: '22px' }}
                >
                  <span className="seaqa-agent-action-tool-status-failed">
                    <Icon symbol="close" />
                  </span>
                  <span className="seaqa-agent-action-tool-result-text">
                    {parsedResult.message}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      }
      case ACTION_TYPE.ERROR:
        return (
          <div className="seaqa-agent-action-content">
            <div className="seaqa-agent-action-label">
              {gettext('Error')}
            </div>
            <div className="seaqa-agent-action-text">
              {formatErrorMessage(result)}
            </div>
          </div>
        );
      case ACTION_TYPE.THOUGHT:
        return (
          <div className="seaqa-agent-action-content">
            <div className={classnames('d-flex align-items-center justify-content-between', { 'mb-1': isThoughtExpanded })}>
              <IconButton
                icon="arrow-down"
                className={classnames('seaqa-project-refresh-btn seaqa-project-refresh-btn-thought', { 'seaqa-project-refresh-btn-expanded': isThoughtExpanded })}
                onClick={toggleThoughtExpand}
              >
                <div className="seaqa-agent-action-label seaqa-agent-action-label-thought">{gettext('Thought')}</div>
              </IconButton>
            </div>
            {isThoughtExpanded &&
              <div className="seaqa-agent-action-text seaqa-agent-action-text-thought">
                {result && <CustomizeMarkdownViewer value={result} showTOC={false} />}
              </div>
            }
          </div>
        );
      default:
        return <div className="seaqa-agent-action-content">{result}</div>;
    }
  };

  return (
    <div
      className={classnames('seaqa-agent-action', `seaqa-agent-action-type-${type}`, {
        'seaqa-agent-action-pending': status === ACTION_STATUS.PENDING,
        'seaqa-agent-action-executing': status === ACTION_STATUS.EXECUTING,
        'seaqa-agent-action-completed': status === ACTION_STATUS.COMPLETED,
        'seaqa-agent-action-failed': status === ACTION_STATUS.FAILED,
        'seaqa-agent-action-cancelled': status === ACTION_STATUS.CANCELLED,
      })}
    >
      {renderIcon()}
      {renderContent()}
    </div>
  );
});

export default ActionItem;
