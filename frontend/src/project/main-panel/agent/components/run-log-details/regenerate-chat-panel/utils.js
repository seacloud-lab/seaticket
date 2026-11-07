export const isValidAssistantMessage = (message) => {
  return message?.role === 'assistant' && Array.isArray(message?.suggestions) && message.suggestions.length > 0;
};

export const getLatestDraftMessage = (messages) => {
  return messages.findLast(isValidAssistantMessage);
};

export const markDraftVersionApplied = (messages, versionId) => {
  if (!versionId) return messages;
  return messages.map(message => message.versionId === versionId ? { ...message, isApplied: true } : message);
};

export const markChatReplyApplied = (histories, versionId) => {
  if (!versionId) return histories;
  return histories.map(history => history._id === versionId ? { ...history, isApplied: true } : history);
};
