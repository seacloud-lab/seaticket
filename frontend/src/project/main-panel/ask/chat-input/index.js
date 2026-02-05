import React, { useCallback, useRef, useState, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { IconButton, ClickOutside } from '@/components';
import { gettext } from '@/constants';
import * as CommonlyUsedHotkey from '@/utils/hotkey';
import { Utils } from '@/utils/utils';
import { getType } from '@/utils/type-detection';
import InputUtils from '@/utils/input-utils';
import { CHAT_MESSAGE_TYPE } from '../constants';
import ResolveType from './resolve-type';
import ProjectRecordsSelector from './project-records-selector';
import { useAIChatTools } from '../hooks';
import AIModelSelector from './ai-model-selector';
import AttachmentsFormatter from './attachments';

import './index.css';

const ChatInput = forwardRef(({
  isReply,
  readOnly,
  projectUuid,
  placeholder = gettext('What problem you want to solve?'),
  clearContext,
  sendMessage,
  resetClearContext,
}, ref) => {
  const [containerFocus, setContainerFocus] = useState(true);
  const inputUtils = useMemo(() => new InputUtils(), []);
  const [value, setValue] = useState('');
  const [selectedModel, setSelectedModel] = useState(null);
  const [width, setWidth] = useState(0);

  const inputContentRef = useRef(null);
  const inputRef = useRef(null);
  const rangeRef = useRef(null);
  const previewContentRef = useRef(null);
  const domRef = useRef(null);

  const {
    attachments, updateAttachments, removeAttachment, clearAttachments,
    resolveType, updateResolveType, resetResolveType,
  } = useAIChatTools();

  const onPaste = useCallback((event) => {
    const callBack = (pasteFiles) => {
      // todo;
    };
    inputUtils.onPaste(event, callBack);
  }, [inputUtils]);

  const onValueChange = useCallback((event) => {
    const value = event.target.value;
    setValue(value);
  }, []);

  const inputFocus = useCallback(() => {
    // set cursor at end
    const range = document.createRange();
    range.selectNodeContents(inputRef.current);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    const textNode = range.startContainer;
    range.setStart(textNode, range.endOffset);
    range.setEnd(textNode, range.endOffset);
    range.deleteContents();
    inputRef.current.focus();
    rangeRef.current = range;
  }, []);

  const setAsk = useCallback((messages = []) => {
    if (readOnly) return;
    let text = '';
    messages.forEach(m => {
      const mType = getType(m);
      if (mType === 'String') text += m;
      if (mType === 'Object' && m.type === CHAT_MESSAGE_TYPE.TEXT) text += m.value;
    });

    setValue(text);

    inputFocus();
  }, [readOnly, inputRef, inputFocus]);

  const onSendMessage = useCallback((event) => {
    event && event.stopPropagation();
    event && event.nativeEvent.stopImmediatePropagation();
    sendMessage({
      resolveType,
      message: value,
      attachments,
      model: selectedModel,
      clearContext
    });
    clearAttachments();
    resetClearContext();
  }, [resolveType, value, attachments, selectedModel, sendMessage, clearAttachments, clearContext, resetClearContext]);

  const onKeyUp = useCallback((event) => {
    if (!(CommonlyUsedHotkey.isModUp(event) || CommonlyUsedHotkey.isModDown(event))) {
      const selection = window.getSelection();
      rangeRef.current = selection.getRangeAt(0);
    }
  }, []);

  const onKeyDown = useCallback((event) => {
    if (CommonlyUsedHotkey.isShiftEnter(event)) return;
    if (CommonlyUsedHotkey.isModEnter(event)) {
      event.preventDefault();
      const textarea = inputRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      const newValue = value.substring(0, start) + '\n' + value.substring(end);
      setValue(newValue);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1;
      }, 0);
      return;
    }
    const keyCode = event.keyCode;
    if (keyCode === Utils.keyCodes.enter) {
      event.preventDefault();
      onSendMessage();
      return;
    }
  }, [value, onSendMessage, setAsk]);

  const onMouseUp = useCallback(() => {
    const selection = window.getSelection();
    rangeRef.current = selection.getRangeAt(0);
  }, []);

  const onContainerBlur = useCallback(() => {
    setContainerFocus(false);
  }, []);

  const handleFocus = useCallback((event) => {
    setContainerFocus(true);
    if (event && inputContentRef.current.contains(event.target)) return;
    inputFocus();
  }, [inputFocus]);

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
      setAsk([]);
    },

    setAsk: (messages = []) => {
      setAsk(messages);
      setContainerFocus(true);
      inputRef.current.focus();
    },

    focusInput: () => {
      setContainerFocus(true);
      inputRef.current.focus();
    },

    getProblem: () => {
      return value || '';
    },

    inputWrapper: inputRef?.current.parentNode.parentNode.parentNode,

  }), [value, setAsk, inputRef]);

  useEffect(() => {
    return () => {
      clearAttachments();
      resetResolveType();
    };
  }, []);

  useEffect(() => {
    const dom = domRef.current;
    const handleResize = () => {
      if (!dom) return;
      setWidth(dom.offsetWidth);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    dom && resizeObserver.observe(dom);
  }, []);

  const disabled = isReply || readOnly;
  const isSimple = width <= 673;

  return (
    <div className={classnames('sea-qa-ai-ask-chat-input-wrapper', { 'disabled': disabled })} ref={domRef}>
      <ClickOutside onClickOutside={onContainerBlur}>
        <div className={classnames('sea-qa-ai-ask-chat-input-container', { 'focus': containerFocus })} onClick={disabled ? () => {} : handleFocus}>
          <AttachmentsFormatter value={attachments} projectUuid={projectUuid} onRemove={removeAttachment} />
          <div className="sea-qa-ai-ask-chat-input-content" ref={inputContentRef}>
            <textarea
              autoFocus
              className="message-input-value message-input"
              ref={inputRef}
              value={value}
              onKeyDown={onKeyDown}
              onKeyUp={onKeyUp}
              onMouseUp={onMouseUp}
              onPaste={onPaste}
              onChange={onValueChange}
              placeholder={placeholder}
              tabIndex={-1}
              rows={1}
              disabled={disabled}
            />
            <div ref={previewContentRef} className="message-input message-input-preview"></div>
          </div>
          <div className="sea-qa-ai-ask-chat-operations-container">
            <div className="sea-qa-ai-ask-chat-operations-container-left">
              <ProjectRecordsSelector projectUuid={projectUuid} value={attachments} onChange={updateAttachments} isSimple={isSimple} />
              <ResolveType resolveType={resolveType} updateResolveType={updateResolveType} />
            </div>
            <div className="sea-qa-ai-ask-chat-operations-container-right">
              <AIModelSelector selectedModel={selectedModel} updateModel={setSelectedModel} isSimple={isSimple}/>
              <IconButton
                disabled={disabled || !value}
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

ChatInput.propTypes = {
  isReply: PropTypes.bool,
  readOnly: PropTypes.bool,
  hasHistoryMessages: PropTypes.bool,
  sendMessage: PropTypes.func.isRequired,
};

export default ChatInput;
