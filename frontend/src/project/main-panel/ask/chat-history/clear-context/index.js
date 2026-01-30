import { gettext } from '@/constants';
import React from 'react';

import './index.css';

const ClearContext = () => {
  return (
    <div className="sea-ticket-ai-chat-clear-context">
      <div className="sea-ticket-ai-chat-divider-line"></div>
      <div className="sea-ticket-ai-chat-clear-context-tip">{gettext('Clear context')}</div>
      <div className="sea-ticket-ai-chat-divider-line"></div>
    </div>
  );
};

export default ClearContext;
