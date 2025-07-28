import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Button, Input, Form, FormGroup } from 'reactstrap';
import { toaster, CenteredLoading } from '../../../components';
import { seaQAAPI } from '../../../api/web-api';
import { gettext } from '../../../constants';
import { Utils } from '../../../utils/utils';

import './index.css';

const {
  workspaceID, projectUuid
} = window.app.pageOptions;

const Ask = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await seaQAAPI.askQuestion({
        project_uuid: projectUuid,
        workspace_id: workspaceID,
        query: userMessage.content
      });

      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: response.data.answer,
        sources: response.data.sources || [],
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: gettext('Sorry, I encountered an error. Please try again.'),
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
      toaster.danger(Utils.getErrorMsg(error));
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }, [handleSubmit]);

  const formatTime = (timestamp) => {
    return timestamp.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="sea-qa-project-ask">
      <div className="sea-qa-project-ask-messages-container">
        {messages.length === 0 && (
          <div className="sea-qa-project-ask-welcome">
            <div className="sea-qa-project-ask-welcome-text">
              {gettext('Hello! What can I help you with?')}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`sea-qa-project-ask-message ${message.type}`}>
            <div className="sea-qa-project-ask-message-header">
              <div className="sea-qa-project-ask-message-sender">
                {message.type === 'user' ? gettext('You') : 'SeaQA AI Assistant'}
              </div>
              <div className="sea-qa-project-ask-message-time">
                {formatTime(message.timestamp)}
              </div>
            </div>
            <div className={`sea-qa-project-ask-message-content ${message.isError ? 'error' : ''}`}>
              {message.content}
            </div>
            {message.sources && message.sources.length > 0 && (
              <div className="sea-qa-project-ask-message-sources">
                <div className="sea-qa-project-ask-sources-title">{gettext('Sources')}:</div>
                {message.sources.map((source, index) => (
                  <a key={index} href={source.url} target="_blank" rel="noopener noreferrer" className="sea-qa-project-ask-source-link">
                    {source.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="sea-qa-project-ask-message ai">
            <div className="sea-qa-project-ask-message-header">
              <div className="sea-qa-project-ask-message-sender">
                SeaQA AI Assistant
              </div>
              <div className="sea-qa-project-ask-message-time">
                {formatTime(new Date())}
              </div>
            </div>
            <div className="sea-qa-project-ask-message-content">
              <CenteredLoading size="small" />
              <span className="ml-2">{gettext('Thinking...')}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="sea-qa-project-ask-input-container">
        <Form onSubmit={handleSubmit} className="sea-qa-project-ask-form">
          <FormGroup className="sea-qa-project-ask-input-group">
            <Input
              ref={inputRef}
              type="textarea"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={gettext('Ask a question (Ctrl + Enter to send)')}
              className="sea-qa-project-ask-input"
              disabled={isLoading}
              rows={1}
              style={{ resize: 'none' }}
            />
            <Button
              type="submit"
              color="primary"
              disabled={!inputValue.trim() || isLoading}
              className="sea-qa-project-ask-send-btn"
            >
              {gettext('Send')}
            </Button>
          </FormGroup>
        </Form>
      </div>
    </div>
  );
};

export default Ask;
