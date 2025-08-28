import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import classnames from 'classnames';
import { ChatMessage } from '../../models';
import { CHAT_MESSAGE_TYPE } from '../../constants';
import MessageInput from './message-input';
import { gettext } from '../../../constants';
import { askAPI } from '../../api';
import ChatHistory from './chat-history';
import Thinking from './thinking';
import Loading from '../../../components/loading';
import TopBar from '../top-bar';
import SidePanel from './side-panel';
import { Utils } from '../../../utils/utils';
import './index.css';

const {
  workspaceID, projectUuid
} = window.app.pageOptions;

const Ask = ({ title }) => {
  const [chatSessions, setChatSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState('');
  const [isReply, setReply] = useState(false);
  const [size] = useState('');
  const [loading, setLoading] = useState(false);

  const timer = useRef(null);
  const wrapperRef = useRef(null);
  const chatHistoryContentRef = useRef(null);
  const messageInputRef = useRef(null);

  const readOnly = useMemo(() => false, []);

  const currentSession = useMemo(() => {
    return chatSessions.find(session => session.session_uuid === currentSessionId) || null;
  }, [chatSessions, currentSessionId]);

  const currentChatHistories = useMemo(() => {
    return currentSession ? currentSession.chatHistories : [];
  }, [currentSession]);

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

  const updateSessionChatHistories = useCallback((sessionId, newChatHistories, isReply, callback) => {
    const filteredChatHistories = newChatHistories.filter(chat => 
      !chat.isUserSpeak && Array.isArray(chat.messages) ? chat.messages.length > 0 : true
    );

    setChatSessions(prevSessions => {
      const updatedSessions = prevSessions.map(session => {
        if (session.session_uuid === sessionId) {
          let sessionTitle = session.title;
          if (!sessionTitle || sessionTitle === gettext('New Chat')) {
            const firstUserMessage = filteredChatHistories.find(chat => chat.isUserSpeak);
            if (firstUserMessage && firstUserMessage.messages && firstUserMessage.messages[0]) {
              sessionTitle = firstUserMessage.messages[0].value.slice(0, 30) +
                (firstUserMessage.messages[0].value.length > 30 ? '...' : '');
            }
          }

          return {
            ...session,
            title: sessionTitle,
            chatHistories: filteredChatHistories,
          };
        }
        return session;
      });

      return updatedSessions;
    });

    setReply(isReply);
    callback && callback();
    jumpToBottom(isReply ? 10 : 50);
  }, [jumpToBottom]);

  const sendMessage = useCallback(async (message) => {
    const validMessage = message.trim();
    if (!validMessage || !currentSessionId) {
      messageInputRef.current?.focusInput();
      return;
    }

    const newChatHistories = [...currentChatHistories];
    let messages = [{ type: CHAT_MESSAGE_TYPE.TEXT, value: validMessage }];

    newChatHistories.push(new ChatMessage({
      messages: messages,
      isUserSpeak: true,
    }));
    updateSessionChatHistories(currentSessionId, newChatHistories, true, () => {
      messageInputRef.current?.clearInput();
    });
    askAPI.askQuestion({
      project_uuid: projectUuid,
      workspace_id: workspaceID,
      query: validMessage,
      session_uuid: currentSessionId, 
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

      updateSessionChatHistories(currentSessionId, newChatHistories, false);
    }).catch((error) => {
      const errorMessage = Utils.getErrorMsg(error);
      newChatHistories.push(new ChatMessage({
        messages: [{ type: CHAT_MESSAGE_TYPE.TEXT, value: gettext(errorMessage) }],
        type: CHAT_MESSAGE_TYPE.ERROR
      }));
      updateSessionChatHistories(currentSessionId, newChatHistories, false);
    });
  }, [currentChatHistories, currentSessionId, updateSessionChatHistories, projectUuid, workspaceID]);

  const handleNewSession = useCallback(async () => {
    try {
      const res = await askAPI.createChatSession(projectUuid, gettext('New Chat'), workspaceID);
      const newSessionData = res.data;
      const newSession = {
        ...newSessionData,
        chatHistories: [
          new ChatMessage({
            _id: 'use_tip',
            type: CHAT_MESSAGE_TYPE.TIP,
            messages: [],
          })
        ],
      };

      setChatSessions(prevSessions => [newSession, ...prevSessions]);
      setCurrentSessionId(newSession.session_uuid);
    } catch (error) {
      console.error('Failed to create new session:', error);
    }
  }, [projectUuid, workspaceID]);

  const loadChatHistory = useCallback(async (sessionId) => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await askAPI.getChatMessages(sessionId, workspaceID);
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

      setChatSessions(prevSessions => {
        return prevSessions.map(session => {
          if (session.session_uuid === sessionId) {
            return { ...session, chatHistories: messages };
          }
          return session;
        });
      });
    } catch (error) {
      console.error('Failed to load chat history:', error);
    } finally {
      setLoading(false);
      jumpToBottom(100);
    }
  }, [jumpToBottom, workspaceID]);

  const handleSessionSelect = useCallback((sessionId) => {
    setCurrentSessionId(sessionId);
    loadChatHistory(sessionId);
  }, [loadChatHistory]);

  const handleDeleteSession = useCallback(async (sessionUuid) => {
    try {
      await askAPI.deleteChatSession(sessionUuid, workspaceID);

      setChatSessions(prevSessions => {
        const updatedSessions = prevSessions.filter(session => session.session_uuid !== sessionUuid);
        if (sessionUuid === currentSessionId && updatedSessions.length > 0) {
          const newCurrentId = updatedSessions[0].session_uuid;
          setCurrentSessionId(newCurrentId);
          loadChatHistory(newCurrentId);
        } else if (updatedSessions.length === 0) {
          setCurrentSessionId('');
        }

        return updatedSessions;
      });
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  }, [currentSessionId, loadChatHistory, workspaceID]);

  useEffect(() => {
    const loadChatSessions = async () => {
      try {
        const res = await askAPI.getChatSessions(projectUuid, workspaceID);
        const sessions = res.data.sessions.map(s => ({ ...s, chatHistories: [] }));

        setChatSessions(sessions);

        if (sessions.length > 0) {
          const firstSessionId = sessions[0].session_uuid;
          setCurrentSessionId(firstSessionId);
          loadChatHistory(firstSessionId);
        } else {
          setCurrentSessionId('');
          setChatSessions([]);
        }
      } catch (error) {
        console.error('Failed to load chat sessions:', error);
        setCurrentSessionId('');
        setChatSessions([]);
      }
    };
    loadChatSessions();
  }, [projectUuid, workspaceID, loadChatHistory]);

  return (
    <>
      <TopBar>
        <div className="w-100 text-truncate">{title}</div>
      </TopBar>
      <div className="ask-main-container">
        <SidePanel
          chatSessions={chatSessions}
          currentSessionId={currentSessionId}
          onSessionSelect={handleSessionSelect}
          onNewSession={handleNewSession}
          onDeleteSession={handleDeleteSession}
        />
        <div className={classnames('sea-qa-ai-ask-wrapper', size)} ref={wrapperRef}>
          <div className="sea-qa-ai-ask-chats-wrapper">
            <div className="sea-qa-ai-ask-chats" ref={chatHistoryContentRef}>
              {currentChatHistories.map((chat, chatIndex) => {
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
              chatHistories={currentChatHistories}
              sendMessage={sendMessage}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default Ask;
