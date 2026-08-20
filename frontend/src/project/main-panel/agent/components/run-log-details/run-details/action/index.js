import React, { useState, useCallback } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { ACTION_STATUS, ACTION_TYPE, ACTION_ICON_MAPPER } from '../../../../constants';
import { IconButton, CustomizeMarkdownViewer } from '@/components';
import AIReply from '@/project/components/ai-reply';
import SuggestionAction from './suggestion-action';

import './index.css';

const { projectUuid, projectName } = window?.app?.pageOptions || {};

const formatResultText = (result) => {
  if (!result) return '';
  if (typeof result === 'string') return result;
  return JSON.stringify(result);
};

const parseResult = (result) => {
  if (!result) return null;
  if (typeof result === 'object') return result;
  try {
    return JSON.parse(result);
  } catch (e) {
    return null;
  }
};

const ActionItem = React.memo(({ action, ...props }) => {
  const [isThoughtExpanded, setIsThoughtExpanded] = useState(false);

  const { type, status, result, sources, children } = action;

  const toggleThoughtExpand = useCallback((e) => {
    e.stopPropagation();
    setIsThoughtExpanded(prev => !prev);
  }, []);

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

  const renderIcon = useCallback(() => {
    let icon = ACTION_ICON_MAPPER[type];
    if (!icon) return null;
    return (
      <IconButton
        icon={icon}
        className="no-hover-bg seaqa-agent-action-icon-btn"
        iconClassName={type === ACTION_TYPE.ERROR ? 'text-danger' : ''}
        size={{ icon: 14 }}
      />
    );
  }, [type]);

  const renderContent = useCallback(() => {
    const parsedResult = parseResult(result);
    switch (type) {
      case ACTION_TYPE.PRELUDE:
      case ACTION_TYPE.EVENT: {
        const eventSummary = parsedResult?.event_summary || result;
        return (
          <div className="seaqa-agent-action-container seaqa-agent-event-action-container">
            <div className="seaqa-agent-action-label">{gettext('Event')}</div>
            {eventSummary && <CustomizeMarkdownViewer value={eventSummary} showTOC={false} />}
          </div>
        );
      }
      case ACTION_TYPE.ANALYSIS: {
        const analysisReport = parsedResult?.analysis_report || result;
        return (
          <div className="seaqa-agent-action-container seaqa-agent-analysis-action-container">
            <div className="seaqa-agent-action-label">{gettext('Analysis')}</div>
            {analysisReport && (
              <AIReply
                message={{ ai_reply: analysisReport, sources: Array.isArray(sources) ? sources : [] }}
                projectUuid={projectUuid}
                projectName={projectName}
              />
            )}
          </div>
        );
      }
      case ACTION_TYPE.SUGGESTION: {
        if (!Array.isArray(children) || children.length === 0) return null;
        const firstChild = children[0];
        const { target_source_id, target_source_type } = firstChild;
        const isShowTitle = (
          children.length > 1 &&
          !children.every(child => (
            child.target_source_id === target_source_id &&
            child.target_source_type === target_source_type
          ))
        );
        return (
          <div className="seaqa-agent-action-container seaqa-agent-suggestions-action-container">
            <div className="seaqa-agent-action-label">{gettext('Suggestion')}</div>
            <div className="seaqa-agent-suggestions-action-content d-flex flex-column w-100">
              {children.map(action => (
                <SuggestionAction
                  key={action.id}
                  action={action}
                  isShowTitle={isShowTitle}
                  { ...props }
                />))}
            </div>
          </div>
        );
      }
      case ACTION_TYPE.ERROR: {
        return (
          <div className="seaqa-agent-action-container">
            <div className="seaqa-agent-action-label">
              {gettext('Error')}
            </div>
            <div className="seaqa-agent-action-text">
              {formatErrorMessage(result)}
            </div>
          </div>
        );
      }
      case ACTION_TYPE.THOUGHT: {
        return (
          <div className="seaqa-agent-action-container">
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
      }
      default: {
        return (<div className="seaqa-agent-action-container">{result}</div>);
      }
    }
  }, [isThoughtExpanded, result, sources, type, props, children, toggleThoughtExpand]);

  return (
    <div
      className={classnames('seaqa-agent-action d-flex position-relative', `seaqa-agent-action-type-${type}`, {
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
