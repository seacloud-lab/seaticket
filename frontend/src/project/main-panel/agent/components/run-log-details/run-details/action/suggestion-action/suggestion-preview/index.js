import React from 'react';
import classnames from 'classnames';
import TicketPreview from './ticket-preview';
import EmailPreview from './email-preview';
import { parseEmailSuggestionContent } from '@/project/main-panel/agent/utils';

import './index.css';

const SuggestionPreview = ({ type, value, sourceType, sourceId }) => {
  if (type === 'suggest_create_ticket') return (<TicketPreview value={value} />);
  if (type === 'suggest_reply' && sourceType === 'email') {
    const parsed = parseEmailSuggestionContent(value);
    return (<EmailPreview value={parsed} sourceId={sourceId} />);
  }
  return (
    <div className={classnames('suggestion-content-preview-wrapper', type)}>
      <div className="suggestion-content-preview display-mask">
        {value}
      </div>
    </div>
  );
};

export default SuggestionPreview;
