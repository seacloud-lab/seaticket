import React, { useCallback, useRef, useState, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { IconButton, ClickOutside, Tooltip } from '@/components';
import { gettext } from '@/constants';
import * as CommonlyUsedHotkey from '@/utils/hotkey';
import { Utils } from '@/utils/utils';
import { getType } from '@/utils/type-detection';
import InputUtils from '@/utils/input-utils';
import { CHAT_MESSAGE_TYPE } from '../constants';
import ProjectRecordsSelector from './project-records-selector';
import { useAIChatTools } from '../hooks';
import AIModelSelector from './ai-model-selector';
import AttachmentsFormatter from './attachments';
import ImageAttachments from './image-attachments';

import './index.css';

const ChatInput = forwardRef(({
  isReply,
  readOnly,
  projectUuid,
  canAddDocuments = true,
  canSelectModel = true,
  canUploadImage = true,
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
  const sendBtnRef = useRef(null);
  const uploadInputRef = useRef(null);
  const uploadBtnRef = useRef(null);

  const {
    attachments, updateAttachments, removeAttachment, clearAttachments,
    pendingImages, addImages, removeImage, retryImage, clearImages,
  } = useAIChatTools();

  const onPaste = useCallback((event) => {
    if (!canUploadImage) {
      inputUtils.onPaste(event);
      return;
    }
    const callBack = (pasteFiles) => {
      const arr = Array.from(pasteFiles || []);
      const images = arr.filter(f => f && f.type && f.type.startsWith('image/'));
      if (images.length) addImages(images);
    };
    inputUtils.onPaste(event, callBack);
  }, [inputUtils, addImages, canUploadImage]);

  const onUploadClick = useCallback(() => {
    uploadInputRef.current && uploadInputRef.current.click();
  }, []);

  const onFilesSelected = useCallback((event) => {
    const files = event.target.files;
    if (files && files.length) addImages(files);
    event.target.value = '';
  }, [addImages]);

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
    const hasUploading = pendingImages.some(i => i.status === 'uploading');
    if (hasUploading) return;
    const completed = pendingImages.filter(i => i.status === 'done' && i.tempUrl);
    const imageUrls = completed.map(i => i.tempUrl);
    const imagePreviews = completed.map(i => i.previewUrl);
    sendMessage({
      message: value,
      attachments,
      image_urls: imageUrls,
      image_previews: imagePreviews,
      model: selectedModel,
      clearContext
    });
    clearAttachments();
    clearImages();
    resetClearContext();
  }, [value, attachments, pendingImages, selectedModel, sendMessage, clearAttachments, clearImages, clearContext, resetClearContext]);

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
      clearImages();
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
  const hasUploading = pendingImages.some(i => i.status === 'uploading');
  const sendDisabled = disabled || !value || hasUploading;

  return (
    <div className={classnames('seaqa-ai-ask-chat-input-wrapper', { 'disabled': disabled })} ref={domRef}>
      <ClickOutside onClickOutside={onContainerBlur}>
        <div className={classnames('seaqa-ai-ask-chat-input-container', { 'focus': containerFocus })} onClick={disabled ? () => {} : handleFocus}>
          <AttachmentsFormatter value={attachments} projectUuid={projectUuid} onRemove={removeAttachment} />
          {canUploadImage && (
            <ImageAttachments images={pendingImages} onRemove={removeImage} onRetry={retryImage} />
          )}
          <div className="seaqa-ai-ask-chat-input-content" ref={inputContentRef}>
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
              placeholder={gettext('What problem do you want to solve?')}
              tabIndex={-1}
              rows={1}
              disabled={disabled}
            />
            <div ref={previewContentRef} className="message-input message-input-preview"></div>
          </div>
          <div className="seaqa-ai-ask-chat-operations-container">
            <div className="seaqa-ai-ask-chat-operations-container-left">
              {canAddDocuments && (
                <ProjectRecordsSelector projectUuid={projectUuid} value={attachments} onChange={updateAttachments} isSimple={isSimple} />
              )}
              {canUploadImage && (
                <>
                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={onFilesSelected}
                  />
                  <IconButton
                    disabled={disabled}
                    ref={uploadBtnRef}
                    icon="paperclip"
                    className="sea-qa-ai-ask-icon-btn no-hover-bg"
                    onClick={disabled ? () => {} : onUploadClick}
                    aria-label={gettext('Upload image')}
                  />
                  <Tooltip target={uploadBtnRef} placement="top">
                    {gettext('Upload image')}
                  </Tooltip>
                </>
              )}
            </div>
            <div className="seaqa-ai-ask-chat-operations-container-right">
              {canSelectModel && (
                <AIModelSelector selectedModel={selectedModel} updateModel={setSelectedModel} isSimple={isSimple}/>
              )}
              <>
                <IconButton
                  disabled={sendDisabled}
                  ref={sendBtnRef}
                  icon="btn-send"
                  className="seaqa-ai-ask-icon-btn icon-send-wrapper no-hover-bg"
                  onClick={sendDisabled ? () => {} : onSendMessage}
                  aria-label={gettext('Send')}
                />
                <Tooltip target={sendBtnRef} placement="top">
                  {hasUploading ? gettext('Uploading images...') : gettext('Send')}
                </Tooltip>
              </>
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
