import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import MessageBox from './message-box';
import CommonMessage from './common-message';
import { CHAT_MESSAGE_TYPE } from '../constants';

import './index.css';

const ChatHistory = ({ chat, settings, projectUuid, projectName, workspaceID }) => {
  const { _id, message, isUserSpeak, type } = chat;

  const chatId = useMemo(() => _id || '', [_id]);

  const showOperations = useMemo(() => {
    if (isUserSpeak) return false;
    if (type === CHAT_MESSAGE_TYPE.TIP) return false;
    if (chatId === 'typing') return false;
    return true;
  }, [chatId, isUserSpeak, type]);

  if (Object.keys(message).length === 0) return null;

  return (
    <MessageBox isUserSpeak={isUserSpeak}>
      <CommonMessage
        message={message}
        chatId={chatId}
        settings={settings}
        projectUuid={projectUuid}
        projectName={projectName}
        workspaceID={workspaceID}
        showOperations={showOperations}
      />
    </MessageBox>
  );
};

ChatHistory.propTypes = {
  chat: PropTypes.object,
};

export default ChatHistory;
