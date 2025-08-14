import React, { useCallback } from 'react';
import TopBar from '../../../top-bar';
import { useTicketsPage } from '../../hooks';
import { TICKET_PAGE_TYPE } from '../../../../constants';
import { IconButton } from '../../../../../components';
import { gettext } from '../../../../../constants';

import './index.css';

const TicketTopBar = ({ title }) => {
  const { pageType, pageTitle, togglePageType } = useTicketsPage();

  const renderChildren = useCallback(() => {
    if (pageType === TICKET_PAGE_TYPE.ALL) {
      return (
        <div className="w-100 text-truncate">{title}</div>
      );
    }

    const toggleBtn = (
      <IconButton icon="down" className="rotate-icon-90 sea-qa-project-toggle-tickets-btn" onClick={() => togglePageType(TICKET_PAGE_TYPE.ALL)} />
    );
    if (pageType === TICKET_PAGE_TYPE.TAGS) {
      return (
        <>
          {toggleBtn}
          <span className="text-truncate" title={gettext('Tags')}>{gettext('Tags')}</span>
        </>
      );
    }
    if (pageType === TICKET_PAGE_TYPE.NEW) {
      return (
        <>
          {toggleBtn}
          <span className="text-truncate" title={gettext('New ticket')}>{gettext('New ticket')}</span>
        </>
      );
    }
    return (
      <>
        {toggleBtn}
        <span className="text-truncate" title={pageTitle}>{pageTitle}</span>
      </>
    );
  }, [pageType]);

  return (
    <TopBar>
      {renderChildren()}
    </TopBar>
  );
};

export default TicketTopBar;
