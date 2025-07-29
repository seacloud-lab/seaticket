import React from 'react';
import PropTypes from 'prop-types';
import MessageBox from './message-box';
import CommonMessage from './common-message';

import './index.css';

const ChatHistory = ({ chat }) => {
  const { messages, isUserSpeak, time } = chat;
  if (!Array.isArray(messages) && messages.length === 0) return null;
  return (
    <MessageBox isUserSpeak={isUserSpeak} time={time}>
      <CommonMessage messages={messages} />
    </MessageBox>
  );
};

ChatHistory.propTypes = {
  chat: PropTypes.object,
};

export default ChatHistory;
