import React, { useContext, useState, useCallback } from 'react';
import { AI_RESOLVE_TYPE } from '../constants';
import { TicketForAI } from '../../tickets/models';
import { IssueForAI } from '../../connections/models';

const AIChatToolsContext = React.createContext(null);

export const AIChatToolsProvider = ({ children }) => {
  const [resolveType, setResolveType] = useState(AI_RESOLVE_TYPE.ASK);
  const [tickets, setTickets] = useState([]);
  const [issues, setIssues] = useState([]);

  const updateTickets = useCallback((tickets = [], resolveType) => {
    if (Array.isArray(tickets) && tickets.length > 0) {
      const newTickets = tickets.map(ticket => ticket instanceof TicketForAI ? ticket : new TicketForAI(ticket));
      setTickets(newTickets);
      setIssues([]);
    } else {
      setTickets([]);
    }
    if (resolveType) {
      setResolveType(resolveType);
    }
  }, []);

  const removeTicket = useCallback((ticket) => {
    const newTickets = tickets.filter(v => v._id !== ticket._id);
    setTickets(newTickets);
  }, [tickets]);

  const updateIssues = useCallback((issues = [], resolveType) => {
    if (Array.isArray(issues) && issues.length > 0) {
      const newIssues = issues.map(issue => issue instanceof IssueForAI ? issue : new IssueForAI(issue));
      setIssues(newIssues);
      setTickets([]);
    } else {
      setIssues([]);
    }
    if (resolveType) {
      setResolveType(resolveType);
    }
  }, []);

  const removeIssue = useCallback((issue) => {
    const newIssues = issues.filter(v => v._id !== issue._id);
    setIssues(newIssues);
  }, [issues]);

  const clearProblems = useCallback(() => {
    setTickets([]);
    setIssues([]);
  }, []);

  const resetResolveType = useCallback(() => {
    setResolveType(AI_RESOLVE_TYPE.ASK);
  }, []);

  const updateResolveType = useCallback((resolveType) => {
    setResolveType(resolveType);
  }, []);

  return (
    <AIChatToolsContext.Provider value={{
      tickets, updateTickets, removeTicket,
      issues, updateIssues, removeIssue,
      resolveType, updateResolveType, resetResolveType,
      clearProblems,
    }}>
      {children}
    </AIChatToolsContext.Provider>
  );
};

export const useAIChatTools = () => {
  const context = useContext(AIChatToolsContext);
  if (!context) {
    throw new Error('\'ChatToolsContext\' is null');
  }
  return context;
};
