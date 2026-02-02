import React, { useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import MessageBox from './message-box';
import CommonMessage from './common-message';
import MessageOperations from './message-operations';
import ClearContext from './clear-context';
import { CHAT_MESSAGE_TYPE } from '../constants';

import './index.css';

const ChatHistory = ({ chat, settings, projectUuid, projectName, workspaceID }) => {
  const { _id, message, isUserSpeak, type } = chat;
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

  if (!isUserSpeak && message === '<break_context>') {
    return (<ClearContext />);
  }

  return (
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
