import React, { useCallback, useRef, useState, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { IconButton, ClickOutside } from '@/components';
import { gettext } from '@/constants';
import * as CommonlyUsedHotkey from '@/utils/hotkey';
import { getType, Utils } from '@/utils/utils';
import InputUtils from '@/utils/input-utils';
import { CHAT_MESSAGE_TYPE } from '../constants';

import './index.css';

const MessageInput = forwardRef(({ isReply, readOnly, sendMessage, resolveType, setResolveType }, ref) => {
  const [containerFocus, setContainerFocus] = useState(true);
  const inputUtils = useMemo(() => new InputUtils(), []);
  const [isShowSessionToggle, setIsShowSessionToggle] = useState(false);
  const [sessionTogglePanelTranslateY, setSessionTogglePanelTranslateY] = useState(0);

  const inputContentRef = useRef(null);
  const inputRef = useRef(null);
  const rangeRef = useRef(null);

  const onPaste = useCallback((event) => {
    const callBack = (pasteFiles) => {
      // todo;
    };
    inputUtils.onPaste(event, callBack);
  }, [inputUtils]);

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

    inputRef.current.innerText = text;

    inputFocus();
  }, [readOnly, inputRef, inputFocus]);

  const onSendMessage = useCallback((event) => {
    event && event.stopPropagation();
    event && event.nativeEvent.stopImmediatePropagation();
    const text = inputRef.current.innerText;
    sendMessage(text, []);
  }, [sendMessage]);

  const onKeyUp = useCallback((event) => {
    if (!(CommonlyUsedHotkey.isModUp(event) || CommonlyUsedHotkey.isModDown(event))) {
      const selection = window.getSelection();
      rangeRef.current = selection.getRangeAt(0);
    }

    if (event.keyCode === Utils.keyCodes.backspace && inputRef.current.textContent === '') {
      inputRef.current.innerText = '';
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
      return inputRef?.current?.innerText || '';
    },

    inputWrapper: inputRef?.current.parentNode.parentNode.parentNode,

  }), [setAsk, inputRef]);

  const convertToAgent = useCallback(() => {
    setResolveType('agent');
    setIsShowSessionToggle(false);
  }, [resolveType]);

  const convertToAsk = useCallback(() => {
    setResolveType('ask');
    setIsShowSessionToggle(false);
  }, [resolveType]);

  const onClickSessionToggle = useCallback((e) => {
    const inputWrapper = inputRef?.current?.parentNode?.parentNode?.parentNode;
    if (!inputWrapper) return;
    const { bottom } = inputWrapper.getBoundingClientRect();
    const overflowHeight = bottom + 6 + 82; // 6: margin, 82: panel height;
    setSessionTogglePanelTranslateY(overflowHeight > window.innerHeight ? (-(82 + 24 + 6)) : 0); // 24 is button height;
    setIsShowSessionToggle(true);
  }, [inputRef]);

  const disabled = isReply || readOnly;

  return (
    <div className={classnames('sea-qa-ai-ask-chat-input-wrapper', { 'disabled': disabled })}>
      <ClickOutside onClickOutside={onContainerBlur}>
        <div className={classnames('sea-qa-ai-ask-chat-input-container', { 'focus': containerFocus })} onClick={disabled ? () => {} : handleFocus}>
          <div className="sea-qa-ai-ask-chat-input-content" ref={inputContentRef}>
            <div
              autoFocus
              className="message-input"
              ref={inputRef}
              onKeyDown={onKeyDown}
              onKeyUp={onKeyUp}
              onMouseUp={onMouseUp}
              onPaste={onPaste}
              placeholder={gettext('What problem you want to solve?')}
              tabIndex={-1}
              contentEditable={!disabled}
            >
            </div>
          </div>
          <div className="sea-qa-ai-ask-chat-operations-container">
            <div className='sea-qa-ai-ask-chats-toggle-session-wrapper'>
              <div className='sea-qa-ai-ask-chats-toggle-session-button' onClick={onClickSessionToggle}>
                <span className='sea-qa-ai-ask-chats-toggle-session-button-name'>{resolveType.charAt(0).toUpperCase() + resolveType.slice(1)}</span>
                <IconButton className='pl-1' icon='down' />
              </div>
              {isShowSessionToggle && (
                <div className='sea-qa-ai-ask-chats-toggle-session-panel' style={{ transform: `translateY(${sessionTogglePanelTranslateY}px)` }}>
                  <ClickOutside onClickOutside={() => setIsShowSessionToggle(false)}>
                    <div className='sea-qa-dropdown-menu dropdown-menu position-fixed sea-metadata-view-dropdown-menu'>
                      <div onClick={convertToAgent} className='dropdown-item sea-qa-dropdown-item'>
                        <span>{gettext('Agent')}</span>
                        {resolveType === 'agent' && <IconButton icon='check'/>}
                      </div>
                      <div onClick={convertToAsk} className='dropdown-item sea-qa-dropdown-item'>
                        <span>{gettext('Ask')}</span>
                        {resolveType === 'ask' && <IconButton icon='check'/>}
                      </div>
                    </div>
                  </ClickOutside>
                </div>
              )}
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
