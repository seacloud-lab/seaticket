import React from 'react';
import { gettext } from '@/constants';
import { Loading } from '@/components';

import './index.css';

function Thinking() {
  return (
    <div className="seaqa-ai-ask-chat seaqa-ai-ask-chat-thinking">
      <div className="seaqa-ai-ask-message-content p-0">
        <Loading />
        <span className="seaqa-tip-default">{gettext('Thinking...')}</span>
      </div>
    </div>
  );
}

export default Thinking;
