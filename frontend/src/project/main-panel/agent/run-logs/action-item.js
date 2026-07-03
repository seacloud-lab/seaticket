import React, { useState, useCallback, useEffect, useRef } from 'react';
import classnames from 'classnames';
import { Button } from 'reactstrap';
import { gettext } from '@/constants';
import { ACTION_STATUS, ACTION_TYPE, SUGGESTION_TOOL_NAME_MAP, ACTION_ICON_MAPPER } from './constants';
import { Icon, IconButton, IconTooltip, CustomizeMarkdownViewer } from '@/components';
import AIReply from '@/project/components/ai-reply';

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
  const { id, type, status, result, tool_name, sources, suggestion_text, suggestion_content } = action;
  const [isExpanded, setIsExpanded] = useState(false);
  const [isThoughtExpanded, setIsThoughtExpanded] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showPreviewMask, setShowPreviewMask] = useState(false);
  const previewRef = useRef(null);

  useEffect(() => {
    if (status !== ACTION_STATUS.PENDING) {
      setIsConfirming(false);
    }
  }, [status]);

  const toggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

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

  const updatePreviewMask = useCallback(() => {
    const el = previewRef.current;
    if (!el) return;
    const isOverflow = el.scrollHeight > el.clientHeight;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 1;
    setShowPreviewMask(isOverflow && !isAtBottom);
  }, []);

  useEffect(() => {
    updatePreviewMask();
  }, [suggestion_content, status, updatePreviewMask]);

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
          <ul className="error-list mb-0">
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
    const ticketLabel = ticket?.ticket_pk ? `${gettext('Ticket')} #${ticket.ticket_pk}` : '';
    if (!ticketLabel) return normalizedMessage;

    const ticketLink = renderTicketLink(ticket, ticketLabel);
    if (!ticketLink) return normalizedMessage;

    const ticketIndex = normalizedMessage.indexOf(ticketLabel);
    if (ticketIndex === -1) {
      return (
        <>
          {ticketLink}
          {normalizedMessage ? <span> {normalizedMessage}</span> : null}
        </>
      );
    }

    const before = normalizedMessage.slice(0, ticketIndex);
    const after = normalizedMessage.slice(ticketIndex + ticketLabel.length);
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
    let symbol = ACTION_ICON_MAPPER[type];
    if (!symbol) return null;
    return (
      <span className="action-item-icon">
        <Icon symbol={symbol} style={type === ACTION_TYPE.ERROR ? { fill: '#FF0000' } : {}} />
      </span>
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

  const renderContent = () => {
    const isCompletedStatus = [ACTION_STATUS.COMPLETED, ACTION_STATUS.EXECUTED].includes(status);
    const isFailedStatus = status === ACTION_STATUS.FAILED;

    switch (type) {
      case ACTION_TYPE.EVENT:
        return (
          <div className="action-content action-content-event">
            <div className="action-label">{gettext('Event')}</div>
            {result && <CustomizeMarkdownViewer value={result} showTOC={false} />}
          </div>
        );
      case ACTION_TYPE.ANALYSIS:
        return (
          <div className="action-content action-content-analysis">
            <div className="action-label">{gettext('Analysis')}</div>
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
          <div className="action-content">
            <div className="tool-call-header">
              <div className="action-label">{gettext('Tool call')}: {tool_name}</div>
            </div>
            {result && (
              <div className="tool-result tool-call">
                {isCompletedStatus && (
                  <span className="status-completed">
                    <Icon symbol="check-mark" />
                  </span>
                )}
                <span className="tool-call-content">{result}</span>
              </div>
            )}
          </div>
        );
      case ACTION_TYPE.SUGGESTION: {
        const hasEditableContent = SUGGESTION_TOOL_NAME_MAP[tool_name];
        const hasContent = !!suggestion_content;
        const isCancelled = status === ACTION_STATUS.CANCELLED;
        const canEdit = hasEditableContent && status === ACTION_STATUS.PENDING;
        const showHeaderActions = !isCancelled && (canEdit || hasContent);
        const parsedResult = parseActionResult(result);
        return (
          <div className="action-content action-content-suggestion">
            <div className="action-label">{gettext('Suggestion')}</div>
            <div className={classnames('action-card', { 'action-card-cancelled': isCancelled })}>
              {isCancelled && (
                <div className="suggestion-cancelled-result d-flex align-items-center">
                  <Icon symbol={renderSuggestionIcon()} className="mr-2" />
                  {suggestion_text && (
                    <span className="suggestion-cancelled-text">{suggestion_text}</span>
                  )}
                  <span className="suggestion-cancelled-by">{parsedResult.message}</span>
                </div>
              )}
              {!isCancelled && (
                <div className="action-card-header d-flex align-items-center">
                  <Icon symbol={renderSuggestionIcon() } className="mr-2" />
                  <span>{suggestion_text}</span>
                  {showHeaderActions && (
                    <div className="suggestion-header-actions ml-auto d-flex align-items-center">
                      {canEdit && (
                        <IconTooltip
                          icon="edit"
                          tip={gettext('Edit')}
                          tooltipClassName='action-item-edit-content-tooltip'
                          className='suggestion-header-action-btn'
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
                          tooltipClassName='action-item-edit-content-tooltip'
                          className='suggestion-header-action-btn'
                          placement="bottom"
                          hoverBackground={true}
                          size={{ btn: 24, icon: 16 }}
                          onClick={handleViewDetails}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
              {hasContent && !isCancelled && (
                <div className="suggestion-content-preview">
                  <div
                    className="suggestion-content-preview-scroll"
                    ref={previewRef}
                    onScroll={updatePreviewMask}
                  >
                    {suggestion_content}
                  </div>
                  {showPreviewMask && <div className="suggestion-content-preview-mask" />}
                </div>
              )}
              {status === ACTION_STATUS.PENDING && (
                <div className="action-buttons">
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
              {isCompletedStatus && (
                <div className="suggestion-result-resolved d-flex align-items-center">
                  <span className="status-completed">
                    <Icon symbol="check-circle-filled" />
                  </span>
                  <span className="result-text">
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
                  className="tool-result suggestion-tool-result suggestion-tool-result-failed"
                  style={{ marginLeft: '22px' }}
                >
                  <span className="status-failed">
                    <Icon symbol="close" />
                  </span>
                  <span className="result-text">
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
          <div className="action-content">
            <div className="action-label">{gettext('Error')}</div>
            <div className="action-text">
              {formatErrorMessage(result)}
            </div>
          </div>
        );
      case ACTION_TYPE.THOUGHT:
        return (
          <div className="action-content">
            <div className={classnames('d-flex align-items-center justify-content-between', { 'mb-1': isThoughtExpanded })}>
              <IconButton
                icon="arrow-down"
                className={classnames('seaqa-project-refresh-btn seaqa-project-refresh-btn-thought', { 'seaqa-project-refresh-btn-expanded': isThoughtExpanded })}
                onClick={toggleThoughtExpand}
              >
                <div className="action-label action-label-thought">{gettext('Thought')}</div>
              </IconButton>
            </div>
            {isThoughtExpanded &&
              <div className="action-text action-text-thought">
                {result && <CustomizeMarkdownViewer value={result} showTOC={false} />}
              </div>
            }
          </div>
        );
      default:
        return <div className="action-content">{result}</div>;
    }
  };

  return (
    <div
      className={classnames('agent-action-item', `action-type-${type}`, {
        'action-expanded': isExpanded,
        'action-pending': status === ACTION_STATUS.PENDING,
        'action-completed': status === ACTION_STATUS.COMPLETED,
        'action-failed': status === ACTION_STATUS.FAILED,
        'action-cancelled': status === ACTION_STATUS.CANCELLED,
      })}
    >
      <div className="action-tree-line"></div>
      <div className="action-header" onClick={toggleExpand}>
        {renderIcon()}
        {renderContent()}
      </div>
    </div>
  );
});

export default ActionItem;
