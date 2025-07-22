import React, { useCallback } from 'react';
import TopBar from '../../top-bar';
import { useTickets } from '../../../hooks';
import { TICKET_PAGE_TYPE } from '../../../constants';
import { IconButton } from '../../../../components';
import { gettext } from '../../../../constants';

import './index.css';

const TicketTopBar = ({ title }) => {
  const { metadata, pageType, togglePageType } = useTickets();

  const renderChildren = useCallback(() => {
    if (pageType === TICKET_PAGE_TYPE.ALL) return (<div className="w-100 text-truncate">{title}</div>);
    if (pageType === TICKET_PAGE_TYPE.NEW) {
      return (
        <>
          <IconButton icon="down" className="rotate-icon-90 sea-qa-project-toggle-tickets-btn" onClick={() => togglePageType(TICKET_PAGE_TYPE.ALL)} />
          <span className="text-truncate" title={gettext('New ticket')}>{gettext('New ticket')}</span>
        </>
      );
    }
    const ticketID = metadata.rows[0];
    const ticket = metadata.id_row_map[ticketID];
    return (
      <>
        <IconButton icon="down" className="rotate-icon-90 sea-qa-project-toggle-tickets-btn" onClick={() => togglePageType(TICKET_PAGE_TYPE.ALL)} />
        <span className="text-truncate" title={ticket?.title}>{ticket?.title}</span>
      </>
    );
  }, [metadata, pageType]);

  return (
    <TopBar>
      {renderChildren()}
    </TopBar>
  );
};

export default TicketTopBar;
