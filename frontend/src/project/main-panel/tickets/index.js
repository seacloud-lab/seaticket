import React, { useMemo } from 'react';
import { TicketsPageProvider, useTicketsPage, DataCacheProvider, MetadataProvider } from './hooks';
import Tags from './view/tags';
import Types from './view/types';
import TagTickets from './view/tag-tickets';
import TypeTickets from './view/type-tickets';
import Substates from './view/substates';
import SubstateTickets from './view/substate-tickets';
import AllTickets from './view/all-tickets';
import NewTicket from './view/new-ticket';
import Ticket from './view/ticket';
import { TICKET_CHILDREN_PAGE_SLUG_ID, TICKET_PAGE_SLUG_ID } from './constants';
import TicketTopBar from './components/ticket-top-bar';
import { CollaboratorsProvider } from '@/sea-metadata';
import { ticketsAPI } from '../../api';
import LongTextEditorUtilities from '@/utils/long-text';
import { server } from '@/constants';

import './index.css';

const {
  projectUuid, projectName, workspaceID, permission, isProjectAdmin
} = window.app.pageOptions;

const Page = ({ toggleBar, isMyTicket }) => {
  const longtextAPI = useMemo(() => new LongTextEditorUtilities({ server, api: {
    uploadFile: (...params) => ticketsAPI.uploadFile(projectUuid, ...params)
  } }), []);
  const props = useMemo(() => ({
    projectUuid, projectName, workspaceID, permission, isAdmin: isProjectAdmin, toggleBar
  }), [toggleBar]);

  const { isLoading, pageSlugId, childrenPageSlugId } = useTicketsPage();
  if (isLoading) return null;
  if (pageSlugId === TICKET_PAGE_SLUG_ID.TAGS) {
    if (childrenPageSlugId === TICKET_CHILDREN_PAGE_SLUG_ID.ALL) return (<Tags { ...props } />);
    return (<TagTickets { ...props } tagID={childrenPageSlugId} />);
  }
  if (pageSlugId === TICKET_PAGE_SLUG_ID.TYPES) {
    if (childrenPageSlugId === TICKET_CHILDREN_PAGE_SLUG_ID.ALL) return (<Types projectUuid={projectUuid} permission={permission} />);
    return (<TypeTickets { ...props } typeID={childrenPageSlugId}/>);
  }
  if (pageSlugId === TICKET_PAGE_SLUG_ID.SUBSTATES) {
    if (childrenPageSlugId === TICKET_CHILDREN_PAGE_SLUG_ID.ALL) return (<Substates projectUuid={projectUuid} permission={permission} />);
    return (<SubstateTickets { ...props } substateID={childrenPageSlugId}/>);
  }
  if (pageSlugId === TICKET_PAGE_SLUG_ID.ALL) {
    return (<AllTickets { ...props } isMyTicket={isMyTicket} />);
  }
  if (pageSlugId === TICKET_PAGE_SLUG_ID.NEW) {
    return (<NewTicket projectUuid={projectUuid} editorAPI={longtextAPI} />);
  }
  return (<Ticket { ...props } ticketID={pageSlugId} editorAPI={longtextAPI} />);
};

const Tickets = ({ title, toggleBar, isMyTicket }) => {
  return (
    <DataCacheProvider>
      <CollaboratorsProvider
        listUserInfo={(...params) => ticketsAPI.listUserInfo(...params)}
        getCollaborators={() => ticketsAPI.listProjectRelatedUsers(projectUuid)}
      >
        <MetadataProvider projectUuid={projectUuid}>
          <TicketsPageProvider workspaceID={workspaceID} projectName={projectName}>
            <TicketTopBar title={title} isMyTicket={isMyTicket} />
            <Page toggleBar={toggleBar} isMyTicket={isMyTicket} />
          </TicketsPageProvider>
        </MetadataProvider>
      </CollaboratorsProvider>
    </DataCacheProvider>
  );
};

export default Tickets;
