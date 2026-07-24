import React from 'react';
import classnames from 'classnames';
import TicketPreview from './ticket-preview';

import './index.css';

const SuggestionPreview = ({ type, value, relatedUrl }) => {
  if (type === 'suggest_create_ticket') return (<TicketPreview value={value} relatedUrl={relatedUrl} />);
  return (
    <div className={classnames('suggestion-content-preview-wrapper', type)}>
      <div className="suggestion-content-preview">
        {value}
      </div>
    </div>
  );
};

export default SuggestionPreview;
