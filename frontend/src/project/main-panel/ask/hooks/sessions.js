import React, { useContext, useEffect, useState, useCallback, useRef } from 'react';
import { chatAPI } from '@/project/api';
import { Utils } from '@/utils/utils';
import { toaster } from '@/components';
import { ChatSession } from '../models';
import { useAskPage } from './page-type';
import { ASK_PAGE_SLUG_ID } from '../constants';
import eventBus from '@/utils/event-bus';
import { EVENT_BUS_TYPE } from '../../../constants';

const SessionsContext = React.createContext(null);

export const SESSION_TAB_TYPE = {
  MINE: 'mine',
  TEAM: 'team'
};

export const SessionsProvider = ({ projectUuid, workspaceID, children }) => {
  const [isLoading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [teamSessions, setTeamSessions] = useState([]);
  const [isTeamSessionsLoading, setIsTeamSessionsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(SESSION_TAB_TYPE.MINE);
  const [isShowSessions, setIsShowSessions] = useState(true);
  const localStorageKeyRef = useRef(`sea-qa-${projectUuid}-ask-sessions-display`);

  const { togglePageSlugId, pageSlugId } = useAskPage();

  const createSession = useCallback((name) => {
    return chatAPI.createChatSession(projectUuid, name).then(res => {
      const session = new ChatSession(res.data.session);
      const newSessions = [session, ...sessions];
      setSessions(newSessions);
      return session;
    });
  }, [projectUuid, sessions]);

  const modifySession = useCallback((sessionId, { name }) => {
    return chatAPI.modifyChatSession(projectUuid, sessionId, { session_name: name }).then(res => {
      let newSessions = sessions.slice(0);
      const sessionIdx = newSessions.findIndex(s => s._id === sessionId);
      let session = newSessions[sessionIdx];
      session.name = name;
      newSessions[sessionIdx] = session;
      setSessions(newSessions);
    });
  }, [projectUuid, sessions]);

  const deleteSession = useCallback((sessionId) => {
    return chatAPI.deleteChatSession(projectUuid, sessionId).then(res => {
      let newSessions = sessions.slice(0);
      const sessionIdx = newSessions.findIndex(s => s._id === sessionId);
      newSessions.splice(sessionIdx, 1);
      if (pageSlugId === sessionId) {
        togglePageSlugId(ASK_PAGE_SLUG_ID.NEW);
      }
      setSessions(newSessions);
    });
  }, [projectUuid, sessions, pageSlugId, togglePageSlugId]);

  const openShowSessions = useCallback(() => {
    setIsShowSessions(true);
  }, []);

  const closeShowSessions = useCallback(() => {
    setIsShowSessions(false);
  }, []);

  const toggleIsShowSessions = useCallback(() => {
    setIsShowSessions(!isShowSessions);
  }, [isShowSessions]);

  const solveProblem = useCallback(({ sessionId, message: problem, resolveType, attachments, model }) => {
    let newSessions = sessions.slice(0);
    const sessionIdx = newSessions.findIndex(session => session._id === sessionId);
    let session = newSessions[sessionIdx];
    session.is_replying = true;
    session.problem = null;
    newSessions[sessionIdx] = session;
    setSessions(newSessions);
    chatAPI.sendChatMessage({
      project_uuid: projectUuid,
      query: problem,
      session_uuid: sessionId,
      resolve_type: resolveType,
      attachments: attachments,
      model: model,
    }).then(res => {
      eventBus.dispatch(EVENT_BUS_TYPE.AI_REPLY, sessionId, { data: res.data, resolveType });
    }).catch(error => {
      eventBus.dispatch(EVENT_BUS_TYPE.AI_REPLY, sessionId, { error });
    });
  }, [projectUuid, workspaceID, sessions]);

  const modifyLocalSession = useCallback((sessionId, update) => {
    let newSessions = sessions.slice(0);
    const sessionIdx = newSessions.findIndex(session => session._id === sessionId);
    if (sessionIdx === -1) return;
    if (Object.keys(update).length === 0) return;
    let session = newSessions[sessionIdx];
    Object.keys(update).forEach(key => {
      session[key] = update[key];
    });
    newSessions[sessionIdx] = session;
    setSessions(newSessions);
  }, [sessions]);

  const loadTeamSessions = useCallback(() => {
    setIsTeamSessionsLoading(true);
    chatAPI.listTeamSharedSessions(projectUuid).then(res => {
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
  }, [projectUuid]);

  const shareSession = useCallback((sessionId) => {
    return chatAPI.shareChatSession(projectUuid, sessionId, true).then(res => {
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
  }, [projectUuid, sessions]);

  const unshareSession = useCallback((sessionId) => {
    return chatAPI.shareChatSession(projectUuid, sessionId, false).then(res => {
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
  }, [projectUuid, sessions]);

  useEffect(() => {
    setLoading(true);
    const isShowSessions = localStorage.getItem(localStorageKeyRef.current) || 'true';
    setIsShowSessions(isShowSessions === 'true' ? true : false);
    chatAPI.listChatSessions(projectUuid).then(res => {
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
  }, []);

  useEffect(() => {
    localStorage.setItem(localStorageKeyRef.current, String(isShowSessions));
  }, [isShowSessions]);

  useEffect(() => {
    const unsubscribeSendChatMessage = eventBus.subscribe(EVENT_BUS_TYPE.ASK_QUESTION, solveProblem);
    return () => {
      unsubscribeSendChatMessage();
    };
  }, [sessions, solveProblem]);

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
      loadTeamSessions,
      shareSession,
      unshareSession,
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
