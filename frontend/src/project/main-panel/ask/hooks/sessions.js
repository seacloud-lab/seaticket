import React, { useContext, useEffect, useState, useCallback, useRef } from 'react';
import { askAPI } from '@/project/api';
import { Utils } from '@/utils/utils';
import { toaster } from '@/components';
import { ChatSession } from '../models';
import { useAskPage } from './page-type';
import { ASK_PAGE_TYPE } from '../constants';

const SessionsContext = React.createContext(null);

export const SessionsProvider = ({ workspaceID, projectUuid, children }) => {
  const [isLoading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [isShowSessions, setIsShowSessions] = useState(true);
  const localStorageKeyRef = useRef(`sea-qa-${projectUuid}-ask-sessions-display`);

  const { togglePageType, pageType } = useAskPage();

  const createSession = useCallback((name) => {
    return askAPI.createChatSession(projectUuid, name).then(res => {
      const session = new ChatSession(res.data.session);
      const newSessions = [session, ...sessions];
      setSessions(newSessions);
      return session;
    });
  }, [projectUuid, sessions]);

  const modifySession = useCallback((sessionId, { name }) => {
    return askAPI.modifyChatSession(projectUuid, sessionId, { session_name: name }).then(res => {
      let newSessions = sessions.slice(0);
      const sessionIdx = newSessions.findIndex(s => s.session_uuid === sessionId);
      let session = newSessions[sessionIdx];
      session.name = name;
      newSessions[sessionIdx] = session;
      setSessions(newSessions);
    });
  }, [projectUuid, sessions]);

  const deleteSession = useCallback((sessionId) => {
    return askAPI.deleteChatSession(projectUuid, sessionId).then(res => {
      let newSessions = sessions.slice(0);
      const sessionIdx = newSessions.findIndex(s => s.session_uuid === sessionId);
      newSessions.splice(sessionIdx, 1);
      if (pageType === sessionId) {
        togglePageType(ASK_PAGE_TYPE.NEW);
      }
      setSessions(newSessions);
    });
  }, [projectUuid, sessions, pageType, togglePageType]);

  const openShowSessions = useCallback(() => {
    setIsShowSessions(true);
  }, []);

  const closeShowSessions = useCallback(() => {
    setIsShowSessions(false);
  }, []);

  const toggleIsShowSessions = useCallback(() => {
    setIsShowSessions(!isShowSessions);
  }, [isShowSessions]);

  useEffect(() => {
    setLoading(true);
    const isShowSessions = localStorage.getItem(localStorageKeyRef.current) || 'true';
    setIsShowSessions(isShowSessions === 'true' ? true : false);
    askAPI.listChatSessions(projectUuid).then(res => {
      let sessions = res.data.sessions;
      if (Array.isArray(sessions) && sessions.length > 0) {
        sessions = sessions.map(s => new ChatSession(s));
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

  return (
    <SessionsContext.Provider value={{
      sessions,
      isLoading,
      isShowSessions,
      createSession,
      modifySession,
      deleteSession,
      openShowSessions,
      closeShowSessions,
      toggleIsShowSessions,
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
