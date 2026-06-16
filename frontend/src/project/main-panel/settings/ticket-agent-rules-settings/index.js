import React from 'react';
import { gettext } from '@/constants';
import PromptSettings from '../prompt-settings';

import './index.css';

const TicketAgentRulesSettings = ({ value = '', onChange, className }) => {
  return (
    <PromptSettings
      value={value}
      onChange={onChange}
      className={`${className || ''} ticket-agent-rules-settings`.trim()}
      title={gettext('Ticket Agent rules')}
      tip={gettext('Define natural-language rules for ticket reminders and ticket-closing suggestions. These rules only apply to Ticket Agent.')}
      dialogTitle={gettext('Edit Ticket Agent Rules')}
      placeholder={gettext('Example:\n1) If due soon and substate is Waiting on user, do not send reminder.\n2) If over due and substate is Waiting on user, suggest closing the ticket.')}
      maxLength={4000}
      validationMessage={gettext('Ticket Agent rules cannot contain tag-like content such as <system-reminder>.')}
    />
  );
};

export default TicketAgentRulesSettings;
