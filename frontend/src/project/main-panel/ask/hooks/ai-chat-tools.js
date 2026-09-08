import { BAR_TYPE } from '@/project/constants';
import React, { useContext, useState, useCallback } from 'react';
import { ASK_PAGE_SLUG_ID } from '../constants';
import { AttachmentObject } from '../models';

const AIChatToolsContext = React.createContext(null);

export const AIChatToolsProvider = ({ toggleBar, children }) => {
  const [attachments, updateAttachments] = useState([]);

  const removeAttachment = useCallback((attachment, index) => {
    let newAttachments = attachments.slice(0);
    newAttachments.splice(index, 1);
    updateAttachments(newAttachments);
  }, [attachments]);

  const clearAttachments = useCallback(() => {
    updateAttachments([]);
  }, []);

  const handleResolveAttachmentsByAI = useCallback((attachments = []) => {
    if (!Array.isArray(attachments) || attachments.length === 0) return;
    const validAttachments = attachments.map(attachment => new AttachmentObject(attachment));
    updateAttachments(validAttachments);
    toggleBar && toggleBar([BAR_TYPE.CHAT, ASK_PAGE_SLUG_ID.NEW]);
  }, [toggleBar]);

  return (
    <AIChatToolsContext.Provider value={{
      attachments, updateAttachments, removeAttachment, clearAttachments,
      handleResolveAttachmentsByAI,
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
