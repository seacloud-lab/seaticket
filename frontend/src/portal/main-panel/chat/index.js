import React, { useCallback, useRef, useState, useEffect } from 'react';
import classnames from 'classnames';
import { CenteredLoading, Icon, IconButton, IconTooltip, toaster } from '@/components';
import { gettext } from '@/constants';
import { portalAPI } from '../../api';
import { CHAT_MESSAGE_TYPE, ASK_PAGE_SLUG_ID } from '@/project/main-panel/ask/constants';
import { ChatMessage } from '@/project/main-panel/ask/models';
import ChatHistory from './chat-history';
import MessageInput from './message-input';
import Sessions from './sessions';
import { Utils } from '@/utils/utils';
import Thinking from '@/project/main-panel/ask/components/thinking';

import '@/project/main-panel/ask/chat/index.css';
import '@/project/main-panel/ask/chat-header/index.css';
import './chat.css';

const PortalChat = ({ projectUuid }) => {
  const [loading, setLoading] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(ASK_PAGE_SLUG_ID.NEW);
  const [chatHistories, setChatHistories] = useState([]);
  const [isShowSessions, setIsShowSessions] = useState(true);
  const [height, setHeight] = useState(window.innerHeight - 44);
  const [clearContext, setClearContext] = useState(false);

  const chatHistoryContentRef = useRef(null);
  const messageInputRef = useRef(null);
  const wrapperRef = useRef(null);
  const timer = useRef(null);

  const placeholder = gettext('What problem do you want to solve?');

  const jumpToBottom = useCallback((delay = 1) => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!chatHistoryContentRef.current) return;
    timer.current = setTimeout(() => {
      chatHistoryContentRef.current.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
    }, delay);
  }, []);

  const updateChatHistories = useCallback((newChatHistories, callback) => {
    setChatHistories(newChatHistories);
    callback && callback();
    jumpToBottom(50);
  }, [jumpToBottom]);

  const loadSessions = useCallback(() => {
    portalAPI.listChatSessions(projectUuid).then(res => {
      setSessions(res.data.sessions || []);
    }).catch(error => {
      console.error('Failed to load sessions:', error);
    });
  }, [projectUuid]);

  const loadMessages = useCallback((sessionId) => {
    if (sessionId === ASK_PAGE_SLUG_ID.NEW) {
      setChatHistories([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    portalAPI.getChatMessages(projectUuid, sessionId).then(res => {
      const messages = res.data.messages.map(item => {
        if (item.role === 'user') {
          return new ChatMessage({
            id: item.id,
            message: { [CHAT_MESSAGE_TYPE.TEXT]: item.content },
            isUserSpeak: true,
          });
        }

        if (item.role === 'chat_manager') {
          return new ChatMessage({
            id: item.id,
            message: item.content,
          });
        }

        return new ChatMessage({
          id: item.id,
          message: {
            [CHAT_MESSAGE_TYPE.AI_REPLY]: item.content,
          },
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
  }, [projectUuid, updateChatHistories]);

  const sendMessage = useCallback((message) => {
    const validMessage = message.message.trim();
    if (!validMessage) {
      messageInputRef.current?.focusInput();
      return;
    }

    const userMessage = new ChatMessage({
      message: { [CHAT_MESSAGE_TYPE.TEXT]: validMessage },
      isUserSpeak: true,
    });

    setChatHistories(prev => [...prev, userMessage]);
    messageInputRef.current?.clearInput();
    jumpToBottom(50);
    setIsReplying(true);
    const shouldClearContext = clearContext;
    setClearContext(false);

    const sendMessageToSession = (sessionUuid) => {
      const params = {
        query: validMessage,
        session_uuid: sessionUuid,
        model: message.model || null,
        clear_context: shouldClearContext,
      };

      portalAPI.sendChatMessage(projectUuid, params).then(res => {
        const data = res.data;
        const { ai_reply = '', user_message_id, ai_reply_message_id } = data;

        setChatHistories(prev => {
          const updated = prev.map((item, index) =>
            index === prev.length - 1 && item.isUserSpeak
              ? new ChatMessage({ id: user_message_id, message: item.message, isUserSpeak: true })
              : item
          );
          updated.push(new ChatMessage({
            id: ai_reply_message_id,
            message: { [CHAT_MESSAGE_TYPE.AI_REPLY]: ai_reply },
            type: CHAT_MESSAGE_TYPE.GROUP
          }));
          return updated;
        });
        jumpToBottom(50);
        setIsReplying(false);
      }).catch(error => {
        const errorMessage = Utils.getErrorMsg(error);
        setChatHistories(prev => [
          ...prev,
          new ChatMessage({
            message: { [CHAT_MESSAGE_TYPE.TEXT]: errorMessage },
            type: CHAT_MESSAGE_TYPE.ERROR
          })
        ]);
        jumpToBottom(50);
        setIsReplying(false);
      });
    };

    if (currentSessionId === ASK_PAGE_SLUG_ID.NEW) {
      const sessionName = validMessage.slice(0, 50);
      portalAPI.createChatSession(projectUuid, sessionName).then(res => {
        const newSessionUuid = res.data.session.session_uuid;
        setCurrentSessionId(newSessionUuid);
        loadSessions();
        sendMessageToSession(newSessionUuid);
      }).catch(error => {
        const errorMessage = Utils.getErrorMsg(error);
        toaster.danger(errorMessage);
        setIsReplying(false);
      });
    } else {
      sendMessageToSession(currentSessionId);
    }
  }, [projectUuid, currentSessionId, jumpToBottom, loadSessions, clearContext]);

  const handleSelectSession = useCallback((sessionId) => {
    setCurrentSessionId(sessionId);
    setClearContext(false);
    loadMessages(sessionId);
  }, [loadMessages]);

  const handleNewChat = useCallback(() => {
    setCurrentSessionId(ASK_PAGE_SLUG_ID.NEW);
    setChatHistories([]);
    setClearContext(false);
  }, []);

  const toggleClearContext = useCallback(() => {
    const newChatHistories = chatHistories.slice(0);
    if (!clearContext) {
      newChatHistories.push(
        new ChatMessage({
          id: 'customize_break_context',
          message: '<break_context>',
        })
      );
      updateChatHistories(newChatHistories);
    } else {
      const lastChat = newChatHistories[newChatHistories.length - 1];
      if (lastChat._id === 'customize_break_context') {
        newChatHistories.splice(-1);
        updateChatHistories(newChatHistories);
      }
    }
    setClearContext(!clearContext);
  }, [clearContext, chatHistories, updateChatHistories]);

  const handleDeleteSession = useCallback((sessionId) => {
    portalAPI.deleteChatSession(projectUuid, sessionId).then(() => {
      setSessions(prev => prev.filter(s => s.session_uuid !== sessionId));
      if (currentSessionId === sessionId) {
        handleNewChat();
      }
      toaster.success(gettext('Session deleted'));
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [projectUuid, currentSessionId, handleNewChat]);

  const handleRenameSession = useCallback((sessionId, newName) => {
    portalAPI.modifyChatSession(projectUuid, sessionId, { session_name: newName }).then(() => {
      setSessions(prev => prev.map(s =>
        s.session_uuid === sessionId ? { ...s, session_name: newName } : s
      ));
      toaster.success(gettext('Session renamed'));
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [projectUuid]);

  const toggleIsShowSessions = useCallback(() => {
    setIsShowSessions(prev => !prev);
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const handleResize = () => {
      if (!wrapper) return;
      setHeight(wrapper.offsetHeight);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    wrapper && resizeObserver.observe(wrapper);
    return () => {
      wrapper && resizeObserver.unobserve(wrapper);
    };
  }, []);

  const isEmpty = chatHistories.length === 0 && !loading;
  const hasHistoryMessages = chatHistories.length > 0;
  const isNotNewSession = currentSessionId !== ASK_PAGE_SLUG_ID.NEW;
  const disabled = loading || isReplying;
  const currentSession = isNotNewSession ? sessions.find(s => s.session_uuid === currentSessionId) : null;

  return (
    <div className="portal-chat-wrapper" ref={wrapperRef}>
      <div className="portal-chat-header">
        <div className="portal-chat-header-title">{gettext('Chat')}</div>
        <div className="portal-chat-header-buttons">
          <IconButton
            icon="new-chat"
            onClick={handleNewChat}
            title={gettext('New chat')}
            aria-label={gettext('New chat')}
          />
          <IconButton
            icon="history"
            onClick={toggleIsShowSessions}
            title={gettext('Histories')}
            aria-label={gettext('Histories')}
          />
        </div>
      </div>
      <div className="portal-chat-main-container">
        <div className="portal-chat-content">
          <div className={classnames('sea-qa-ai-ask-wrapper', { 'empty': isEmpty, 'large': !isShowSessions })}>
            {isNotNewSession && (
              <div className="sea-qa-ai-ask-chats-header">
                <div className="chat-header-title-content" title={currentSession?.session_name}>{currentSession?.session_name}</div>
                {hasHistoryMessages && (
                  <>
                    <div className="chat-header-divider"></div>
                    <IconTooltip
                      disabled={disabled}
                      icon="clear"
                      hoverBackground={true}
                      tip={gettext('Clear context')}
                      className="d-flex m-0"
                      placement="bottom"
                      size={{ btn: 24, icon: 16 }}
                      onClick={disabled ? () => {} : toggleClearContext}
                    />
                  </>
                )}
              </div>
            )}
            <div className="sea-qa-ai-ask-chats-wrapper">
              <div className="sea-qa-ai-ask-chats" ref={chatHistoryContentRef}>
                {isEmpty && (
                  <div className="sea-qa-ai-ask-chats-tip" style={{ marginTop: height > 420 ? 134 : Math.max(0, height - 286) }}>
                    <Icon symbol="problem-solving" className="sea-qa-ai-ask-chats-tip-icon" />
                    <div className="sea-qa-ai-ask-chats-tip-title">{gettext('How can I help you?')}</div>
                  </div>
                )}
                {!loading && chatHistories.map((chat, chatIndex) => (
                  <ChatHistory key={`chat-${chatIndex}`} chat={chat} />
                ))}
                {!loading && isReplying && <Thinking />}
                {loading && (<CenteredLoading className="flex-1" />)}
              </div>
            </div>
            <div className="sea-qa-ai-ask-chat-input-wrapper-shell">
              <MessageInput
                ref={messageInputRef}
                isReply={loading || isReplying}
                placeholder={placeholder}
                sendMessage={sendMessage}
              />
            </div>
          </div>
        </div>
        {isShowSessions && (
          <Sessions
            sessions={sessions}
            currentSessionId={currentSessionId}
            onSelectSession={handleSelectSession}
            onDeleteSession={handleDeleteSession}
            onRenameSession={handleRenameSession}
            onClose={toggleIsShowSessions}
          />
        )}
      </div>
    </div>
  );
};

export default PortalChat;
