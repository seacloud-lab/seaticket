import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import classnames from 'classnames';
import { CenteredLoading, Icon, toaster, IconButton, ClickOutside } from '@/components';
import { gettext } from '@/constants';
import { ChatMessage } from '../models';
import { ASK_PAGE_TYPE, CHAT_MESSAGE_TYPE } from '../constants';
import MessageInput from '../message-input';
import { askAPI } from '../../../api';
import ChatHistory from '../chat-history';
import Thinking from '../thinking';
import { Utils } from '@/utils/utils';
import { useAskPage, useSessions } from '../hooks';
import eventBus from '@/utils/event-bus';
import { EVENT_BUS_TYPE } from '@/project/constants';

import './index.css';

const Chat = ({ isShowSessions, sessionId, projectUuid, workspaceID }) => {
  const [isReply, setReply] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [size, setSize] = useState('');
  const [height, setHeight] = useState(window.innerHeight - 44);
  const [loading, setLoading] = useState(true);
  const [chatHistories, setChatHistories] = useState([]);
  const [resolveType, setResolveType] = useState('ask');
  const [isShowSessionToggle, setIsShowSessionToggle] = useState(false);
  const [sessionTogglePanelTranslateY, setSessionTogglePanelTranslateY] = useState(0);

  const timer = useRef(null);
  const wrapperRef = useRef(null);
  const chatHistoryContentRef = useRef(null);
  const messageInputRef = useRef(null);
  const currentSessionId = useRef('');
  const newSessionProblem = useRef('');

  const { createSession, sessions, modifyLocalSession } = useSessions();
  const { togglePageType } = useAskPage();

  const readOnly = useMemo(() => false, []);
  const session = useMemo(() => {
    if (sessionId === ASK_PAGE_TYPE.NEW) return null;
    return sessions.find(s => s._id === sessionId);
  }, [sessionId, sessions]);

  const convertToAgent = useCallback(() => {
    setResolveType('agent');
    setIsShowSessionToggle(false);
  }, [resolveType]);

  const convertToAsk = useCallback(() => {
    setResolveType('ask');
    setIsShowSessionToggle(false);
  }, [resolveType]);

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

  const sendMessage = useCallback((message) => {
    const validMessage = message.trim();
    if (!validMessage) {
      messageInputRef.current?.focusInput();
      return;
    }
    const newChatHistories = chatHistories.slice(0);
    const messages = [{ type: CHAT_MESSAGE_TYPE.TEXT, value: validMessage }];
    newChatHistories.push(new ChatMessage({
      messages: messages,
      isUserSpeak: true,
    }));
    updateChatHistories(newChatHistories, false, () => {
      messageInputRef.current?.clearInput();
    });

    if (sessionId !== ASK_PAGE_TYPE.NEW) {
      eventBus.dispatch(EVENT_BUS_TYPE.ASK_QUESTION, sessionId, validMessage, resolveType);
      return;
    }
    createSession(validMessage.slice(0, 100)).then(session => {
      const newSessionId = session._id;
      currentSessionId.current = newSessionId;
      newSessionProblem.current = '';
      togglePageType(newSessionId);
      setTimeout(() => {
        eventBus.dispatch(EVENT_BUS_TYPE.ASK_QUESTION, newSessionId, validMessage, resolveType);
      }, 3);
    });
  }, [sessionId, chatHistories, updateChatHistories, togglePageType, resolveType]);

  useEffect(() => {
    if (currentSessionId.current === sessionId) return;
    const problem = messageInputRef.current?.getProblem() || '';
    if (currentSessionId.current !== ASK_PAGE_TYPE.NEW) {
      modifyLocalSession(currentSessionId.current, { problem });
    } else {
      newSessionProblem.current = problem;
    }

    currentSessionId.current = sessionId;
    updateChatHistories([]);
    setLoading(true);

    // new blank chat
    if (sessionId === ASK_PAGE_TYPE.NEW) {
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
    if (sessionId !== ASK_PAGE_TYPE.NEW) {
      messageInputRef.current?.setAsk([session?.problem || '']);
    } else {
      messageInputRef.current?.setAsk([newSessionProblem.current || '']);
    }
  }, [sessionId, session?.problem]);

  useEffect(() => {
    if (loading) return;
    const unsubscribeAIReply = eventBus.subscribe(EVENT_BUS_TYPE.AI_REPLY, (reply_session_id, { data, error }) => {
      modifyLocalSession(reply_session_id, { is_replying: false });
      if (reply_session_id !== sessionId) return;
      let newChatHistories = chatHistories.slice(0);
      if (error) {
        const errorMessage = Utils.getErrorMsg(error);
        newChatHistories.push(new ChatMessage({
          messages: [{ type: CHAT_MESSAGE_TYPE.TEXT, value: gettext(errorMessage) }],
          type: CHAT_MESSAGE_TYPE.ERROR
        }));
        updateChatHistories(newChatHistories, false);
        return;
      }
      const { answer = '', sources = [], user_message_id: userMessageId, ai_reply_message_id: aiReplyMessageId } = data;
      const messageIndex = newChatHistories.findIndex(c => c._id === aiReplyMessageId);
      if (messageIndex > -1) return;
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
    });
    return () => {
      unsubscribeAIReply();
    };
  }, [loading, sessionId, chatHistories, modifyLocalSession]);

  const onClickSessionToggle = useCallback((e) => {
    const { bottom } = messageInputRef.current.inputWrapper.getBoundingClientRect();
    const overflowHeight = bottom + 6 + 82; // 6: margin, 82: panel height
    setSessionTogglePanelTranslateY(overflowHeight > window.innerHeight ? (window.innerHeight - overflowHeight - 95) : 0);
    setIsShowSessionToggle(true);
  }, [messageInputRef]);

  const isEmpty = chatHistories.length === 0 && !loading;

  return (
    <div className={classnames('sea-qa-ai-ask-wrapper', { 'empty': isEmpty, 'large': !isShowSessions })} ref={wrapperRef}>
      <div className='sea-qa-ai-ask-chats-wrapper'>
        <div className="sea-qa-ai-ask-chats" ref={chatHistoryContentRef}>
          {isEmpty && (
            <div className="sea-qa-ai-ask-chats-tip" style={{ marginTop: height > 420 ? 134 : Math.max(0, height - 286) }}>
              <Icon symbol="problem-solving" className="sea-qa-ai-ask-chats-tip-icon" />
              <div className="sea-qa-ai-ask-chats-tip-title">{gettext('Problem solving')}</div>
              <div className="sea-qa-ai-ask-chats-tip-description">{gettext('Describe your problem, assistant will try to solve it by searching your knowledge bases.')}</div>
            </div>
          )}
          {!loading && chatHistories.map((chat, chatIndex) => {
            return (
              <ChatHistory key={`chat-${chatIndex}`} chat={chat} />
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
          sendMessage={sendMessage}
        />
        <div className='sea-qa-ai-ask-chats-toggle-session-wrapper'>
          <div className='sea-qa-ai-ask-chats-toggle-session-button'>
            <span className='sea-qa-ai-ask-chats-toggle-session-button-name'>{resolveType.charAt(0).toUpperCase() + resolveType.slice(1)}</span>
            <IconButton icon='down' onClick={onClickSessionToggle} />
          </div>
          {isShowSessionToggle && (
            <div className='sea-qa-ai-ask-chats-toggle-session-panel' style={{ transform: `translateY(${sessionTogglePanelTranslateY}px)` }}>
              <ClickOutside onClickOutside={() => setIsShowSessionToggle(false)}>
                <div className='sea-qa-dropdown-menu dropdown-menu position-fixed sea-metadata-view-dropdown-menu'>
                  <div onClick={convertToAgent} className='dropdown-item sea-qa-dropdown-item'>
                    <span>{gettext('Agent')}</span>
                    {resolveType === 'agent' && <IconButton icon='check-mark'/>}
                  </div>
                  <div onClick={convertToAsk} className='dropdown-item sea-qa-dropdown-item'>
                    <span>{gettext('Ask')}</span>
                    {resolveType === 'ask' && <IconButton icon='check-mark'/>}
                  </div>
                </div>
              </ClickOutside>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
