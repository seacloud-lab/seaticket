import React, { useState, useCallback } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';

const ACTION_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXECUTED: 'executed',
};

const ACTION_TYPE = {
  ANALYSIS: 'analysis',
  TOOL_CALL: 'tool_call',
  SUGGESTION: 'suggestion',
  SUMMARY: 'summary',
};

const ActionItem = ({
  action,
  runId,
  onConfirm,
  onCancel,
  onViewContent,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { type, status, content, result, tool_name, suggestion_text } = action;

  const toggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const handleConfirm = useCallback((e) => {
    e.stopPropagation();
    onConfirm && onConfirm(action.id);
  }, [action.id, onConfirm]);

  const handleCancel = useCallback((e) => {
    e.stopPropagation();
    onCancel && onCancel(action.id);
  }, [action.id, onCancel]);

  const handleViewContent = useCallback((e) => {
    e.stopPropagation();
    onViewContent && onViewContent(action, runId);
  }, [action, runId, onViewContent]);

  const renderIcon = () => {
    switch (type) {
      case ACTION_TYPE.ANALYSIS:
        return <span className="action-icon">🤔</span>;
      case ACTION_TYPE.TOOL_CALL:
        return <span className="action-icon">🔧</span>;
      case ACTION_TYPE.SUGGESTION:
        return <span className="action-icon">📝</span>;
      case ACTION_TYPE.SUMMARY:
        return <span className="action-icon">✍️</span>;
      default:
        return <span className="action-icon">•</span>;
    }
  };

  const renderStatusIcon = () => {
    if (status === ACTION_STATUS.COMPLETED || status === ACTION_STATUS.EXECUTED) {
      return <span className="status-icon status-completed">✅</span>;
    }
    return null;
  };

  const renderContent = () => {
    switch (type) {
      case ACTION_TYPE.ANALYSIS:
        return (
          <div className="action-content">
            <span className="action-label">{gettext('Analysis')}:</span>
            <span className="action-text">{content}</span>
          </div>
        );
      case ACTION_TYPE.TOOL_CALL:
        return (
          <div className="action-content">
            <div className="tool-call-header">
              <span className="action-label">{gettext('Tool call')}:</span>
              <span className="tool-name">{tool_name}</span>
            </div>
            {result && (
              <div className="tool-result">
                {renderStatusIcon()}
                <span className="result-text">{result}</span>
              </div>
            )}
          </div>
        );
      case ACTION_TYPE.SUGGESTION:
        return (
          <div className="action-content">
            <span className="action-label">{gettext('Suggestion')}:</span>
            <span className="action-text">{suggestion_text}</span>
            {status === ACTION_STATUS.PENDING && (
              <div className="action-buttons">
                <button className="action-btn view-btn" onClick={handleViewContent}>
                  [{gettext('View content')}]
                </button>
                <button className="action-btn confirm-btn" onClick={handleConfirm}>
                  [{gettext('Confirm')}]
                </button>
                <button className="action-btn cancel-btn" onClick={handleCancel}>
                  [{gettext('Cancel')}]
                </button>
              </div>
            )}
            {(status === ACTION_STATUS.EXECUTED || status === ACTION_STATUS.COMPLETED) && (
              <div className="tool-result">
                {renderStatusIcon()}
                <span className="result-text">{result}</span>
              </div>
            )}
          </div>
        );
      case ACTION_TYPE.SUMMARY:
        return (
          <div className="action-content">
            <span className="action-label">{gettext('Summary')}:</span>
            <span className="action-text">{content}</span>
          </div>
        );
      default:
        return <div className="action-content">{content}</div>;
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
};

export default ActionItem;
