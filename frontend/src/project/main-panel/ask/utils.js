import { ChatMessage } from './models';
import { CHAT_MESSAGE_TYPE } from './constants';

export const initMessages = (messages) => {
  return Array.isArray(messages) ? messages.map(item => {
    if (item.role === 'user') {
      let attachments = item?.attachments || [];
      return new ChatMessage({
        _id: item.id,
        message: {
          [CHAT_MESSAGE_TYPE.TEXT]: item.content,
          [CHAT_MESSAGE_TYPE.ATTACHMENTS]: attachments,
        },
        isUserSpeak: true,
      });
    } else if (item.role === 'chat_manager') {
      return new ChatMessage({
        _id: item.id,
        message: item.content,
      });
    }

    let msgContent;
    try {
      msgContent = {
        ai_reply: item.content,
        sources: Array.isArray(item.sources) ? item.sources : [],
        thought_process: item.thought_process
      };
    } catch (e) {
      console.error(e);
      msgContent = { ai_reply: item.content, sources: [] };
    }
    let newChatData = {
      [CHAT_MESSAGE_TYPE.AI_REPLY]: msgContent.ai_reply,
      [CHAT_MESSAGE_TYPE.SOURCES]: msgContent.sources,
      [CHAT_MESSAGE_TYPE.THOUGHT_PROCESS]: msgContent.thought_process,
    };
    return new ChatMessage({
      _id: item.id,
      message: newChatData,
      type: CHAT_MESSAGE_TYPE.GROUP
    });
  }) : [];
};
