import React, { useState } from 'react';
import classnames from 'classnames';
import { CustomizeLabel } from '@/components';
import { gettext } from '@/constants';
import { ResourceDetailsDialog } from '@/project/components';
import { TICKET_TYPE } from '@/project/main-panel/tickets/constants';

import './index.css';

const LinkedTicket = ({
  projectUuid,
  ticketID,
  title,
  className,
  getTicket,
}) => {
  const [isShowTicketInDialog, setIsShowTicketInDialog] = useState(false);
  const isValid = ticketID && title;

  return (
    <div className={classnames('sea-ticket-settings-item', className)}>
      <CustomizeLabel icon="link">{gettext('Linked ticket')}</CustomizeLabel>
      <div className={classnames('sea-ticket-link-settings-formatter', { 'valid': isValid })}>
        {isValid ? (
          <div className="link-item">
            <span className="link-item-name" title={title} onClick={() => setIsShowTicketInDialog(true)}>{title}</span>
          </div>
        ) : (
          <div className="tip-default">{gettext('No linked ticket')}</div>
        )}
      </div>
      {isShowTicketInDialog && (
        <ResourceDetailsDialog
          projectUuid={projectUuid}
          resource={{ type: TICKET_TYPE, title, _id: ticketID }}
          onToggle={() => setIsShowTicketInDialog(false)}
          getTicket={getTicket}
        />
      )}
    </div>
  );
};

export default LinkedTicket;
