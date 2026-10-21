import React, { useEffect, useState, useCallback, useRef, forwardRef, useImperativeHandle, isValidElement, cloneElement } from 'react';
import classnames from 'classnames';
import { IconButton, CenteredLoading, ResizeBar } from '@/components';
import { isString, isObject, isFunction } from '@/utils/type-detection';
import { Utils } from '@/utils/utils';
import ChatHistory from '../chat-history';
import ChatInput from '../chat-input';
import { Thinking } from '../components';
import { CHAT_MESSAGE_TYPE } from '../constants';
import { DocumentsProvider } from '../hooks';
import { ChatMessage } from '../models';
import { initMessages } from '../utils';

import './index.css';

const INIT_WIDTH = 400;

const Main = forwardRef(({
  projectUuid, projectName, workspaceID, resizable = true,
  session, emptyTip, children, placeholder, displayOperations,
  onToggle, getMessages, sendMessage: sendMessageAPI, uploadChatImage,
}, ref) => {
  const [isLoading, setIsLoading] = useState(true);
  const [chatHistories, setChatHistories] = useState([]);
  const [isReply, setReply] = useState(false);

  const resizeRef = useRef(null);
  const timer = useRef(null);
  const messageInputRef = useRef(null);
  const chatHistoryContentRef = useRef(null);

  const onResize = useCallback((width) => {
    const newWidth = window.innerWidth - width;
    localStorage.setItem('project_side_panel_chat_width', newWidth);
    resizeRef.current.style.width = `${newWidth}px`;
  }, []);

  const jumpToBottom = useCallback((delay = 1) => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!chatHistoryContentRef.current) return;
    timer.current = setTimeout(() => {
      chatHistoryContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
    }, delay);
  }, [chatHistoryContentRef, timer]);

  const updateChatHistories = useCallback((newChatHistories, isReply, callback) => {
    setChatHistories(newChatHistories);
    callback && callback();
    jumpToBottom(isReply ? 10 : 50);
  }, [jumpToBottom]);

  const sendMessage = useCallback(({ message, attachments, model, clearContext }) => {
    const validMessage = message.trim();
    if (!validMessage) {
      messageInputRef.current?.focusInput();
      return;
    }
    const newChatHistories = chatHistories.slice(0);
    newChatHistories.push(new ChatMessage({
      message: {
        [CHAT_MESSAGE_TYPE.TEXT]: validMessage,
        [CHAT_MESSAGE_TYPE.ATTACHMENTS]: attachments,
      },
      isUserSpeak: true,
    }));
    updateChatHistories(newChatHistories, false, () => {
      messageInputRef.current?.clearInput();
    });
    setReply(true);
    sendMessageAPI({ message, attachments, model, clearContext }).then(res => {
      const { sources = [], thought_process = '', ai_reply = '', attachments = [], ai_reply_message_id, ...others } = res?.data?.results || {};
      let message = {
        [CHAT_MESSAGE_TYPE.TEXT]: '',
        [CHAT_MESSAGE_TYPE.SOURCES]: sources,
        [CHAT_MESSAGE_TYPE.THOUGHT_PROCESS]: thought_process || 'disabled',
        [CHAT_MESSAGE_TYPE.ATTACHMENTS]: attachments,
        ...others,
      };

      if (isString(ai_reply)) {
        message[CHAT_MESSAGE_TYPE.AI_REPLY] = ai_reply;
      } else if (isObject(ai_reply)) {
        message = { ...message, ...ai_reply };
      }

      newChatHistories.push(new ChatMessage({
        id: ai_reply_message_id,
        message: message,
        isUserSpeak: false,
      }));
      updateChatHistories(newChatHistories, false);
    }).catch(error => {
      newChatHistories.push(new ChatMessage({
        message: { [CHAT_MESSAGE_TYPE.TEXT]: Utils.getErrorMsg(error) },
        type: CHAT_MESSAGE_TYPE.ERROR
      }));
      updateChatHistories(newChatHistories, false);
    }).finally(() => {
      setReply(false);
    });
  }, [chatHistories, updateChatHistories, sendMessageAPI]);

  useEffect(() => {
    if (!resizable) return;
    const width = parseFloat(localStorage.getItem('project_side_panel_chat_width') || INIT_WIDTH);
    resizeRef.current.style.width = `${width}px`;
  }, [resizable]);

  useEffect(() => {
    setIsLoading(true);
    getMessages(projectUuid, session.session_uuid).then(res => {
      const messages = res?.data?.messages || [];
      setChatHistories(initMessages(messages));
    }).finally(() => {
      setIsLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectUuid, session.session_uuid]);

  useImperativeHandle(ref, () => ({
    getStatus: () => {
      return { isReply, isLoading };
    },
  }), [isReply, isLoading]);

  const isEmpty = chatHistories.length === 0 && !isLoading;
  const _isReply = isLoading || isReply;

  return (
    <>
      <div className="seaqa-ai-side-panel-chat seaqa-ai-ask-wrapper s" ref={resizeRef}>
        <div className="seaqa-ai-ask-chats-header">
          <div className="chat-header-title-content">{session.session_name}</div>
          <IconButton icon="close" onClick={onToggle} />
        </div>
        <div className="seaqa-ai-ask-chats-body">
          <div className={classnames('seaqa-ai-ask-chats', { 'pb-0 justify-content-center': isEmpty })} ref={chatHistoryContentRef}>
            {isEmpty && (
              <div className="seaqa-ai-ask-chats-tip">
                {emptyTip}
              </div>
            )}
            {!isLoading && chatHistories.map((chat, chatIndex) => {
              return (
                <ChatHistory
                  key={`chat-${chatIndex}-${chat._id || ''}`}
                  chat={chat}
                  settings={{}}
                  projectUuid={projectUuid}
                  projectName={projectName}
                  workspaceID={workspaceID}
                  displayOperations={displayOperations}
                />
              );
            })}
            {!isLoading && isReply && (<Thinking />)}
            {isLoading && (<CenteredLoading className="flex-1" />)}
          </div>
        </div>
        {sendMessageAPI && (
          <div className="seaqa-ai-ask-chats-footer">
            <ChatInput
              ref={messageInputRef}
              isReply={_isReply}
              readOnly={false}
              projectUuid={projectUuid}
              placeholder={placeholder}
              allowedAttachmentSources={false}
              canSelectModel={false}
              enableSkills={false}
              skillCommands={[]}
              sendMessage={sendMessage}
              api={{ uploadChatImage }}
            />
          </div>
        )}
        {resizable && (
          <ResizeBar min={window.innerWidth - 480} max={window.innerWidth - 300} onResize={onResize} />
        )}
      </div>
      {isValidElement(children) && cloneElement(children, { isReply, isLoading, chatHistories })}
      {isFunction(children) && children({ isReply, isLoading, chatHistories })}
    </>
  );
});

const SidePanelChat = ({ row: session, innerRef, ...props }) => {
  return (
    <DocumentsProvider sessionId={session?.id}>
      {session && (<Main ref={innerRef} session={session} { ...props } />)}
    </DocumentsProvider>
  );
};

export default SidePanelChat;
