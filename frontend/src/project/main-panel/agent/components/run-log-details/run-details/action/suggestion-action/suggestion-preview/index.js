import React from 'react';
import classnames from 'classnames';
import { CONNECTION_TYPE } from '@/project/main-panel/connections/constants';
import EmailPreview from './email-preview';
import TicketPreview from './ticket-preview';

import './index.css';

const SuggestionPreview = ({ type, sourceType, value, ...props }) => {
  if (type === 'suggest_create_ticket') return (<TicketPreview value={value} />);
  if (type === 'suggest_reply' && sourceType === CONNECTION_TYPE.EMAIL) {
    return (<EmailPreview value={value} { ...props } />);
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
