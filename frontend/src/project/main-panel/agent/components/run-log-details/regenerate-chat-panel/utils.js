export const isValidAssistantMessage = (message) => {
  return message?.role === 'assistant' && !message.error && Array.isArray(message?.suggestions);
};

export const hasApplicableChanges = (message) => {
  return Boolean(
    isValidAssistantMessage(message) &&
    !(message.isApplied) &&
    (
      message.suggestions.length > 0 ||
      (Array.isArray(message.removedSuggestionIds) && message.removedSuggestionIds.length > 0)
    )
  );
};

export const getLatestDraftMessage = (messages) => {
  return messages.findLast(isValidAssistantMessage);
};

export const markDraftVersionApplied = (messages, versionId, suggestions) => {
  if (!versionId) return messages;
  return messages.map(message => message.versionId === versionId ? {
    ...message,
    ...(suggestions ? { suggestions } : {}),
    removedSuggestionIds: [],
    isApplied: true,
  } : message);
};

export const markChatReplyApplied = (histories, versionId, suggestions) => {
  if (!versionId) return histories;
  return histories.map(history => history._id === versionId ? {
    ...history,
    ...(suggestions ? { message: { ...history.message, suggestions } } : {}),
    isApplied: true,
  } : history);
};
