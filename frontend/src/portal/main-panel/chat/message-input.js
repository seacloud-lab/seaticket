import React, { useCallback, useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import classnames from 'classnames';
import { IconButton, ClickOutside } from '@/components';
import { gettext } from '@/constants';
import { Utils } from '@/utils/utils';
import ModelSelector from '@/project/main-panel/ask/chat-input/ai-model-selector';

import '@/project/main-panel/ask/chat-input/index.css';

const MessageInput = forwardRef(({
  isReply,
  placeholder = gettext('Type your question...'),
  sendMessage,
}, ref) => {
  const [containerFocus, setContainerFocus] = useState(true);
  const [value, setValue] = useState('');
  const [selectedModel, setSelectedModel] = useState(null);

  const inputRef = useRef(null);
  const previewContentRef = useRef(null);

  const onValueChange = useCallback((event) => {
    setValue(event.target.value);
  }, []);

  const onSendMessage = useCallback((event) => {
    event && event.stopPropagation();
    event && event.nativeEvent?.stopImmediatePropagation();
    sendMessage({
      message: value,
      model: selectedModel
    });
  }, [value, selectedModel, sendMessage]);

  const onKeyDown = useCallback((event) => {
    if (event.shiftKey && event.keyCode === Utils.keyCodes.enter) return;
    if (event.keyCode === Utils.keyCodes.enter) {
      event.preventDefault();
      onSendMessage();
      return;
    }
  }, [onSendMessage]);

  const onContainerBlur = useCallback(() => {
    setContainerFocus(false);
  }, []);

  const handleFocus = useCallback(() => {
    setContainerFocus(true);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    inputRef.current && inputRef.current.focus();
  }, []);

  useEffect(() => {
    if (inputRef.current && previewContentRef.current) {
      previewContentRef.current.innerText = value;
    }
  }, [value]);

  useImperativeHandle(ref, () => ({
    clearInput: () => {
      setValue('');
    },
    focusInput: () => {
      setContainerFocus(true);
      inputRef.current?.focus();
    },
    getValue: () => value,
  }), [value]);

  const disabled = isReply;

  return (
    <div className={classnames('sea-qa-ai-ask-chat-input-wrapper', { 'disabled': disabled })}>
      <ClickOutside onClickOutside={onContainerBlur}>
        <div
          className={classnames('sea-qa-ai-ask-chat-input-container', { 'focus': containerFocus })}
          onClick={disabled ? () => {} : handleFocus}
        >
          <div className="sea-qa-ai-ask-chat-input-content">
            <textarea
              autoFocus
              className="message-input-value message-input"
              ref={inputRef}
              value={value}
              onKeyDown={onKeyDown}
              onChange={onValueChange}
              placeholder={placeholder}
              rows={1}
              disabled={disabled}
            />
            <div ref={previewContentRef} className="message-input message-input-preview"></div>
          </div>
          <div className="sea-qa-ai-ask-chat-operations-container">
            <div className="sea-qa-ai-ask-chat-operations-container-left">
            </div>
            <div className="sea-qa-ai-ask-chat-operations-container-right">
              <ModelSelector selectedModel={selectedModel} updateModel={setSelectedModel} />
              <IconButton
                disabled={disabled || !value.trim()}
                icon="btn-send"
                className="sea-qa-ai-ask-icon-btn icon-send-wrapper no-hover-bg"
                onClick={disabled ? () => {} : onSendMessage}
                title={gettext('Send')}
                aria-label={gettext('Send')}
              />
            </div>
          </div>
        </div>
      </ClickOutside>
    </div>
  );
});

export default MessageInput;
