import React from 'react';
import { useLinkTicketWorkflow } from '@/project/components/link-ticket-provider';
import { useRelatedIssuesWorkflow } from '@/project/components/related-issues-provider';
import { useTicketCreationWorkflow } from '@/project/components/ticket-creation-provider';
import { LinkTicketContext } from '@/project/hooks/link-ticket';
import { RelatedIssuesContext } from '@/project/hooks/related-issues';
import { ResourceDialogContext } from '@/project/hooks/resource-dialog';
import { TicketCreationContext } from '@/project/hooks/ticket-creation';

const ResourceDialogsProvider = ({ children, isSupportPortal = false, ...props }) => {
  const linkTicket = useLinkTicketWorkflow(props);
  const relatedIssues = useRelatedIssuesWorkflow(props);
  const ticketCreation = useTicketCreationWorkflow(props);

  return (
    <ResourceDialogContext.Provider value={{ isSupportPortal, isReadonly: isSupportPortal }}>
      <LinkTicketContext.Provider value={linkTicket.value}>
        <RelatedIssuesContext.Provider value={relatedIssues.value}>
          <TicketCreationContext.Provider value={ticketCreation.value}>
            {children}
            {linkTicket.dialogs}
            {relatedIssues.dialogs}
            {ticketCreation.dialogs}
          </TicketCreationContext.Provider>
        </RelatedIssuesContext.Provider>
      </LinkTicketContext.Provider>
    </ResourceDialogContext.Provider>
  );
};

export default ResourceDialogsProvider;
