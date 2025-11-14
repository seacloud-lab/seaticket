import React, { useContext, useState, useCallback } from 'react';
import { AI_RESOLVE_TYPE } from '../constants';
import { TicketForAI } from '../../tickets/models';

const ProblemToBeResolvedContext = React.createContext(null);

export const ProblemToBeResolvedProvider = ({ children }) => {
  const [resolveType, setResolveType] = useState(AI_RESOLVE_TYPE.ASK);
  const [ticket, setTicket] = useState(null);
  const [issue, setIssue] = useState(null);

  const updateTicket = useCallback((ticket, resolveType = AI_RESOLVE_TYPE.AGENT) => {
    if (ticket) {
      setTicket(ticket instanceof TicketForAI ? ticket : new TicketForAI(ticket));
      setIssue(null);
    } else {
      setTicket(null);
    }
    setResolveType(resolveType);
  }, []);

  const updateIssue = useCallback((issue, resolveType = AI_RESOLVE_TYPE.AGENT) => {
    setIssue(issue);
    setResolveType(resolveType);
  }, []);

  const clearProblem = useCallback(() => {
    setTicket(null);
    setIssue(null);
  }, []);

  const resetResolveType = useCallback(() => {
    setResolveType(AI_RESOLVE_TYPE.ASK);
  }, []);

  const updateResolveType = useCallback((resolveType) => {
    setResolveType(resolveType);
  }, []);

  return (
    <ProblemToBeResolvedContext.Provider value={{
      ticket, updateTicket,
      issue, updateIssue,
      resolveType, updateResolveType, resetResolveType,
      clearProblem,
    }}>
      {children}
    </ProblemToBeResolvedContext.Provider>
  );
};

export const useProblemToBeResolved = () => {
  const context = useContext(ProblemToBeResolvedContext);
  if (!context) {
    throw new Error('\'ProblemToBeResolvedContext\' is null');
  }
  return context;
};
