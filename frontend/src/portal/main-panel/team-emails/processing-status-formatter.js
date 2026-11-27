import React, { useRef } from 'react';
import { Icon, Tooltip } from '@/components';
import { gettext } from '@/constants';

import './processing-status-formatter.css';

const ProcessingStatusFormatter = ({ value }) => {
  const iconRef = useRef(null);
  if (value !== 'processed' && value !== 'unprocessed') return null;

  const isProcessed = value === 'processed';
  const tooltip = isProcessed
    ? gettext('Processed：Your email has been processed by our supporter. If it has been assigned a ticket, you can check the ticket’s status. If it has not been assigned a ticket, the process is complete.')
    : gettext('Processing：Your email is being processed by our supporter.');

  return (
    <div className="seaqa-portal-email-processing-status">
      <span ref={iconRef} role="img" aria-label={tooltip}>
        <Icon symbol={isProcessed ? 'check-circle-filled' : 'clock-filled'} className={isProcessed ? 'text-success' : ''} />
      </span>
      <Tooltip placement="right" target={iconRef} trigger="hover">
        {tooltip}
      </Tooltip>
    </div>
  );
};

export default ProcessingStatusFormatter;
