import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import classnames from 'classnames';
import { CenteredLoading, Icon, toaster, SecondaryBtn } from '@/components';
import { gettext, username } from '@/constants';
import { ChatMessage, ChatSession } from '../models';
import { ASK_PAGE_SLUG_ID, CHAT_MESSAGE_TYPE } from '../constants';
import ChatInput from '../chat-input';
import ChatHistory from '../chat-history';
import { Thinking } from '../components';
import { Utils } from '@/utils/utils';
import { useAskPage, useSessions, useDocuments } from '../hooks';
import eventBus from '@/utils/event-bus';
import { EVENT_BUS_TYPE } from '@/project/constants';
import ChatHeader from '../chat-header';

import './index.css';

const Chat = ({ sessionId, projectUuid, settings, projectName, workspaceID, allowedAttachmentSources, canSelectModel, api, renderOperation, customHeaderTitle }) => {
  const [isReply, setReply] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chatHistories, setChatHistories] = useState([]);
  const [clearContext, setClearContext] = useState(false);
  const [isStartingChatFromConversation, setIsStartingChatFromConversation] = useState(false);
  const [fetchedSession, setFetchedSession] = useState(null);

  const timer = useRef(null);
  const wrapperRef = useRef(null);
  const chatHistoryContentRef = useRef(null);
  const messageInputRef = useRef(null);
  const currentSessionId = useRef('');
  const newSessionProblem = useRef('');
  const aiReplyStreamTimer = useRef('');
  const pendingTitleQueryBySession = useRef({});
  const requestedTitleSessionSet = useRef(new Set());

  const { isShowSessions, sessions, teamSessions, createSession, startChatFromConversation, modifyLocalSession, getChatMessage } = useSessions();
  const { togglePageSlugId } = useAskPage();
  const { isShowDocuments, documents } = useDocuments();

  const isSmall = useMemo(() => {
    if (isShowDocuments && Array.isArray(documents) && documents.length > 0) return true;
    if (isShowSessions) return true;
    return false;
  }, [isShowDocuments, documents, isShowSessions]);

  const session = useMemo(() => {
    if (sessionId === ASK_PAGE_SLUG_ID.NEW) return null;
    return sessions.find(s => s._id === sessionId) || teamSessions.find(s => s._id === sessionId) || (fetchedSession?._id === sessionId ? fetchedSession : null);
  }, [sessionId, sessions, teamSessions, fetchedSession]);

  const isSharedByOther = useMemo(() => {
    return Boolean(session?.is_shared && session.username && session.username !== username);
  }, [session]);

  const readOnly = useMemo(() => {
    return Boolean(session?.running_task || isSharedByOther);
  }, [session?.running_task, isSharedByOther]);

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

  const triggerTitleGeneration = useCallback((targetSessionId, aiReply = '') => {
    const query = pendingTitleQueryBySession.current[targetSessionId];
    if (!query) return;
    if (requestedTitleSessionSet.current.has(targetSessionId)) return;
    if (!api?.generateChatSessionTitle) return;

    requestedTitleSessionSet.current.add(targetSessionId);
    api.generateChatSessionTitle(projectUuid, targetSessionId, {
      query,
      ai_reply: aiReply || '',
    }).then((res) => {
      const sessionName = res?.data?.session_name;
      if (sessionName) {
        modifyLocalSession(targetSessionId, { name: sessionName });
      }
    }).catch(() => {
      // ignore title generation error to avoid blocking chat flow
    }).finally(() => {
      delete pendingTitleQueryBySession.current[targetSessionId];
    });
  }, [api, projectUuid, modifyLocalSession]);

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

    if (sessionId !== ASK_PAGE_SLUG_ID.NEW) {
      eventBus.dispatch(EVENT_BUS_TYPE.ASK_QUESTION, { sessionId, message: validMessage, attachments, model, clearContext });
      return;
    }
    createSession(validMessage.slice(0, 100)).then(session => {
      const newSessionId = session._id;
      pendingTitleQueryBySession.current[newSessionId] = validMessage;
      currentSessionId.current = newSessionId;
      newSessionProblem.current = '';
      togglePageSlugId(newSessionId);
      setTimeout(() => {
        eventBus.dispatch(EVENT_BUS_TYPE.ASK_QUESTION, { sessionId: newSessionId, message: validMessage, attachments, model });
      }, 3);
    });
  }, [sessionId, chatHistories, updateChatHistories, togglePageSlugId, createSession]);

  const toggleClearContext = useCallback(() => {
    let newChatHistories = chatHistories.slice(0);
    if (!clearContext) {
      newChatHistories.push(
        new ChatMessage({
          message: '<break_context>',
          id: 'customize_break_context',
        })
      );
      updateChatHistories(newChatHistories);
    } else {
      const lastChat = newChatHistories[newChatHistories.length - 1];
      if (lastChat._id === 'customize_break_context') {
        newChatHistories = newChatHistories.slice(0, -1);
        updateChatHistories(newChatHistories);
      }
    }
    setClearContext(!clearContext);
  }, [clearContext, chatHistories]);

  const resetClearContext = useCallback(() => {
    setClearContext(false);
  }, []);

  const handleStartChatFromConversation = useCallback(() => {
    if (!session?._id || !startChatFromConversation || isStartingChatFromConversation) return;
    setIsStartingChatFromConversation(true);
    startChatFromConversation(session._id).finally(() => {
      setIsStartingChatFromConversation(false);
    });
  }, [session, startChatFromConversation, isStartingChatFromConversation]);

  useEffect(() => {
    if (currentSessionId.current === sessionId) return;
    setClearContext(false);
    const problem = messageInputRef.current?.getProblem() || '';
    if (currentSessionId.current !== ASK_PAGE_SLUG_ID.NEW) {
      modifyLocalSession(currentSessionId.current, { problem });
    } else {
      newSessionProblem.current = problem;
    }

    currentSessionId.current = sessionId;
    setFetchedSession(null);
    updateChatHistories([]);
    setLoading(true);

    // new blank chat
    if (sessionId === ASK_PAGE_SLUG_ID.NEW) {
      setLoading(false);
      return;
    }

    api.getChatMessages(projectUuid, sessionId).then(res => {
      const { session: sessionData, messages: historyMessages, running_task, running_task_is_stream, user_input, streamed_data, streamed_length } = res.data;
      if (sessionData) {
        setFetchedSession(new ChatSession({ ...sessionData, running_task: Boolean(running_task) }));
        modifyLocalSession(sessionId, { running_task: Boolean(running_task) });
      }
      let messages = Array.isArray(historyMessages) ? historyMessages.map(item => {
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
        } else if (item.role === 'chat_manager') {
          return new ChatMessage({
            _id: item.id,
            message: item.content,
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
      }) : [];

      if (running_task) {
        setReply(true);
        const { message, attachments } = user_input;
        messages.push(new ChatMessage({
          message: {
            [CHAT_MESSAGE_TYPE.TEXT]: message,
            [CHAT_MESSAGE_TYPE.ATTACHMENTS]: attachments,
          },
          isUserSpeak: true,
        }));
        if (running_task_is_stream) {
          const newChatData = {
            [CHAT_MESSAGE_TYPE.AI_REPLY]: streamed_data?.answer || '',
            [CHAT_MESSAGE_TYPE.SOURCES]: [],
            [CHAT_MESSAGE_TYPE.THOUGHT_PROCESS]: 'disabled',
          };
          messages.push(new ChatMessage({
            id: 'typing',
            message: newChatData,
            type: CHAT_MESSAGE_TYPE.GROUP
          }));
          setReply(false);
        }
      }

      updateChatHistories(messages);
      setLoading(false);

      if (running_task) {
        getChatMessage(sessionId, running_task_is_stream || false, streamed_length);
      }
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setLoading(false);
    });
  }, [sessionId]);

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
    const unsubscribeAIReply = eventBus.subscribe(EVENT_BUS_TYPE.AI_REPLY, (reply_session_id, { data, error }, callback) => {
      modifyLocalSession(reply_session_id, { is_replying: false, running_task: false });
      if (reply_session_id !== sessionId) {
        callback && callback(reply_session_id, true);
        return;
      }
      setReply(false);
      let newChatHistories = chatHistories.slice(0);
      if (error) {
        const errorMessage = Utils.getErrorMsg(error);
        newChatHistories.push(new ChatMessage({
          message: { [CHAT_MESSAGE_TYPE.TEXT]: gettext(errorMessage) },
          type: CHAT_MESSAGE_TYPE.ERROR
        }));
        updateChatHistories(newChatHistories, false);
        callback && callback(reply_session_id, false);
        return;
      }
      const { ai_reply = '', sources = [], user_message_id: userMessageId, ai_reply_message_id: aiReplyMessageId } = data;
      triggerTitleGeneration(reply_session_id, ai_reply);
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
      callback && callback(reply_session_id, false);
    });
    const unsubscribeAIStreamReply = eventBus.subscribe(EVENT_BUS_TYPE.AI_STREAM_REPLY, (reply_session_id, { res, error }, callback) => {
      modifyLocalSession(reply_session_id, { is_replying: false });
      if (reply_session_id !== sessionId) {
        callback && callback(reply_session_id, true);
        return;
      }
      setReply(false);
      let newChatHistories = chatHistories.slice(0);

      const _onError = (chatHistories, error) => {
        const errorMessage = error ? Utils.getErrorMsg(error) : gettext('Error');
        let _newChatHistories = chatHistories.slice(0);
        _newChatHistories.push(new ChatMessage({
          message: { [CHAT_MESSAGE_TYPE.TEXT]: errorMessage },
          type: CHAT_MESSAGE_TYPE.ERROR
        }));
        updateChatHistories(_newChatHistories, false);
        modifyLocalSession(reply_session_id, { running_task: false });
        callback && callback(reply_session_id);
      };

      if (error) {
        _onError(newChatHistories, error);
        return;
      }

      if (!res.ok) {
        _onError(newChatHistories);
        return;
      }

      const _updateChatHistories = (chatHistories, _data, _message_id_prefix = '') => {
        const _chatHistories = chatHistories.slice(0);
        const { ai_reply = '', sources = [], user_message_id: userMessageId, ai_reply_message_id: aiReplyMessageId, attachments } = _data;
        const messageIndex = _chatHistories.findIndex(c => c._id === aiReplyMessageId);
        if (messageIndex > -1) return;
        let newChatData = {
          [CHAT_MESSAGE_TYPE.AI_REPLY]: ai_reply,
          [CHAT_MESSAGE_TYPE.SOURCES]: sources,
          [CHAT_MESSAGE_TYPE.THOUGHT_PROCESS]: _data.thought_process,
        };
        let lastChatHistory = chatHistories[_chatHistories.length - 1];
        if (lastChatHistory) {
          lastChatHistory.message = {
            ...lastChatHistory.message,
            [CHAT_MESSAGE_TYPE.ATTACHMENTS]: attachments,
          };
          lastChatHistory._id = userMessageId;
          _chatHistories[_chatHistories.length - 1] = lastChatHistory;
        }
        _chatHistories.push(new ChatMessage({
          _id: _message_id_prefix + aiReplyMessageId,
          message: newChatData,
          type: CHAT_MESSAGE_TYPE.GROUP
        }));
        updateChatHistories(_chatHistories, false);
      };
      let fullText = '';

      let _newChatHistories = newChatHistories.slice(0);

      const newChatData = {
        [CHAT_MESSAGE_TYPE.AI_REPLY]: '',
        [CHAT_MESSAGE_TYPE.SOURCES]: [],
        [CHAT_MESSAGE_TYPE.THOUGHT_PROCESS]: 'disabled',
      };
      let chatMessage = new ChatMessage({
        id: 'typing',
        message: newChatData,
        type: CHAT_MESSAGE_TYPE.GROUP
      });
      const lastMessage = _newChatHistories[_newChatHistories.length - 1];
      if (lastMessage && lastMessage?.id === 'typing') {
        chatMessage = lastMessage;
        fullText = lastMessage.message[CHAT_MESSAGE_TYPE.AI_REPLY] || '';
      }
      _newChatHistories.push(chatMessage);

      const _onMessage = ({ status, answer, results }, { done = false } = {}) => {

        if (answer) {
          fullText += (answer || '');
          _newChatHistories = _newChatHistories.slice(0);
          let lastChatMessage = _newChatHistories[_newChatHistories.length - 1];
          lastChatMessage = {
            ...lastChatMessage,
            message: {
              [CHAT_MESSAGE_TYPE.TEXT]: '',
              [CHAT_MESSAGE_TYPE.AI_REPLY]: fullText,
              [CHAT_MESSAGE_TYPE.SOURCES]: [],
              [CHAT_MESSAGE_TYPE.THOUGHT_PROCESS]: 'disabled',
            }
          };
          _newChatHistories[_newChatHistories.length - 1] = lastChatMessage;
          updateChatHistories(_newChatHistories, false);
        }

        if (status && status.type) {
          _newChatHistories = _newChatHistories.slice(0);
          let lastChatMessage = _newChatHistories[_newChatHistories.length - 1];
          lastChatMessage = {
            ...lastChatMessage,
            message: {
              [CHAT_MESSAGE_TYPE.TEXT]: status?.type + (status?.detail ? ` (${status?.detail})` : ''),
              [CHAT_MESSAGE_TYPE.SOURCES]: [],
              [CHAT_MESSAGE_TYPE.THOUGHT_PROCESS]: 'disabled',
            }
          };
          _newChatHistories[_newChatHistories.length - 1] = lastChatMessage;
          updateChatHistories(_newChatHistories, false);
        }

        if (results) {
          _newChatHistories = _newChatHistories.slice(0, -1);
          _updateChatHistories(_newChatHistories, results);
          triggerTitleGeneration(reply_session_id, results.ai_reply || fullText);
        }

        if (done) {
          modifyLocalSession(reply_session_id, { running_task: false });
          callback && callback(reply_session_id);
        }
      };

      const _processLines = (lines, done = false) => {
        const messages = [];

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6).trim();

            if (dataStr === '[DONE]') {
              _onMessage({}, { done: true });
              return messages;
            }
            if (dataStr) {
              try {
                const data = JSON.parse(dataStr);
                messages.push(data);
                _onMessage(data, { done });
              } catch (e) {
                console.warn('Failed to parse JSON from EventStream:', dataStr, e);
                const data = { raw: dataStr };
                messages.push(data);
                _onMessage(data, { done });
              }
            }
          } else if (line.startsWith('event: ')) {
            const eventName = line.substring(7).trim();
            _onMessage({ event: eventName }, { done });
          }
        }
        return messages;
      };

      const _processBuffer = (buffer) => {
        if (buffer.trim()) {
          const lines = buffer.split('\n');
          return _processLines(lines, true);
        }
        return [];
      };

      const _createEventStreamReader = (readableStream) => {
        if (!readableStream || !readableStream.getReader) {
          console.error('Invalid readable stream');
          return null;
        }
        const reader = readableStream.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        return {
          readNext: async () => {
            try {
              const { done, value } = await reader.read();
              if (done) {
                _processBuffer(buffer);
                return { done: true };
              }
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              const messages = _processLines(lines);
              return { done: false, messages };
            } catch (error) {
              _onError(_newChatHistories.slice(0, -1), error);
              throw error;
            }
          },

          cancel: () => {
            reader.cancel();
          },

          [Symbol.asyncIterator]: function () {
            const self = this;
            return {
              next: async () => {
                const result = await self.readNext();
                if (result.done) {
                  return { done: true };
                }
                return { done: false, value: result.messages };
              }
            };
          }
        };
      };

      const reader = _createEventStreamReader(res.body,);

      const readNext = async () => {
        const result = await reader.readNext();
        if (!result.done) {
          readNext();
        }
      };
      readNext();
    });
    return () => {
      unsubscribeAIReply();
      unsubscribeAIStreamReply();
    };
  }, [sessionId, chatHistories, modifyLocalSession, triggerTitleGeneration]);

  useEffect(() => {
    aiReplyStreamTimer.current && clearTimeout(aiReplyStreamTimer.current);
    aiReplyStreamTimer.current = null;
  }, [sessionId]);

  const isEmpty = chatHistories.length === 0 && !loading;
  const _isReply = loading || isReply;
  const operationContent = renderOperation && renderOperation();
  const isNewChat = sessionId === ASK_PAGE_SLUG_ID.NEW;

  return (
    <div className={classnames('seaqa-ai-ask-wrapper', { 'empty': isEmpty && isNewChat, 's': isSmall, 'has-header': !isNewChat })} ref={wrapperRef}>
      {operationContent && (
        <div className="chat-header-operation-wrapper">{operationContent}</div>
      )}
      {!isNewChat && (
        <div className="seaqa-ai-ask-chats-header">
          <ChatHeader
            isReply={_isReply}
            readOnly={readOnly}
            hasHistoryMessages={!isEmpty}
            session={session}
            isEmpty={isEmpty}
            toggleClearContext={toggleClearContext}
            customHeaderTitle={customHeaderTitle}
          />
        </div>
      )}
      <div className="seaqa-ai-ask-chats-body">
        <div className={classnames('seaqa-ai-ask-chats', { 'pb-0': isEmpty, 'justify-content-center': isEmpty && !isNewChat })} ref={chatHistoryContentRef}>
          {isEmpty && (
            <div className="seaqa-ai-ask-chats-tip">
              <Icon symbol="chat-decoration" className="seaqa-ai-ask-chats-tip-icon" />
              <div className="seaqa-ai-ask-chats-tip-title">{gettext('How can I help you?')}</div>
              <div className="seaqa-ai-ask-chats-tip-description">
                {gettext('You can say "Help solve the following issue: <issue description>" to let AI solve the issue by searching knowledge bases.')}
              </div>
            </div>
          )}
          {!loading && chatHistories.map((chat, chatIndex) => {
            return (
              <ChatHistory
                key={`chat-${chatIndex}-${chat._id || ''}`}
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
      <div className="seaqa-ai-ask-chats-footer">
        {isSharedByOther && !session?.running_task && startChatFromConversation ? (
          <div className="seaqa-ai-ask-shared-readonly-footer">
            <SecondaryBtn
              icon={isStartingChatFromConversation ? 'loading' : 'copy'}
              text={gettext('Start a new chat from this conversation')}
              doing={isStartingChatFromConversation}
              onClick={handleStartChatFromConversation}
            />
          </div>
        ) : (
          <ChatInput
            ref={messageInputRef}
            isReply={_isReply}
            readOnly={readOnly}
            projectUuid={projectUuid}
            placeholder={isEmpty ? undefined : ''}
            allowedAttachmentSources={allowedAttachmentSources}
            canSelectModel={canSelectModel}
            sendMessage={sendMessage}
            clearContext={clearContext}
            resetClearContext={resetClearContext}
            api={api}
          />
        )}
      </div>
    </div>
  );
};

export default Chat;
