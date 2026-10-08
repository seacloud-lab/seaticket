import React, { useRef, useState } from 'react';
import { gettext } from '@/constants';
import './chat-input.css';

const PortalHomeChatInput = ({ description_text, onHomeChatSend }) => {
  const [value, setValue] = useState('');
  const isComposing = useRef(false);

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
        onCompositionStart={() => { isComposing.current = true; }}
        onCompositionEnd={() => { isComposing.current = false; }}
        onKeyDown={(e) => {
          if (isComposing.current) return;
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder={description_text}
        aria-label={gettext('Chat with AI')}
      />
      <button type="button" className="portal-home-chat-send-btn" aria-label={gettext('Send')} onClick={handleSend}>
        <span>↑</span>
      </button>
    </div>
  );
};

export default PortalHomeChatInput;
