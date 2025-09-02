import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import classnames from 'classnames';
import { Icon, Loading, toaster } from '@/components';
import { gettext } from '@/constants';
import { ChatMessage } from '../models';
import { ASK_PAGE_TYPE, CHAT_MESSAGE_TYPE } from '../constants';
import MessageInput from '../message-input';
import { askAPI } from '../../../api';
import ChatHistory from '../chat-history';
import Thinking from '../thinking';
import { Utils } from '@/utils/utils';
import { useAskPage, useSessions } from '../hooks';

import './index.css';

const Chat = ({ isShowSessions, sessionId, projectUuid, workspaceID }) => {
  const [isReply, setReply] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [size, setSize] = useState('');
  const [height, setHeight] = useState(window.innerHeight - 44);
  const [loading, setLoading] = useState(false);
  const [chatHistories, setChatHistories] = useState([]);

  const timer = useRef(null);
  const wrapperRef = useRef(null);
  const chatHistoryContentRef = useRef(null);
  const messageInputRef = useRef(null);
  const currentSessionId = useRef('');

  const readOnly = useMemo(() => false, []);

  const { createSession } = useSessions();
  const { togglePageType } = useAskPage();

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

  const updateChatHistories = useCallback((newChatHistories, isReply, callback) => {
    setChatHistories(newChatHistories);
    setReply(isReply);
    callback && callback();
    jumpToBottom(isReply ? 10 : 50);
  }, [jumpToBottom]);

  const sendMessage = useCallback(async (message) => {
    const validMessage = message.trim();
    if (!validMessage) {
      messageInputRef.current?.focusInput();
      return;
    }
    const main = (sessionId) => {
      const newChatHistories = [...chatHistories];
      let messages = [{ type: CHAT_MESSAGE_TYPE.TEXT, value: validMessage }];
      newChatHistories.push(new ChatMessage({
        messages: messages,
        isUserSpeak: true,
      }));
      updateChatHistories(newChatHistories, true, () => {
        messageInputRef.current?.clearInput();
      });
      askAPI.askQuestion({
        project_uuid: projectUuid,
        workspace_id: workspaceID,
        query: validMessage,
        session_uuid: sessionId,
      }).then((res) => {
        const { answer = '', sources = [], user_message_id: userMessageId, ai_reply_message_id: aiReplyMessageId } = res.data;

        const newChatData = [
          { type: CHAT_MESSAGE_TYPE.ANSWER, value: answer },
          { type: CHAT_MESSAGE_TYPE.SOURCES, value: sources },
        ];

        newChatHistories[newChatHistories.length - 1]._id = userMessageId;
        newChatHistories.push(new ChatMessage({
          _id: aiReplyMessageId,
          messages: newChatData,
          type: CHAT_MESSAGE_TYPE.GROUP
        }));

        updateChatHistories(newChatHistories, false);
      }).catch((error) => {
        const errorMessage = Utils.getErrorMsg(error);
        newChatHistories.push(new ChatMessage({
          messages: [{ type: CHAT_MESSAGE_TYPE.TEXT, value: gettext(errorMessage) }],
          type: CHAT_MESSAGE_TYPE.ERROR
        }));
        updateChatHistories(newChatHistories, false);
      });
    };

    if (sessionId !== ASK_PAGE_TYPE.NEW) {
      main(sessionId);
      return;
    }
    createSession(validMessage.slice(0, 100)).then(session => {
      const newSessionId = session.session_uuid;
      currentSessionId.current = newSessionId;
      togglePageType(newSessionId);
      main(newSessionId);
    });
  }, [sessionId, chatHistories, updateChatHistories, projectUuid, workspaceID, togglePageType]);

  useEffect(() => {
    if (sessionId === ASK_PAGE_TYPE.NEW) {
      setChatHistories([]);
      messageInputRef.current?.focusInput();
      return;
    }
    setLoading(true);
    if (currentSessionId.current === sessionId) {
      currentSessionId.current = null;
      setLoading(false);
      return;
    }
    askAPI.getChatMessages(projectUuid, sessionId).then(res => {
      const messages = res.data.messages.map(item => {
        if (item.role === 'user') {
          return new ChatMessage({
            _id: item.id,
            messages: [{ type: CHAT_MESSAGE_TYPE.TEXT, value: item.content }],
            isUserSpeak: true,
          });
        }

        let msgContent;
        try {
          msgContent = {
            answer: item.content,
            sources: Array.isArray(item.sources)
              ? item.sources
              : typeof item.sources === 'string'
                ? JSON.parse(item.sources.replace(/'/g, '"'))
                : []
          };
        } catch (e) {
          console.error(e);
          msgContent = { answer: item.content, sources: [] };
        }
        const newChatData = [
          { type: CHAT_MESSAGE_TYPE.ANSWER, value: msgContent.answer },
          { type: CHAT_MESSAGE_TYPE.SOURCES, value: msgContent.sources },
        ];
        return new ChatMessage({
          _id: item.id,
          messages: newChatData,
          type: CHAT_MESSAGE_TYPE.GROUP
        });
      });
      setChatHistories(messages);
      setLoading(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setLoading(false);
    });
  }, [sessionId]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const handleResize = () => {
      if (!wrapper) return;
      setSize(wrapper.offsetWidth > 600 ? 'large' : '');
      setHeight(wrapper.offsetHeight);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    wrapper && resizeObserver.observe(wrapper);
  }, []);

  const isEmpty = chatHistories.length === 0;

  return (
    <div className={classnames('sea-qa-ai-ask-wrapper', { 'empty': isEmpty, 'large': !isShowSessions })} ref={wrapperRef}>
      <div className="sea-qa-ai-ask-chats-wrapper">
        <div className="sea-qa-ai-ask-chats" ref={chatHistoryContentRef}>
          {isEmpty && (
            <div className="sea-qa-ai-ask-chats-tip" style={{ marginTop: height > 420 ? 134 : Math.max(0, height - 286) }}>
              <Icon symbol="problem-solving" className="sea-qa-ai-ask-chats-tip-icon" />
              <div className="sea-qa-ai-ask-chats-tip-title">{gettext('Problem solving')}</div>
              <div className="sea-qa-ai-ask-chats-tip-description">{gettext('Describe your problem, assistant will try to solve it by searching your knowledge bases.')}</div>
            </div>
          )}
          {chatHistories.map((chat, chatIndex) => {
            return (
              <ChatHistory key={`chat-${chatIndex}`} chat={chat} />
            );
          })}
          {isReply && (<Thinking />)}
          {loading && (<Loading />)}
        </div>
      </div>
      <div className="sea-qa-ai-ask-chat-input-wrapper-shell">
        <MessageInput
          ref={messageInputRef}
          isReply={isReply}
          readOnly={readOnly}
          sendMessage={sendMessage}
        />
      </div>
    </div>
  );
};

export default Chat;
