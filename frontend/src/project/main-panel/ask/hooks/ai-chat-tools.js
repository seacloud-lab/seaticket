import React, { useContext, useState, useCallback } from 'react';
import { AI_RESOLVE_TYPE } from '../constants';

const AIChatToolsContext = React.createContext(null);

export const AIChatToolsProvider = ({ children }) => {
  const [resolveType, setResolveType] = useState(AI_RESOLVE_TYPE.ASK);
  const [attachments, updateAttachments] = useState([]);
  const [clearContext, setClearContext] = useState(false);

  const removeAttachment = useCallback((attachment, index) => {
    let newAttachments = attachments.slice(0);
    newAttachments.splice(index, 1);
    updateAttachments(newAttachments);
  }, [attachments]);

  const clearAttachments = useCallback(() => {
    updateAttachments([]);
  }, []);

  const resetResolveType = useCallback(() => {
    setResolveType(AI_RESOLVE_TYPE.ASK);
  }, []);

  const updateResolveType = useCallback((resolveType) => {
    setResolveType(resolveType);
  }, []);

  const updateClearContext = useCallback((clearContext) => {
    setClearContext(clearContext);
  }, []);

  const resetClearContext = useCallback(() => {
    setClearContext(false);
  }, []);

  return (
    <AIChatToolsContext.Provider value={{
      attachments, updateAttachments, removeAttachment, clearAttachments,
      resolveType, updateResolveType, resetResolveType,
      clearContext, updateClearContext, resetClearContext
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
