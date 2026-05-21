import React, { useContext, useState, useCallback } from 'react';

const AIChatToolsContext = React.createContext(null);

export const AIChatToolsProvider = ({ children }) => {
  const [attachments, updateAttachments] = useState([]);

  const removeAttachment = useCallback((attachment, index) => {
    let newAttachments = attachments.slice(0);
    newAttachments.splice(index, 1);
    updateAttachments(newAttachments);
  }, [attachments]);

  const clearAttachments = useCallback(() => {
    updateAttachments([]);
  }, []);

  return (
    <AIChatToolsContext.Provider value={{
      attachments, updateAttachments, removeAttachment, clearAttachments,
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
