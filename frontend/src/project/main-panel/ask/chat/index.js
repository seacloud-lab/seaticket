import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import classnames from 'classnames';
import { CenteredLoading, Icon, toaster } from '@/components';
import { gettext } from '@/constants';
import { ChatMessage } from '../models';
import { ASK_PAGE_SLUG_ID, CHAT_MESSAGE_TYPE } from '../constants';
import MessageInput from '../message-input';
import { chatAPI } from '../../../api';
import ChatHistory from '../chat-history';
import { Thinking } from '../components';
import { Utils } from '@/utils/utils';
import { useAskPage, useSessions } from '../hooks';
import eventBus from '@/utils/event-bus';
import { EVENT_BUS_TYPE } from '@/project/constants';

import './index.css';

const Chat = ({ isShowSessions, sessionId, projectUuid, settings, projectName, workspaceID }) => {
  const [isReply, setReply] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [size, setSize] = useState('');
  const [height, setHeight] = useState(window.innerHeight - 44);
  const [loading, setLoading] = useState(true);
  const [chatHistories, setChatHistories] = useState([]);

  const timer = useRef(null);
  const wrapperRef = useRef(null);
  const chatHistoryContentRef = useRef(null);
  const messageInputRef = useRef(null);
  const currentSessionId = useRef('');
  const newSessionProblem = useRef('');

  const { createSession, sessions, modifyLocalSession } = useSessions();
  const { togglePageSlugId } = useAskPage();

  const readOnly = useMemo(() => false, []);
  const session = useMemo(() => {
    if (sessionId === ASK_PAGE_SLUG_ID.NEW) return null;
    return sessions.find(s => s._id === sessionId);
  }, [sessionId, sessions]);

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
    callback && callback();
    jumpToBottom(isReply ? 10 : 50);
  }, [jumpToBottom]);

  const sendMessage = useCallback(({ resolveType, message, attachments, model }) => {
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

    if (sessionId !== ASK_PAGE_SLUG_ID.NEW) {
      eventBus.dispatch(EVENT_BUS_TYPE.ASK_QUESTION, { sessionId, message: validMessage, resolveType, attachments: attachments, model });
      return;
    }
    createSession(validMessage.slice(0, 100)).then(session => {
      const newSessionId = session._id;
      currentSessionId.current = newSessionId;
      newSessionProblem.current = '';
      togglePageSlugId(newSessionId);
      setTimeout(() => {
        eventBus.dispatch(EVENT_BUS_TYPE.ASK_QUESTION, { sessionId: newSessionId, message: validMessage, resolveType, attachments: attachments, model });
      }, 3);
    });
  }, [sessionId, chatHistories, updateChatHistories, togglePageSlugId]);

  useEffect(() => {
    if (currentSessionId.current === sessionId) return;
    const problem = messageInputRef.current?.getProblem() || '';
    if (currentSessionId.current !== ASK_PAGE_SLUG_ID.NEW) {
      modifyLocalSession(currentSessionId.current, { problem });
    } else {
      newSessionProblem.current = problem;
    }

    currentSessionId.current = sessionId;
    updateChatHistories([]);
    setLoading(true);

    // new blank chat
    if (sessionId === ASK_PAGE_SLUG_ID.NEW) {
      setLoading(false);
      return;
    }

    chatAPI.getChatMessages(projectUuid, sessionId).then(res => {
      const messages = res.data.messages.map(item => {
        if (item.role === 'user') {
          let attachments = item?.attachments || [];
          return new ChatMessage({
            _id: item.id,
            message: {
              [CHAT_MESSAGE_TYPE.TEXT]: item.content,
              [CHAT_MESSAGE_TYPE.ATTACHMENTS]: attachments,
            },
            isUserSpeak: true,
          });
        }

        let msgContent;
        try {
          msgContent = {
            ai_reply: item.content,
            sources: Array.isArray(item.sources) ? item.sources : [],
            thought_process: item.thought_process
          };
        } catch (e) {
          console.error(e);
          msgContent = { ai_reply: item.content, sources: [] };
        }
        let newChatData = {
          [CHAT_MESSAGE_TYPE.AI_REPLY]: msgContent.ai_reply,
          [CHAT_MESSAGE_TYPE.SOURCES]: msgContent.sources,
          [CHAT_MESSAGE_TYPE.THOUGHT_PROCESS]: msgContent.thought_process,
        };
        return new ChatMessage({
          _id: item.id,
          message: newChatData,
          type: CHAT_MESSAGE_TYPE.GROUP
        });
      });
      updateChatHistories(messages);
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

  useEffect(() => {
    setReply(Boolean(session?.is_replying));
  }, [session?.is_replying]);

  useEffect(() => {
    if (sessionId !== ASK_PAGE_SLUG_ID.NEW) {
      messageInputRef.current?.setAsk([session?.problem || '']);
    } else {
      messageInputRef.current?.setAsk([newSessionProblem.current || '']);
    }
  }, [sessionId, session?.problem]);

  useEffect(() => {
    if (loading) return;
    const unsubscribeAIReply = eventBus.subscribe(EVENT_BUS_TYPE.AI_REPLY, (reply_session_id, { data, error, resolveType }) => {
      modifyLocalSession(reply_session_id, { is_replying: false });
      if (reply_session_id !== sessionId) return;
      let newChatHistories = chatHistories.slice(0);
      if (error) {
        const errorMessage = Utils.getErrorMsg(error);
        newChatHistories.push(new ChatMessage({
          message: { [CHAT_MESSAGE_TYPE.TEXT]: gettext(errorMessage) },
          type: CHAT_MESSAGE_TYPE.ERROR
        }));
        updateChatHistories(newChatHistories, false);
        return;
      }
      const { ai_reply = '', sources = [], user_message_id: userMessageId, ai_reply_message_id: aiReplyMessageId } = data;
      const messageIndex = newChatHistories.findIndex(c => c._id === aiReplyMessageId);
      if (messageIndex > -1) return;
      let newChatData = {
        [CHAT_MESSAGE_TYPE.AI_REPLY]: ai_reply,
        [CHAT_MESSAGE_TYPE.SOURCES]: sources,
        [CHAT_MESSAGE_TYPE.THOUGHT_PROCESS]: data.thought_process,
      };
      newChatHistories[newChatHistories.length - 1]._id = userMessageId;
      newChatHistories.push(new ChatMessage({
        _id: aiReplyMessageId,
        message: newChatData,
        type: CHAT_MESSAGE_TYPE.GROUP
      }));
      updateChatHistories(newChatHistories, false);
    });
    return () => {
      unsubscribeAIReply();
    };
  }, [loading, sessionId, chatHistories, modifyLocalSession]);

  const isEmpty = chatHistories.length === 0 && !loading;

  return (
    <div className={classnames('sea-qa-ai-ask-wrapper', { 'empty': isEmpty, 'large': !isShowSessions })} ref={wrapperRef}>
      <div className="sea-qa-ai-ask-chats-wrapper">
        <div className={classnames('sea-qa-ai-ask-chats', { 'pb-0': isEmpty })} ref={chatHistoryContentRef}>
          {isEmpty && (
            <div className="sea-qa-ai-ask-chats-tip" style={{ marginTop: height > 420 ? 134 : Math.max(0, height - 286) }}>
              <Icon symbol="problem-solving" className="sea-qa-ai-ask-chats-tip-icon" />
              <div className="sea-qa-ai-ask-chats-tip-title">{gettext('How can I help you?')}</div>
              <div className="sea-qa-ai-ask-chats-tip-description">
                {gettext('You can say "Help solving the following issue: <issue description>" to let AI solving the issue by searching knowledge bases.')}
              </div>
            </div>
          )}
          {!loading && chatHistories.map((chat, chatIndex) => {
            return (
              <ChatHistory
                key={`chat-${chatIndex}`}
                chat={chat}
                settings={settings}
                projectUuid={projectUuid}
                projectName={projectName}
                workspaceID={workspaceID}
              />
            );
          })}
          {!loading && isReply && (<Thinking />)}
          {loading && (<CenteredLoading className="flex-1" />)}
        </div>
      </div>
      <div className="sea-qa-ai-ask-chat-input-wrapper-shell">
        <MessageInput
          ref={messageInputRef}
          isReply={loading || isReply}
          readOnly={readOnly}
          projectUuid={projectUuid}
          placeholder={isEmpty ? undefined : ''}
          sendMessage={sendMessage}
        />
      </div>
    </div>
  );
};

export default Chat;
