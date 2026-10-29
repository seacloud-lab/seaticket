import React, { useMemo } from 'react';
import { generatorTicketURL } from '@/project/main-panel/tickets/utils';
import { getRelatedTicketId, getSuggestionTitle } from '../../../utils';

import './index.css';

const { workspaceID, projectName } = window.app?.pageOptions || {};

const SuggestionTitle = ({
  action,
  className,
  fallback = '',
  as: Component = 'span',
}) => {
  const title = useMemo(
    () => getSuggestionTitle(action) || fallback,
    [action, fallback]
  );
  const ticketLink = useMemo(() => {
    const ticketId = getRelatedTicketId(action);
    if (!ticketId || !title) return null;
    const ticketRef = `#${ticketId}`;
    const ticketIndex = title.lastIndexOf(ticketRef);
    if (ticketIndex === -1) return null;
    return {
      before: title.slice(0, ticketIndex),
      ticketRef,
      after: title.slice(ticketIndex + ticketRef.length),
      href: generatorTicketURL({
        ticket: { _id: ticketId },
        workspaceID,
        projectName,
      }),
    };
  }, [action, title]);

  if (!title) return null;

  if (!ticketLink) {
    return <Component className={className} title={title}>{title}</Component>;
  }

  return (
    <Component className={className} title={title}>
      {ticketLink.before}
      <a
        className="seaqa-agent-suggestion-title-ticket-link"
        href={ticketLink.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => event.stopPropagation()}
      >
        {ticketLink.ticketRef}
      </a>
      {ticketLink.after}
    </Component>
  );
};

export default SuggestionTitle;
