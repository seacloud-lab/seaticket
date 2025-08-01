import React from 'react';
import { gettext } from '../../../../constants';
import { Loading } from '../../../../components';

import './index.css';

function Thinking() {
  return (
    <div className="sea-qa-ai-ask-chat sea-qa-ai-ask-chat-thinking">
      <div className="sea-qa-ai-ask-message-content p-0">
        <Loading />
        <span className="sea-qa-tip-default">{gettext('Thinking')}</span>
      </div>
    </div>
  );
}

export default Thinking;
