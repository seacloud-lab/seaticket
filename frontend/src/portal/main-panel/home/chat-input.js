import React, { useState } from 'react';
import { gettext } from '@/constants';
import './chat-input.css';

const PortalHomeChatInput = ({ descriptionText, onHomeChatSend }) => {
  const [value, setValue] = useState('');

  const handleSend = () => {
    const nextValue = value.trim();
    if (!nextValue) return;

    onHomeChatSend && onHomeChatSend(nextValue);
    setValue('');
  };

  return (
    <div className="portal-home-chat-input" aria-label={gettext('Chat with AI')}>
      <input
        className="portal-home-chat-textarea"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={descriptionText}
        aria-label={gettext('Chat with AI')}
      />
      <button type="button" className="portal-home-chat-send-btn" aria-label={gettext('Send')} onClick={handleSend}>
        <span>↑</span>
      </button>
    </div>
  );
};

export default PortalHomeChatInput;
