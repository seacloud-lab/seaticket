import React, { useState, useCallback, useEffect } from 'react';
import classnames from 'classnames';
import { Button } from 'reactstrap';
import { gettext } from '@/constants';
import { ACTION_STATUS, ACTION_TYPE, SUGGESTION_TOOL_NAME_MAP, ACTION_ICON_MAPPER } from './constants';
import { Icon, IconButton, IconTooltip, CustomizeMarkdownViewer } from '@/components';
import AIReply from '@/project/components/ai-reply';

const { projectUuid, projectName } = window?.app?.pageOptions || {};

const ActionItem = React.memo(({
  action,
  runId,
  onConfirm,
  onCancel,
  onViewContent,
}) => {
  const { id, type, status, result, tool_name, sources } = action;
  const [isExpanded, setIsExpanded] = useState(false);
  const [isThoughtExpanded, setIsThoughtExpanded] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

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

  const handleViewContent = useCallback((e) => {
    e.stopPropagation();
    onViewContent && onViewContent(action, runId);
  }, [action, runId, onViewContent]);

  const formatErrorMessage = (errorContent) => {
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
        return 'suitable-issue-type-or-lables';
      }
      case 'suggest_assign_labels': {
        return 'suitable-issue-type-or-lables';
      }
      case 'suggest_notify_assignee': {
        return 'notifications-filled';
      }
      default:
        return 'reply-filled';
    }
  };

  const renderContent = () => {
    const isCompletedStatus = [ACTION_STATUS.COMPLETED, ACTION_STATUS.EXECUTED].includes(status);

    switch (type) {
      case ACTION_TYPE.EVENTS:
        return (
          <div className="action-content action-content-events">
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
        return (
          <div className="action-content action-content-suggestion">
            <div className="action-label">{gettext('Suggestion')}</div>
            <div className="action-card">
              <div className="action-card-header d-flex align-items-center">
                <Icon symbol={renderSuggestionIcon() } className="mr-2" />
                <span style={status === ACTION_STATUS.CANCELLED ? { textDecoration: 'line-through', opacity: 0.65 } : {}}>{result}</span>
                {hasEditableContent && status !== ACTION_STATUS.CANCELLED && (
                  <IconTooltip
                    icon="edit"
                    tip={gettext('Edit content')}
                    tooltipClassName='action-item-edit-content-tooltip'
                    className='seaqa-project-refresh-btn'
                    placement="top"
                    hoverBackground={true}
                    onClick={handleViewContent}
                  />
                )}
              </div>
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
                <div className="tool-result suggestion-tool-result" style={{ background: '#EDF8E2', marginLeft: '22px' }}>
                  <span className="status-completed">
                    <Icon symbol="check-circle-filled" />
                  </span>
                  <span className="result-text">{result}</span>
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
