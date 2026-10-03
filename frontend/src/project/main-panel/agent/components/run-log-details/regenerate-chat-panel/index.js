import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'reactstrap';
import { CommonOperationConfirmationDialog, IconButton, ResizeBar, toaster } from '@/components';
import { gettext } from '@/constants';
import { agentAPI } from '@/project/api';
import { Utils } from '@/utils/utils';
import { getEmailReplyDefaultTo, getSuggestionTitle } from '../../../utils';
import SuggestionPreview from '../run-details/action/suggestion-action/suggestion-preview';

import './index.css';

const { projectUuid } = window.app.pageOptions;

const MIN_WIDTH = 480;
const MAX_WIDTH = 720;
const WIDTH_STORAGE_KEY = 'project_agent_regenerate_chat_panel_width';

const DraftSuggestionCard = ({ action, event }) => {
  const title = useMemo(() => getSuggestionTitle(action), [action]);
  const defaultReplyTo = useMemo(() => getEmailReplyDefaultTo(event), [event]);
  const hasContent = !!action?.suggestion_content;
  return (
    <div className="seaqa-agent-regenerate-draft-card">
      {title && (
        <div className="seaqa-agent-regenerate-draft-title text-truncate" title={title}>{title}</div>
      )}
      {hasContent && (
        <SuggestionPreview
          type={action.tool_name}
          sourceType={action.target_item_type}
          value={action.suggestion_content}
          defaultReplyTo={defaultReplyTo}
        />
      )}
    </div>
  );
};

const RegenerateChatPanel = ({
  run,
  onClose,
  onApplied,
  onDraftsChange,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const ref = useRef(null);
  const messagesRef = useRef(null);
  const generatingRef = useRef(false);

  const latestDrafts = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === 'assistant' && Array.isArray(message.suggestions) && message.suggestions.length > 0) {
        return message.suggestions;
      }
    }
    return [];
  }, [messages]);

  const instructionHistory = useMemo(() => (
    messages
      .filter(message => message.role === 'user' && message.text)
      .map(message => message.text)
      .join('\n')
  ), [messages]);

  const hasUnappliedDrafts = latestDrafts.length > 0 && !isApplying;

  useEffect(() => {
    onDraftsChange && onDraftsChange(hasUnappliedDrafts);
  }, [hasUnappliedDrafts, onDraftsChange]);

  useEffect(() => {
    const width = parseFloat(localStorage.getItem(WIDTH_STORAGE_KEY) || MIN_WIDTH);
    if (ref.current) {
      ref.current.style.width = `${width < MIN_WIDTH ? MIN_WIDTH : Math.min(width, MAX_WIDTH)}px`;
    }
  }, []);

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, isGenerating]);

  const onResize = useCallback((width) => {
    const nextWidth = window.innerWidth - width - 8;
    localStorage.setItem(WIDTH_STORAGE_KEY, nextWidth);
    ref.current.style.width = `${nextWidth}px`;
  }, []);

  const requestClose = useCallback(() => {
    if (isGenerating || isApplying) return;
    if (hasUnappliedDrafts) {
      setShowCloseConfirm(true);
      return;
    }
    onClose();
  }, [hasUnappliedDrafts, isApplying, isGenerating, onClose]);

  const sendInstruction = useCallback((event) => {
    if (event) event.preventDefault();
    const instruction = inputValue.trim();
    if (!instruction || generatingRef.current || isApplying) return;

    generatingRef.current = true;
    setIsGenerating(true);
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', text: instruction }]);

    agentAPI.regenerateAgentRun(projectUuid, run.id, {
      instruction,
      previous_drafts: latestDrafts,
    }).then((res) => {
      const suggestions = res.data?.suggestions || [];
      setMessages(prev => [...prev, { role: 'assistant', suggestions }]);
    }).catch((error) => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setMessages(prev => [...prev, { role: 'assistant', suggestions: [], error: errorMessage }]);
    }).finally(() => {
      generatingRef.current = false;
      setIsGenerating(false);
    });
  }, [inputValue, isApplying, latestDrafts, run.id]);

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendInstruction();
    }
  }, [sendInstruction]);

  const applyDrafts = useCallback(() => {
    if (!latestDrafts.length || isApplying || isGenerating) return;
    setIsApplying(true);
    agentAPI.materializeAgentRun(projectUuid, run.id, {
      instruction: instructionHistory,
      suggestions: latestDrafts,
    }).then((res) => {
      toaster.success(gettext('Suggestions updated'));
      onDraftsChange && onDraftsChange(false);
      onApplied && onApplied(res.data);
      onClose();
    }).catch((error) => {
      toaster.danger(Utils.getErrorMsg(error));
      setIsApplying(false);
    });
  }, [instructionHistory, isApplying, isGenerating, latestDrafts, onApplied, onClose, onDraftsChange, run.id]);

  const canSend = !!inputValue.trim() && !isGenerating && !isApplying;

  return (
    <div className="seaqa-agent-regenerate-chat-panel" ref={ref}>
      <div className="seaqa-agent-regenerate-chat-panel-header">
        <span className="seaqa-agent-regenerate-chat-panel-title text-truncate">
          {gettext('Chat to regenerate')}
        </span>
        <IconButton icon="close" className="flex-shrink-0" onClick={requestClose} />
      </div>
      <div className="seaqa-agent-regenerate-chat-panel-body" ref={messagesRef}>
        {messages.length === 0 && !isGenerating && (
          <div className="seaqa-agent-regenerate-chat-empty text-secondary">
            {gettext('Describe how the suggestions should change.')}
          </div>
        )}
        {messages.map((message, index) => {
          if (message.role === 'user') {
            return (
              <div key={`user-${index}`} className="seaqa-agent-regenerate-message user">
                <div className="seaqa-agent-regenerate-message-bubble">{message.text}</div>
              </div>
            );
          }
          return (
            <div key={`assistant-${index}`} className="seaqa-agent-regenerate-message assistant">
              {message.error && (
                <div className="seaqa-agent-regenerate-error">{message.error}</div>
              )}
              {!message.error && (!message.suggestions || message.suggestions.length === 0) && (
                <div className="text-secondary">{gettext('No suggestions were generated.')}</div>
              )}
              {Array.isArray(message.suggestions) && message.suggestions.map((suggestion, suggestionIndex) => (
                <DraftSuggestionCard
                  key={`${suggestion.tool_name || 'draft'}-${suggestionIndex}`}
                  action={suggestion}
                  event={run.event}
                />
              ))}
            </div>
          );
        })}
        {isGenerating && (
          <div className="seaqa-agent-regenerate-message assistant">
            <div className="text-secondary">{gettext('Generating suggestions...')}</div>
          </div>
        )}
      </div>
      <div className="seaqa-agent-regenerate-chat-panel-composer">
        <textarea
          className="seaqa-agent-regenerate-chat-input"
          value={inputValue}
          placeholder={gettext('Tell the agent how to adjust the suggestions')}
          disabled={isGenerating || isApplying}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
        />
        <div className="seaqa-agent-regenerate-chat-composer-ops">
          <IconButton
            icon="send"
            className="flex-shrink-0"
            disabled={!canSend}
            onClick={sendInstruction}
          />
        </div>
      </div>
      <div className="seaqa-agent-regenerate-chat-panel-footer">
        <Button
          color="primary"
          onClick={applyDrafts}
          disabled={!latestDrafts.length || isGenerating || isApplying}
        >
          {isApplying ? gettext('Applying...') : gettext('Apply this version')}
        </Button>
      </div>
      <ResizeBar
        min={window.innerWidth - MAX_WIDTH - 8}
        max={window.innerWidth - MIN_WIDTH - 8}
        onResize={onResize}
        className="position-absolute h-100"
      />
      {showCloseConfirm && (
        <CommonOperationConfirmationDialog
          title={gettext('Discard draft suggestions?')}
          message={gettext('Unapplied suggestions will be lost.')}
          confirmBtnText={gettext('Discard')}
          executeOperation={onClose}
          toggleDialog={() => setShowCloseConfirm(false)}
        />
      )}
    </div>
  );
};

export default RegenerateChatPanel;
