import React, { useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import MessageBox from './message-box';
import CommonMessage from './common-message';
import MessageOperations from './message-operations';

import './index.css';

const ChatHistory = ({ chat }) => {
  const { messages, isUserSpeak } = chat;
  const ref = useRef(null);

  const getMessageHTML = useCallback(() => {
    if (!ref?.current) return '';
    return ref.current.getHTML();
  }, []);

  if (!Array.isArray(messages) && messages.length === 0) return null;
  return (
    <MessageBox isUserSpeak={isUserSpeak}>
      <CommonMessage messages={messages} ref={ref} />
      {!isUserSpeak && (<MessageOperations messages={messages} getMessageHTML={getMessageHTML} />)}
    </MessageBox>
  );
};

ChatHistory.propTypes = {
  chat: PropTypes.object,
};

export default ChatHistory;
