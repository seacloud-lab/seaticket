import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import classnames from 'classnames';
import { ChatMessage } from '../../models';
import { STORAGE_CHAT_HISTORY_RECORDS_COUNT, CHAT_MESSAGE_TYPE } from '../../constants';
import MessageInput from './message-input';
import IndexedDB from '../../../utils/indexed-db';
import { gettext, SEAQA } from '../../../constants';
import { seaQAAPI } from '../../../api/web-api';
import ChatHistory from './chat-history';
import Thinking from './thinking';
import TopBar from '../top-bar';
import { Utils } from '../../../utils/utils';

import './index.css';

const {
  workspaceID, projectUuid
} = window.app.pageOptions;

const Ask = ({ title }) => {
  const [chatHistories, setChatHistories] = useState([]);
  const [isReply, setReply] = useState(false);
  const [size, setSize] = useState('');

  const timer = useRef(null);
  const wrapperRef = useRef(null);
  const chatHistoryContentRef = useRef(null);
  const messageInputRef = useRef(null);

  const indexedDB = useMemo(() => new IndexedDB({ historyStorageBaseName: SEAQA, historyStorageTableName: 'ai-history' }), []);
  const chatHistoryKey = useMemo(() => projectUuid, []);

  const readOnly = useMemo(() => false, []);

  const jumpToBottom = useCallback((delay = 1) => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!chatHistoryContentRef.current) return;
    timer.current = setTimeout(() => {
      chatHistoryContentRef.current.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
    }, delay);

  }, [chatHistoryContentRef, timer]);

  const handelChatHistories = useCallback((allChatHistories, isReply, callback) => {
    const chatHistories = allChatHistories.filter(chat => !chat.isUserSpeak && Array.isArray(chat.messages) ? chat.messages.length > 0 : true);
    setChatHistories(chatHistories);
    setReply(isReply);
    callback && callback(chatHistories);
    jumpToBottom(isReply ? 10 : 50);
    let historyStorageCount = STORAGE_CHAT_HISTORY_RECORDS_COUNT;
    if (!historyStorageCount && historyStorageCount === 0) return;
    try {
      historyStorageCount = -1 * Math.abs(parseInt(historyStorageCount));
    } catch {
      historyStorageCount = STORAGE_CHAT_HISTORY_RECORDS_COUNT;
    }
    if (isNaN(historyStorageCount)) {
      historyStorageCount = STORAGE_CHAT_HISTORY_RECORDS_COUNT;
    }
    const storageChatHistories = chatHistories.slice(historyStorageCount);
    indexedDB.set(chatHistoryKey, storageChatHistories);
  }, [chatHistoryKey, jumpToBottom]);

  const sendMessage = useCallback(async (message) => {
    const validMessage = message.trim();

    if (!validMessage) {
      messageInputRef.current.focusInput();
      return;
    }

    const newChatHistories = chatHistories.slice(0, );
    let messages = [{ type: CHAT_MESSAGE_TYPE.TEXT, value: validMessage }];

    newChatHistories.push(new ChatMessage({
      messages: messages,
      isUserSpeak: true,
    }));
    handelChatHistories(newChatHistories, true, messageInputRef.current.clearInput);

    seaQAAPI.askQuestion({
      project_uuid: projectUuid,
      workspace_id: workspaceID,
      query: validMessage,
    }).then((res) => {
      const { answer = '', sources = [], user_message_id: userMessageId, ai_reply_message_id: aiReplyMessageId } = res.data;

      const newChatData = [
        { type: CHAT_MESSAGE_TYPE.ANSWER, value: answer },
        { type: CHAT_MESSAGE_TYPE.SOURCES, value: sources },
      ];
      newChatHistories[newChatHistories.length - 1]._id = userMessageId;
      newChatHistories.push(new ChatMessage({ _id: aiReplyMessageId, messages: newChatData, type: CHAT_MESSAGE_TYPE.GROUP }));
      handelChatHistories(newChatHistories, false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      newChatHistories.push(new ChatMessage({ messages: [gettext(errorMessage)], type: CHAT_MESSAGE_TYPE.ERROR }));
      handelChatHistories(newChatHistories, false);
    });

  }, [chatHistories, handelChatHistories]);

  // load chat histories
  useEffect(() => {
    indexedDB.get(chatHistoryKey).then((chatHistories) => {
      const newChatHistories = !Array.isArray(chatHistories) || chatHistories.length === 0 ? [
        new ChatMessage({
          _id: 'use_tip',
          type: CHAT_MESSAGE_TYPE.TIP,
          messages: [{ type: CHAT_MESSAGE_TYPE.TEXT, value: gettext('Hello! What can I help you with?') }],
        })
      ] : chatHistories.map(chat => new ChatMessage(chat));
      setChatHistories(newChatHistories);
      jumpToBottom(100);
    });
    return () => {
      timer.current && clearTimeout(timer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatHistoryKey]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (wrapper) {
      setSize(wrapper.offsetWidth > 600 ? 'large' : '');
    }

    // resize
    const handleResize = () => {
      if (!wrapper) return;
      setSize(wrapper.offsetWidth > 600 ? 'large' : '');
    };
    const resizeObserver = new ResizeObserver(handleResize);
    wrapper && resizeObserver.observe(wrapper);
  }, []);

  return (
    <>
      <TopBar>
        <div className="w-100 text-truncate">{title}</div>
      </TopBar>
      <div className={classnames('sea-qa-ai-ask-wrapper', size)} ref={wrapperRef}>
        <div className="sea-qa-ai-ask-chats-wrapper">
          <div className="sea-qa-ai-ask-chats" ref={chatHistoryContentRef}>
            {chatHistories.map((chat, chatIndex) => {
              return (
                <ChatHistory key={`chat-${chatIndex}`} chat={chat} />
              );
            })}
            {isReply && (<Thinking />)}
          </div>
        </div>
        <div className="sea-qa-ai-ask-chat-input-wrapper-shell">
          <MessageInput
            ref={messageInputRef}
            isReply={isReply}
            readOnly={readOnly}
            chatHistories={chatHistories}
            sendMessage={sendMessage}
          />
        </div>
      </div>
    </>
  );
};

export default Ask;
