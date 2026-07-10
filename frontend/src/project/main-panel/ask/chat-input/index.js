import React, { useCallback, useRef, useState, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import slugid from 'slugid';
import { IconButton, ClickOutside, OptionEditor, Tooltip, UploadFile, toaster } from '@/components';
import { gettext } from '@/constants';
import * as CommonlyUsedHotkey from '@/utils/hotkey';
import { Utils } from '@/utils/utils';
import { getType } from '@/utils/type-detection';
import InputUtils from '@/utils/input-utils';
import { CHAT_ATTACHMENT_TYPE, CHAT_ATTACHMENT_SOURCE, CHAT_IMAGE_ATTACHMENT_MAX_COUNT, CHAT_MESSAGE_TYPE, DEFAULT_ALLOWED_ATTACHMENT_SOURCES, CHAT_SKILLS } from '../constants';
import AttachmentsSelector from './attachments-selector';
import AttachmentsFormatter from './attachments';
import { useAIChatTools } from '../hooks';
import AIModelSelector from './ai-model-selector';
import { chatAPI as defaultChatAPI } from '@/project/api';
import { AttachmentObject } from '../models';

import './index.css';

const DELETE_KEY_CODE = 46;

const getSkillCommandRange = (value, cursor) => {
  if (!Number.isInteger(cursor)) return null;
  const beforeCursor = value.slice(0, cursor);
  const slashIndex = beforeCursor.lastIndexOf('/');
  if (slashIndex !== 0) return null;
  const command = beforeCursor.slice(slashIndex + 1);
  if (/\s/.test(command)) return null;
  return { start: slashIndex, end: cursor };
};

const getSkillCommandQuery = (value, range) => {
  if (!range) return '';
  return value.slice(range.start + 1, range.end).trim().toLowerCase();
};

const getSelectedSkillCommandRange = (value, selectionStart, selectionEnd) => {
  const skillCommands = CHAT_SKILLS.map(skill => `/${skill.id}`);
  for (const command of skillCommands) {
    let start = value.indexOf(command);
    while (start !== -1) {
      const end = start + command.length;
      const hasValidStart = start === 0;
      const hasValidEnd = end === value.length || /\s/.test(value[end]);
      const trailingEnd = value[end] === ' ' ? end + 1 : end;
      const isSelected = selectionStart !== selectionEnd && selectionStart < trailingEnd && selectionEnd > start;
      const isBackspacePosition = selectionStart === selectionEnd && selectionStart > start && selectionStart <= trailingEnd;
      const isDeletePosition = selectionStart === selectionEnd && selectionStart >= start && selectionStart < trailingEnd;
      if (hasValidStart && hasValidEnd && (isSelected || isBackspacePosition || isDeletePosition)) {
        return { start, end };
      }
      start = value.indexOf(command, start + 1);
    }
  }
  return null;
};

const getSkillCommandDeleteRange = (value, selectionStart, selectionEnd, keyCode) => {
  const commandRange = getSelectedSkillCommandRange(value, selectionStart, selectionEnd);
  if (!commandRange) return null;

  const trailingEnd = value[commandRange.end] === ' ' ? commandRange.end + 1 : commandRange.end;
  if (selectionStart !== selectionEnd) {
    const intersects = selectionStart < trailingEnd && selectionEnd > commandRange.start;
    return intersects ? { start: commandRange.start, end: trailingEnd } : null;
  }

  if (keyCode === Utils.keyCodes.backspace && selectionStart > commandRange.start && selectionStart <= trailingEnd) {
    return { start: commandRange.start, end: trailingEnd };
  }
  if (keyCode === DELETE_KEY_CODE && selectionStart >= commandRange.start && selectionStart < trailingEnd) {
    return { start: commandRange.start, end: trailingEnd };
  }
  return null;
};

const getMessageWithoutLeadingSkillCommand = (value) => {
  if (typeof value !== 'string') return '';
  const skillCommands = CHAT_SKILLS.map(skill => `/${skill.id}`);
  for (const command of skillCommands) {
    if (value === command || value.startsWith(`${command} `)) {
      return value.slice(command.length).trim();
    }
  }
  return value.trim();
};

const ChatInput = forwardRef(({
  isReply,
  readOnly,
  projectUuid,
  allowedAttachmentSources = DEFAULT_ALLOWED_ATTACHMENT_SOURCES,
  canSelectModel = true,
  clearContext,
  sendMessage,
  resetClearContext,
  enableSkills = true,
  api,
}, ref) => {
  const chatAPI = api || defaultChatAPI;
  const allowImageAttachments = Array.isArray(allowedAttachmentSources) && allowedAttachmentSources.includes(CHAT_ATTACHMENT_SOURCE.IMAGE);
  const allowSourceAttachments = Array.isArray(allowedAttachmentSources) && allowedAttachmentSources.includes(CHAT_ATTACHMENT_SOURCE.SOURCE);
  const canAddAttachments = allowImageAttachments || allowSourceAttachments;
  const [containerFocus, setContainerFocus] = useState(true);
  const inputUtils = useMemo(() => new InputUtils(), []);
  const [value, setValue] = useState('');
  const [selectedModel, setSelectedModel] = useState(null);
  const [width, setWidth] = useState(0);
  const [isDragging, setDragging] = useState(false);
  const [isShowSkillCommandSelector, setIsShowSkillCommandSelector] = useState(false);
  const [skillCommandRange, setSkillCommandRange] = useState(null);

  const inputContentRef = useRef(null);
  const inputRef = useRef(null);
  const rangeRef = useRef(null);
  const previewContentRef = useRef(null);
  const domRef = useRef(null);
  const sendBtnRef = useRef(null);
  const uploadFileRef = useRef(null);
  const isSelectingSkillCommandRef = useRef(false);

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
  }, [projectUuid, chatAPI, updateAttachments]);

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
        preview_path: URL.createObjectURL(newImage),
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
  }, [projectUuid, chatAPI, updateAttachments]);

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
    if (!allowImageAttachments) {
      inputUtils.onPaste(event);
      return;
    }
    const callBack = (pasteFiles) => {
      const files = Array.from(pasteFiles || []);
      const images = files.filter(file => file && file.type && file.type.startsWith('image/'));
      onImagesUpload(images);
    };
    inputUtils.onPaste(event, callBack);
  }, [allowImageAttachments, inputUtils, onImagesUpload]);

  const onFileInputClick = useCallback(() => {
    uploadFileRef.current && uploadFileRef.current.onClick();
  }, []);

  const closeSkillCommandSelector = useCallback(() => {
    setIsShowSkillCommandSelector(false);
    setSkillCommandRange(null);
  }, []);

  const updateSkillCommandSelector = useCallback((nextValue, cursor) => {
    if (!enableSkills) {
      closeSkillCommandSelector();
      return;
    }
    const nextSkillCommandRange = getSkillCommandRange(nextValue, cursor);
    setSkillCommandRange(nextSkillCommandRange);
    setIsShowSkillCommandSelector(Boolean(nextSkillCommandRange));
  }, [enableSkills, closeSkillCommandSelector]);

  const onValueChange = useCallback((event) => {
    const nextValue = event.target.value;
    setValue(nextValue);
    updateSkillCommandSelector(nextValue, event.target.selectionStart);
  }, [updateSkillCommandSelector]);

  const onSkillCommandChange = useCallback((skillId) => {
    if (!skillId) {
      closeSkillCommandSelector();
      return;
    }
    const textarea = inputRef.current;
    const cursor = Number.isInteger(textarea?.selectionStart) ? textarea.selectionStart : value.length;
    const range = skillCommandRange || getSkillCommandRange(value, cursor) || { start: cursor, end: cursor };
    const command = `/${skillId}`;
    const nextValue = value.slice(0, range.start) + command + ' ' + value.slice(range.end);
    const nextCursor = range.start + command.length + 1;

    isSelectingSkillCommandRef.current = true;
    setValue(nextValue);
    closeSkillCommandSelector();
    setTimeout(() => {
      textarea && textarea.focus();
      if (textarea) {
        textarea.selectionStart = textarea.selectionEnd = nextCursor;
      }
      isSelectingSkillCommandRef.current = false;
    }, 0);
  }, [value, skillCommandRange, closeSkillCommandSelector]);

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
    closeSkillCommandSelector();

    inputFocus();
  }, [readOnly, inputFocus, closeSkillCommandSelector]);

  const onSendMessage = useCallback((event) => {
    event && event.stopPropagation();
    event && event.nativeEvent.stopImmediatePropagation();
    const messageText = enableSkills ? getMessageWithoutLeadingSkillCommand(value) : value.trim();
    if (!messageText) {
      inputRef.current?.focus();
      return;
    }
    const isUploadingAttachment = attachments.some(att => att.type === CHAT_ATTACHMENT_TYPE.IMAGE && att.status === 'uploading');
    if (isUploadingAttachment) return;
    sendMessage({
      message: value,
      attachments: attachments,
      model: selectedModel,
      clearContext
    });
    closeSkillCommandSelector();
    clearAttachments();
    resetClearContext();
  }, [value, attachments, selectedModel, sendMessage, clearAttachments, clearContext, resetClearContext, closeSkillCommandSelector, enableSkills]);

  const skillCommandOptions = useMemo(() => {
    if (!enableSkills) return [];
    const query = getSkillCommandQuery(value, skillCommandRange);
    return CHAT_SKILLS
      .filter(skill => !query || skill.id.toLowerCase().startsWith(query))
      .map(skill => ({
        value: skill.id,
        label: `/${skill.id}`,
      }));
  }, [value, skillCommandRange, enableSkills]);

  const onKeyUp = useCallback((event) => {
    if (!(CommonlyUsedHotkey.isModUp(event) || CommonlyUsedHotkey.isModDown(event))) {
      const selection = window.getSelection();
      rangeRef.current = selection.getRangeAt(0);
    }
    updateSkillCommandSelector(event.target.value, event.target.selectionStart);
  }, [updateSkillCommandSelector]);

  const onKeyDown = useCallback((event) => {
    const keyCode = event.keyCode;
    if (enableSkills && (keyCode === Utils.keyCodes.backspace || keyCode === DELETE_KEY_CODE)) {
      const textarea = inputRef.current;
      const deleteRange = getSkillCommandDeleteRange(value, textarea.selectionStart, textarea.selectionEnd, keyCode);
      if (deleteRange) {
        event.preventDefault();
        const nextValue = value.slice(0, deleteRange.start) + value.slice(deleteRange.end);
        setValue(nextValue);
        closeSkillCommandSelector();
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = deleteRange.start;
        }, 0);
        return;
      }
    }
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
    if (isSelectingSkillCommandRef.current && keyCode === Utils.keyCodes.enter) {
      event.preventDefault();
      return;
    }
    if (isShowSkillCommandSelector && keyCode === Utils.keyCodes.enter) {
      event.preventDefault();
      if (skillCommandOptions.length === 1) {
        onSkillCommandChange(skillCommandOptions[0].value);
      }
      return;
    }
    if (keyCode === Utils.keyCodes.enter) {
      event.preventDefault();
      onSendMessage();
      return;
    }
  }, [value, onSendMessage, isShowSkillCommandSelector, skillCommandOptions, onSkillCommandChange, closeSkillCommandSelector, enableSkills]);

  const onMouseUp = useCallback((event) => {
    const selection = window.getSelection();
    rangeRef.current = selection.getRangeAt(0);
    updateSkillCommandSelector(event.target.value, event.target.selectionStart);
  }, [updateSkillCommandSelector]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const messageText = enableSkills ? getMessageWithoutLeadingSkillCommand(value) : value.trim();
  const sendDisabled = disabled || !messageText || isUploadingAttachment;

  const domProps = allowImageAttachments && !disabled ? {
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
            {isShowSkillCommandSelector && !disabled && (
              <OptionEditor
                className="seaqa-ai-chat-selector-display-editor"
                target={inputContentRef}
                isMultiple={false}
                isSearchEnabled={false}
                emptyTip={gettext('No results')}
                options={skillCommandOptions}
                value=""
                placement="top-start"
                onChange={onSkillCommandChange}
                onToggle={closeSkillCommandSelector}
              />
            )}
          </div>
          <div className="seaqa-ai-ask-chat-operations-container">
            <div className="seaqa-ai-ask-chat-operations-container-left">
              {canAddAttachments && (
                <AttachmentsSelector
                  projectUuid={projectUuid}
                  attachments={attachments}
                  onChange={updateAttachments}
                  onFileInputClick={onFileInputClick}
                  canAddSources={allowSourceAttachments}
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
          {allowImageAttachments && isDragging && (
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
  enableSkills: PropTypes.bool,
  sendMessage: PropTypes.func.isRequired,
};

export default ChatInput;
