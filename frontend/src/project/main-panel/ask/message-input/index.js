import React, { useCallback, useRef, useState, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { IconButton, ClickOutside } from '@/components';
import { gettext } from '@/constants';
import * as CommonlyUsedHotkey from '@/utils/hotkey';
import { Utils } from '@/utils/utils';
import { getType } from '@/utils/type-detection';
import InputUtils from '@/utils/input-utils';
import { CHAT_MESSAGE_TYPE, AI_RESOLVE_TYPE } from '../constants';
import ResolveType from './resolve-type';
import Ticket from './ticket';

import './index.css';

const MessageInput = forwardRef(({ isReply, readOnly, sendMessage, projectUuid }, ref) => {
  const [containerFocus, setContainerFocus] = useState(true);
  const inputUtils = useMemo(() => new InputUtils(), []);
  const [resolveType, setResolveType] = useState(AI_RESOLVE_TYPE.ASK);
  const [value, setValue] = useState('');
  const [ticket, setTicket] = useState(null);

  const inputContentRef = useRef(null);
  const inputRef = useRef(null);
  const rangeRef = useRef(null);
  const previewContentRef = useRef(null);

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
    sendMessage({ resolveType, message: value, ticket: ticket?._id });
  }, [resolveType, value, ticket, sendMessage]);

  const onKeyUp = useCallback((event) => {
    if (!(CommonlyUsedHotkey.isModUp(event) || CommonlyUsedHotkey.isModDown(event))) {
      const selection = window.getSelection();
      rangeRef.current = selection.getRangeAt(0);
    }
  }, []);

  const onKeyDown = useCallback((event) => {
    if (CommonlyUsedHotkey.isShiftEnter(event)) return;

    const keyCode = event.keyCode;
    if (keyCode === Utils.keyCodes.enter) {
      event.preventDefault();
      onSendMessage();
      return;
    }
  }, [onSendMessage, setAsk]);

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
      previewContentRef.current.textContent = value;
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

  const disabled = isReply || readOnly;

  return (
    <div className={classnames('sea-qa-ai-ask-chat-input-wrapper', { 'disabled': disabled })}>
      <ClickOutside onClickOutside={onContainerBlur}>
        <div className={classnames('sea-qa-ai-ask-chat-input-container', { 'focus': containerFocus })} onClick={disabled ? () => {} : handleFocus}>
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
              placeholder={gettext('What problem you want to solve?')}
              tabIndex={-1}
              rows={1}
              disabled={disabled}
            />
            <div ref={previewContentRef} className="message-input message-input-preview"></div>
          </div>
          <div className="sea-qa-ai-ask-chat-operations-container">
            <div className="sea-qa-ai-ask-chat-operations-container-left">
              <ResolveType resolveType={resolveType} updateResolveType={setResolveType} />
              <Ticket projectUuid={projectUuid} value={ticket} onChange={setTicket} />
            </div>
            <IconButton
              disabled={disabled}
              icon="send"
              className="sea-qa-ai-ask-icon-btn icon-send-wrapper"
              onClick={disabled ? () => {} : onSendMessage}
            />
          </div>
        </div>
      </ClickOutside>
    </div>
  );
});

MessageInput.propTypes = {
  isReply: PropTypes.bool,
  readOnly: PropTypes.bool,
  sendMessage: PropTypes.func.isRequired,
};

export default MessageInput;
