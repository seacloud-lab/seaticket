import React, { useCallback } from 'react';
import classnames from 'classnames';
import { CHAT_MESSAGE_TYPE } from '@/project/main-panel/ask/constants';
import PortalCustomizeMarkdownViewer from './portal-customize-markdown-viewer';
import MessageOperations from '@/project/main-panel/ask/chat-history/message-operations';
import ClearContext from '@/project/main-panel/ask/chat-history/clear-context';

const ChatHistory = ({ chat }) => {
  const { message, isUserSpeak, type } = chat;

  const aiReply = (!isUserSpeak && message && typeof message === 'object') ? (message[CHAT_MESSAGE_TYPE.AI_REPLY] || '') : '';
  const getAIReply = useCallback(() => aiReply, [aiReply]);

  if (!message || (typeof message === 'object' && Object.keys(message).length === 0)) return null;

  if (!isUserSpeak && message === '<break_context>') {
    return <ClearContext />;
  }

  if (isUserSpeak) {
    const textMessage = message[CHAT_MESSAGE_TYPE.TEXT] || '';
    return (
      <div className={classnames('sea-qa-ai-ask-chat', 'user-input-chat')}>
        <div className="sea-qa-ai-ask-message-content">
          {textMessage}
        </div>
      </div>
    );
  }

  if (type === CHAT_MESSAGE_TYPE.ERROR) {
    const textMessage = message[CHAT_MESSAGE_TYPE.TEXT] || '';
    return (
      <div className={classnames('sea-qa-ai-ask-chat', 'portal-chat-message', 'error-message')}>
        <div className="sea-qa-ai-ask-message-content">
          {textMessage}
        </div>
      </div>
    );
  }

  return (
    <div className="sea-qa-ai-ask-chat">
      <div className="sea-qa-ai-ask-message-content">
        <PortalCustomizeMarkdownViewer message={message} />
        <MessageOperations getAIReply={getAIReply} />
      </div>
    </div>
  );
};

export default ChatHistory;
