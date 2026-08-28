import React, { useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Utils } from '@/utils/utils';
import { toaster } from '@/components';
import { gettext } from '@/constants';
import { AttachmentObject, ChatSession } from '../models';
import { useAskPage } from './page-type';
import { ASK_PAGE_SLUG_ID, CHAT_ATTACHMENT_TYPE, SESSION_TAB_TYPE } from '../constants';
import eventBus from '@/utils/event-bus';
import { EVENT_BUS_TYPE } from '../../../constants';

const SessionsContext = React.createContext(null);

export const SessionsProvider = ({ projectUuid, api, children }) => {
  const [isLoading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [teamSessions, setTeamSessions] = useState([]);
  const [isTeamSessionsLoading, setIsTeamSessionsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(SESSION_TAB_TYPE.MINE);
  const [isShowSessions, setIsShowSessions] = useState(false);

  const sendMessageRequestController = useRef({});

  const { togglePageSlugId, pageSlugId } = useAskPage();

  const createSession = useCallback((name) => {
    return api.createChatSession(projectUuid, name).then(res => {
      const session = new ChatSession(res.data.session);
      const newSessions = [session, ...sessions];
      setSessions(newSessions);
      return session;
    });
  }, [projectUuid, sessions, api]);

  const startChatFromConversation = useCallback((sessionId) => {
    return api.copyChatSession(projectUuid, sessionId).then(res => {
      const session = new ChatSession(res.data.session);
      setSessions(prevSessions => {
        if (prevSessions.some(item => item._id === session._id)) return prevSessions;
        return [session, ...prevSessions];
      });
      setActiveTab(SESSION_TAB_TYPE.MINE);
      togglePageSlugId(session._id);
      toaster.success(gettext('Started a new chat from this conversation'));
      return session;
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [projectUuid, togglePageSlugId, api]);

  const modifySession = useCallback((sessionId, { name }) => {
    return api.modifyChatSession(projectUuid, sessionId, { session_name: name }).then(res => {
      let newSessions = sessions.slice(0);
      const sessionIdx = newSessions.findIndex(s => s._id === sessionId);
      let session = newSessions[sessionIdx];
      session.name = name;
      newSessions[sessionIdx] = session;
      setSessions(newSessions);
    });
  }, [projectUuid, sessions, api]);

  const deleteSession = useCallback((sessionId) => {
    return api.deleteChatSession(projectUuid, sessionId).then(res => {
      let newSessions = sessions.slice(0);
      const sessionIdx = newSessions.findIndex(s => s._id === sessionId);
      newSessions.splice(sessionIdx, 1);
      if (pageSlugId === sessionId) {
        togglePageSlugId(ASK_PAGE_SLUG_ID.NEW);
      }
      setSessions(newSessions);
    });
  }, [projectUuid, sessions, pageSlugId, togglePageSlugId, api]);

  const openShowSessions = useCallback(() => {
    setIsShowSessions(true);
  }, []);

  const closeShowSessions = useCallback(() => {
    setIsShowSessions(false);
  }, []);

  const toggleIsShowSessions = useCallback(() => {
    setIsShowSessions(!isShowSessions);
  }, [isShowSessions]);

  const solveProblem = useCallback(({ sessionId, message: problem, attachments, model, clearContext }) => {
    const _updateSessions = (sessions) => {
      const newSessions = sessions.slice(0);
      const sessionIdx = newSessions.findIndex(session => session._id === sessionId);
      if (sessionIdx === -1) return sessions;
      const session = newSessions[sessionIdx];
      session.is_replying = true;
      session.running_task = true;
      session.problem = null;
      newSessions[sessionIdx] = session;
      return newSessions;
    };
    setSessions(_updateSessions);
    setTeamSessions(_updateSessions);

    const attachmentsForServer = Array.isArray(attachments) && attachments.length > 0 ? attachments.filter(attachment => {
      if (attachment.type === CHAT_ATTACHMENT_TYPE.IMAGE) return attachment.status === 'done';
      return true;
    }).map(attachment => {
      if (attachment instanceof AttachmentObject) return attachment.to_json();
      const newAttachment = new AttachmentObject(attachment);
      return newAttachment.to_json();
    }) : null;

    const params = {
      project_uuid: projectUuid,
      query: problem,
      session_uuid: sessionId,
      attachments: attachmentsForServer,
      model: model,
      clear_context: clearContext,
      stream: true,
    };

    const currentController = new AbortController();

    const options = {
      signal: currentController.signal
    };

    sendMessageRequestController.current = {
      ...sendMessageRequestController.current,
      [sessionId]: currentController,
    };

    const callback = (sessionId, isStop = false) => {
      const controller = sendMessageRequestController.current[sessionId];
      if (!controller) return;
      if (isStop) {
        controller.abort();
      }
      delete sendMessageRequestController.current[sessionId];
    };

    api.sendChatMessageByStream(params, options).then((res) => {
      eventBus.dispatch(EVENT_BUS_TYPE.AI_STREAM_REPLY, sessionId, { res }, callback);
    }).catch(error => {
      eventBus.dispatch(EVENT_BUS_TYPE.AI_STREAM_REPLY, sessionId, { error }, callback);
    });
  }, [projectUuid, api]);

  const modifyLocalSession = useCallback((sessionId, update) => {
    const _updateSessions = (sessions) => {
      let newSessions = sessions.slice(0);
      const sessionIdx = newSessions.findIndex(session => session._id === sessionId);
      if (sessionIdx === -1) return sessions;
      if (Object.keys(update).length === 0) return sessions;
      let session = newSessions[sessionIdx];
      Object.keys(update).forEach(key => {
        session[key] = update[key];
      });
      newSessions[sessionIdx] = session;
      return newSessions;
    };
    setSessions(_updateSessions);
    setTeamSessions(_updateSessions);
  }, []);

  const markSessionRunningTask = useCallback((sessionId, runningTask) => {
    const _updateSessions = (sessions) => {
      let newSessions = sessions.slice(0);
      const sessionIdx = newSessions.findIndex(s => s._id === sessionId);
      if (sessionIdx !== -1) {
        newSessions[sessionIdx].running_task = runningTask;
      }
      return newSessions;
    };
    setSessions(_updateSessions);
    setTeamSessions(_updateSessions);
  }, []);

  const getChatMessage = useCallback((sessionId, isStream, streamed_length) => {
    markSessionRunningTask(sessionId, true);

    const currentController = new AbortController();
    const options = {
      signal: currentController.signal,
    };

    sendMessageRequestController.current = {
      ...sendMessageRequestController.current,
      [sessionId]: currentController,
    };

    const callback = (sessionId, isStop = false) => {
      const controller = sendMessageRequestController.current[sessionId];
      if (!controller) return;
      if (isStop) {
        controller.abort();
      }
      delete sendMessageRequestController.current[sessionId];
    };

    if (isStream) {
      api.getChatMessageByStream(projectUuid, sessionId, streamed_length, options).then(res => {
        eventBus.dispatch(EVENT_BUS_TYPE.AI_STREAM_REPLY, sessionId, { res }, callback);
      }).catch(error => {
        eventBus.dispatch(EVENT_BUS_TYPE.AI_STREAM_REPLY, sessionId, { error }, callback);
      });
      return;
    }
    api.getChatMessage(projectUuid, sessionId, options).then(res => {
      eventBus.dispatch(EVENT_BUS_TYPE.AI_REPLY, sessionId, { data: res.data }, callback);
    }).catch(error => {
      eventBus.dispatch(EVENT_BUS_TYPE.AI_REPLY, sessionId, { error }, callback);
    });
  }, [api, projectUuid, markSessionRunningTask]);

  const loadTeamSessions = useCallback(() => {
    setIsTeamSessionsLoading(true);
    api.listTeamSharedSessions(projectUuid).then(res => {
      let teamSessionsList = res.data.sessions;
      if (Array.isArray(teamSessionsList) && teamSessionsList.length > 0) {
        teamSessionsList = teamSessionsList.map(session => new ChatSession(session));
      } else {
        teamSessionsList = [];
      }
      setTeamSessions(teamSessionsList);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setTeamSessions([]);
    }).finally(() => {
      setIsTeamSessionsLoading(false);
    });
  }, [projectUuid, api]);

  const shareSession = useCallback((sessionId) => {
    return api.shareChatSession(projectUuid, sessionId, true).then(res => {
      let newSessions = sessions.slice(0);
      const sessionIdx = newSessions.findIndex(s => s._id === sessionId);
      if (sessionIdx !== -1) {
        newSessions[sessionIdx].is_shared = true;
        setSessions(newSessions);
      }
      toaster.success('Chat shared within team');
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [projectUuid, sessions, api]);

  const unshareSession = useCallback((sessionId) => {
    return api.shareChatSession(projectUuid, sessionId, false).then(res => {
      let newSessions = sessions.slice(0);
      const sessionIdx = newSessions.findIndex(s => s._id === sessionId);
      if (sessionIdx !== -1) {
        newSessions[sessionIdx].is_shared = false;
        setSessions(newSessions);
      }
      toaster.success('Chat unshared from team');
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [projectUuid, sessions, api]);

  useEffect(() => {
    setLoading(true);
    api.listChatSessions(projectUuid).then(res => {
      let sessions = res.data.sessions;
      if (Array.isArray(sessions) && sessions.length > 0) {
        sessions = sessions.map(session => new ChatSession(session));
      } else {
        sessions = [];
      }
      setSessions(sessions);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setSessions([]);
    }).finally(() => {
      setLoading(false);
    });
  }, [projectUuid, api]);

  useEffect(() => {
    const unsubscribeSendChatMessage = eventBus.subscribe(EVENT_BUS_TYPE.ASK_QUESTION, solveProblem);
    return () => {
      unsubscribeSendChatMessage();
    };
  }, [sessions, solveProblem]);

  useEffect(() => {
    return () => {
      Object.keys(sendMessageRequestController.current).forEach((sessionId) => {
        const controller = sendMessageRequestController.current[sessionId];
        if (controller) {
          try {
            controller.abort();
          } catch {
            //
          }
        }
      });
    };
  }, []);

  return (
    <SessionsContext.Provider value={{
      sessions,
      teamSessions,
      isLoading,
      isTeamSessionsLoading,
      activeTab,
      setActiveTab,
      isShowSessions,
      createSession,
      modifySession,
      deleteSession,
      openShowSessions,
      closeShowSessions,
      toggleIsShowSessions,
      solveProblem,
      modifyLocalSession,
      loadTeamSessions: api.listTeamSharedSessions ? loadTeamSessions : null,
      shareSession: api.shareChatSession ? shareSession : null,
      unshareSession: api.shareChatSession ? unshareSession : null,
      startChatFromConversation: api.copyChatSession ? startChatFromConversation : null,
      getChatMessage,
      markSessionRunningTask,
    }}>
      {children}
    </SessionsContext.Provider>
  );
};

export const useSessions = () => {
  const context = useContext(SessionsContext);
  if (!context) {
    throw new Error('\'SessionsContext\' is null');
  }
  return context;
};
