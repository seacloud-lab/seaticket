import React from 'react';
import { gettext } from '../../../constants';

function Thinking() {
  return (
    <div className="sea-qa-ai-ask-chat sea-qa-ai-ask-chat-replay-statue">
      <div className="sea-qa-ai-ask-chat-main">
        <div className="sea-qa-ai-ask-message-content mt-0">
          {gettext('Thinking')}
        </div>
      </div>
    </div>
  );
}

export default Thinking;
