import React, { useCallback, useRef, useState, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import slugid from 'slugid';
import { IconButton, ClickOutside, Tooltip, UploadFile, toaster } from '@/components';
import { gettext } from '@/constants';
import * as CommonlyUsedHotkey from '@/utils/hotkey';
import { Utils } from '@/utils/utils';
import { getType } from '@/utils/type-detection';
import InputUtils from '@/utils/input-utils';
import { CHAT_ATTACHMENT_TYPE, CHAT_IMAGE_ATTACHMENT_MAX_COUNT, CHAT_MESSAGE_TYPE } from '../constants';
import AttachmentsSelector from './attachments-selector';
import AttachmentsFormatter from './attachments';
import { useAIChatTools } from '../hooks';
import AIModelSelector from './ai-model-selector';
import { chatAPI } from '@/project/api';
import { AttachmentObject } from '../models';

import './index.css';

const ChatInput = forwardRef(({
  isReply,
  readOnly,
  projectUuid,
  canAddAttachments = true,
  canSelectModel = true,
  clearContext,
  sendMessage,
  resetClearContext,
}, ref) => {
  const [containerFocus, setContainerFocus] = useState(true);
  const inputUtils = useMemo(() => new InputUtils(), []);
  const [value, setValue] = useState('');
  const [selectedModel, setSelectedModel] = useState(null);
  const [width, setWidth] = useState(0);
  const [isDragging, setDragging] = useState(false);

  const inputContentRef = useRef(null);
  const inputRef = useRef(null);
  const rangeRef = useRef(null);
  const previewContentRef = useRef(null);
  const domRef = useRef(null);
  const sendBtnRef = useRef(null);
  const uploadFileRef = useRef(null);

  const {
    attachments, updateAttachments, removeAttachment, clearAttachments,
  } = useAIChatTools();

  const onAttachmentReupload = useCallback((attachment) => {
    const { image, _id: attachmentId } = attachment;
    const d = Date.now();
    const name = 'image-' + d.toString() + image.name.slice(image.name.lastIndexOf('.'));
    const newImage = new File([image], name, { type: image.type });
    chatAPI.uploadChatImage(projectUuid, newImage).then(res => {
      const finalAttachment = new AttachmentObject({
        type: CHAT_ATTACHMENT_TYPE.IMAGE,
        path: res.data.url,
        status: 'done',
        _id: attachmentId,
      });
      updateAttachments(prev => prev.map(att => att._id === attachmentId ? finalAttachment : att));
    }).catch(error => {
      const finalAttachment = new AttachmentObject({
        type: CHAT_ATTACHMENT_TYPE.IMAGE,
        path: URL.createObjectURL(newImage),
        status: 'failed',
        _id: attachmentId,
        image,
      });
      updateAttachments(prev => prev.map(att => att._id === attachmentId ? finalAttachment : att));
    });
  }, []);

  const onImageUpload = useCallback((image) => {
    const d = Date.now();
    const name = 'image-' + d.toString() + image.name.slice(image.name.lastIndexOf('.'));
    const newImage = new File([image], name, { type: image.type });
    const attachmentId = slugid.nice(4);
    const tempAttachment = new AttachmentObject({
      type: CHAT_ATTACHMENT_TYPE.IMAGE,
      path: URL.createObjectURL(newImage),
      status: 'uploading',
      _id: attachmentId
    });
    updateAttachments(prev => [...prev, tempAttachment]);
    chatAPI.uploadChatImage(projectUuid, newImage).then(res => {
      const finalAttachment = new AttachmentObject({
        type: CHAT_ATTACHMENT_TYPE.IMAGE,
        path: res.data.url,
        status: 'done',
        _id: attachmentId,
      });
      updateAttachments(prev => prev.map(att => att._id === attachmentId ? finalAttachment : att));
    }).catch(error => {
      const finalAttachment = new AttachmentObject({
        type: CHAT_ATTACHMENT_TYPE.IMAGE,
        path: URL.createObjectURL(newImage),
        status: 'failed',
        _id: attachmentId,
        image,
      });
      updateAttachments(prev => prev.map(att => att._id === attachmentId ? finalAttachment : att));
    });
  }, []);

  const onImagesUpload = useCallback((images) => {
    const imageAttachments = Array.isArray(attachments) ? attachments.filter(att => att.type === CHAT_ATTACHMENT_TYPE.IMAGE) : [];
    if (imageAttachments.length >= CHAT_IMAGE_ATTACHMENT_MAX_COUNT) {
      toaster.danger(gettext('Each message may contain a maximum of {count} images.').replace('{count}', CHAT_IMAGE_ATTACHMENT_MAX_COUNT));
      return;
    }
    if ((images.length + imageAttachments.length) > CHAT_IMAGE_ATTACHMENT_MAX_COUNT) {
      toaster.danger(gettext('Each message may contain a maximum of {count} images, additional images will not be allowed.').replace('{count}', CHAT_IMAGE_ATTACHMENT_MAX_COUNT));
    }
    const remainImagesCount = CHAT_IMAGE_ATTACHMENT_MAX_COUNT - imageAttachments.length;
    const remainImages = images.slice(0, remainImagesCount);
    remainImages.forEach(file => {
      onImageUpload(file);
    });
  }, [attachments, onImageUpload]);

  const onPaste = useCallback((event) => {
    if (!canAddAttachments) {
      inputUtils.onPaste(event);
      return;
    }
    const callBack = (pasteFiles) => {
      const files = Array.from(pasteFiles || []);
      const images = files.filter(file => file && file.type && file.type.startsWith('image/'));
      onImagesUpload(images);
    };
    inputUtils.onPaste(event, callBack);
  }, [canAddAttachments, inputUtils, onImagesUpload]);

  const onFileInputClick = useCallback(() => {
    uploadFileRef.current && uploadFileRef.current.onClick();
  }, []);

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
    const isUploadingAttachment = attachments.some(att => att.type === CHAT_ATTACHMENT_TYPE.IMAGE && att.status === 'uploading');
    if (isUploadingAttachment) return;
    sendMessage({
      message: value,
      attachments: attachments,
      model: selectedModel,
      clearContext
    });
    clearAttachments();
    resetClearContext();
  }, [value, attachments, selectedModel, sendMessage, clearAttachments, clearContext, resetClearContext]);

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

  const onDragStart = useCallback(() => {
    return false;
  }, []);

  const onDragEnter = useCallback(() => {
    return true;
  }, []);

  const onDragOver = useCallback((event) => {
    event.stopPropagation();
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragging(true);
  }, []);

  const onDragLeave = useCallback((event) => {
    event.stopPropagation();
    event.preventDefault();
    event.nativeEvent.stopImmediatePropagation();
    setDragging(false);
  }, []);

  const onDrop = useCallback((event) => {
    event.stopPropagation();
    event.preventDefault();
    event.persist();
    if (!event || !event.dataTransfer || !event.dataTransfer.files) {
      setDragging(false);
      return;
    }
    const files = event.dataTransfer.files || event.target.files;
    if (files.length === 0) {
      setDragging(false);
      return;
    }
    let images = [];
    for (const file of files) {
      if (file?.type?.startsWith('image/')) {
        images.push(file);
      }
    }
    if (images.length > 0) {
      onImagesUpload(images);
    }
    setDragging(false);
  }, [onImagesUpload]);

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
  const isUploadingAttachment = attachments.some(att => att.type === CHAT_ATTACHMENT_TYPE.IMAGE && att.status === 'uploading');
  const sendDisabled = disabled || !value || isUploadingAttachment;

  const domProps = canAddAttachments && !disabled ? {
    onDragStart,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
  } : {};

  return (
    <div
      className={classnames('seaqa-ai-ask-chat-input-wrapper', { 'disabled': disabled })}
      ref={domRef}
      { ...domProps }
    >
      <ClickOutside onClickOutside={onContainerBlur}>
        <div
          className={classnames('seaqa-ai-ask-chat-input-container', { 'focus': containerFocus, 'dragging': isDragging })}
          onClick={disabled ? () => {} : handleFocus}
        >
          <AttachmentsFormatter
            value={attachments}
            projectUuid={projectUuid}
            onRemove={removeAttachment}
            onReupload={onAttachmentReupload}
          />
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
              {canAddAttachments && (
                <AttachmentsSelector
                  projectUuid={projectUuid}
                  attachments={attachments}
                  onChange={updateAttachments}
                  onFileInputClick={onFileInputClick}
                />
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
                  {isUploadingAttachment ? gettext('Uploading...') : gettext('Send')}
                </Tooltip>
              </>
            </div>
          </div>
          <UploadFile fileType="image/*" onUpload={onImageUpload} ref={uploadFileRef} />
          {canAddAttachments && isDragging && (
            <div className="seaqa-ai-ask-chat-input-dragging-tip">
              <IconButton icon="upload-file" size={{ btn: 32, size: 24 }} className="no-hover-bg" />
              <div className="seaqa-ai-ask-chat-input-dragging-tip-text">
                {gettext('Drop here')}
              </div>
            </div>
          )}
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
