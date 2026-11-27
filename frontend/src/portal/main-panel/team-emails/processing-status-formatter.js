import React, { useRef } from 'react';
import { Icon, Tooltip } from '@/components';
import { gettext } from '@/constants';

import './processing-status-formatter.css';

const ProcessingStatusFormatter = ({ value }) => {
  const iconRef = useRef(null);

  let symbol;
  let tooltip;
  switch (value) {
    case 'processed':
      symbol = 'check-circle-filled';
      tooltip = gettext('Processed：Your email has been processed by our supporter. If it has been assigned a ticket, you can check the ticket’s status. If it has not been assigned a ticket, the process is complete.');
      break;
    case 'unprocessed':
      symbol = 'clock-filled';
      tooltip = gettext('Processing：Your email is being processed by our supporter.');
      break;
    case 'unavailable':
      symbol = 'question-circle-filled';
      tooltip = gettext('Status temporarily unavailable');
      break;
    default:
      return null;
  }

  return (
    <div className="seaqa-portal-email-processing-status">
      <span ref={iconRef} role="img" aria-label={tooltip}>
        <Icon symbol={symbol} className={value === 'processed' ? 'text-success' : ''} />
      </span>
      <Tooltip placement="right" target={iconRef} trigger="hover">
        {tooltip}
      </Tooltip>
    </div>
  );
};

export default ProcessingStatusFormatter;
