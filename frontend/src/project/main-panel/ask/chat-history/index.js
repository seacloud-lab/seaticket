import React, { useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import MessageBox from './message-box';
import MessageDivider from './message-drivider';
import CommonMessage from './common-message';
import MessageOperations from './message-operations';
import getOperationMessage from './chat-operations';
import { CHAT_MESSAGE_TYPE } from '../constants';

import './index.css';

const ChatHistory = ({ chat, settings, projectUuid, projectName, workspaceID }) => {
  const { _id, message, isUserSpeak, isOperation, type } = chat;
  const ref = useRef(null);

  const getMessageHTML = useCallback(() => {
    if (!ref?.current) return '';
    return ref.current.getHTML();
  }, []);

  const getAIReply = useCallback(() => {
    if (!ref?.current) return '';
    return ref.current.getAIReply();
  }, []);

  if (Object.keys(message).length === 0) return null;
  return isOperation ? (
    <MessageDivider text={getOperationMessage(message)} />
  ) : (
    <MessageBox isUserSpeak={isUserSpeak}>
      <CommonMessage
        message={message}
        chatId={_id || ''}
        settings={settings}
        projectUuid={projectUuid}
        projectName={projectName}
        workspaceID={workspaceID}
        ref={ref}
      />
      {!isUserSpeak && (type !== CHAT_MESSAGE_TYPE.TIP) && (<MessageOperations getAIReply={getAIReply} getMessageHTML={getMessageHTML} />)}
    </MessageBox>
  );
};

ChatHistory.propTypes = {
  chat: PropTypes.object,
};

export default ChatHistory;
