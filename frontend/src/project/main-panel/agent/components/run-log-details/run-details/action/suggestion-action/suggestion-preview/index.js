import React from 'react';
import classnames from 'classnames';
import TicketPreview from './ticket-preview';
import EmailPreview from './email-preview';

import './index.css';

const SuggestionPreview = ({ type, sourceType, value, defaultReplyTo }) => {
  if (type === 'suggest_create_ticket') return (<TicketPreview value={value} />);
  if (type === 'suggest_reply' && sourceType === 'email') {
    return (<EmailPreview value={value} defaultReplyTo={defaultReplyTo} />);
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
