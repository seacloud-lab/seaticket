import React, { useMemo } from 'react';
import { TicketsPageProvider, useTicketsPage } from './hooks';
import Types from './view/types';
import TypeTickets from './view/type-tickets';
import Substates from './view/substates';
import SubstateTickets from './view/substate-tickets';
import AllTickets from './view/all-tickets';
import MyTickets from './view/my-tickets';
import TrashTickets from './view/trash-tickets';
import NewTicket from './view/new-ticket';
import Ticket from './view/ticket';
import { TICKET_CHILDREN_PAGE_SLUG_ID, TICKET_PAGE_SLUG_ID } from './constants';
import TicketTopBar from './components/ticket-top-bar';
import { ticketsAPI } from '../../api';
import LongTextEditorUtilities from '@/utils/long-text';
import { server } from '@/constants';
import { BAR_TYPE } from '@/project/constants';

import './index.css';

const {
  projectUuid, projectName, workspaceID, permission, isProjectAdmin
} = window.app.pageOptions;

const Page = ({ toggleBar, type }) => {
  const longtextAPI = useMemo(() => new LongTextEditorUtilities({ server, api: {
    uploadFile: (...params) => ticketsAPI.uploadFile(projectUuid, ...params)
  } }), []);
  const props = useMemo(() => ({
    projectUuid, projectName, workspaceID, permission, isAdmin: isProjectAdmin, toggleBar
  }), [toggleBar]);

  const { isLoading, pageSlugId, childrenPageSlugId, togglePageSlugId, onRefresh } = useTicketsPage();
  if (isLoading) return null;
  if (pageSlugId === TICKET_PAGE_SLUG_ID.TYPES) {
    if (childrenPageSlugId === TICKET_CHILDREN_PAGE_SLUG_ID.ALL) return (<Types projectUuid={projectUuid} permission={permission} />);
    return (<TypeTickets { ...props } typeID={childrenPageSlugId}/>);
  }
  if (pageSlugId === TICKET_PAGE_SLUG_ID.SUBSTATES) {
    if (childrenPageSlugId === TICKET_CHILDREN_PAGE_SLUG_ID.ALL) return (<Substates projectUuid={projectUuid} permission={permission} />);
    return (<SubstateTickets { ...props } substateID={childrenPageSlugId}/>);
  }
  if (pageSlugId === TICKET_PAGE_SLUG_ID.ALL) {
    if (type === BAR_TYPE.MY_TICKET) return (<MyTickets { ...props } />);
    if (type === BAR_TYPE.TRASH) return (<TrashTickets { ...props } />);
    return (<AllTickets { ...props } />);
  }
  if (pageSlugId === TICKET_PAGE_SLUG_ID.NEW) {
    return (<NewTicket projectUuid={projectUuid} editorAPI={longtextAPI} />);
  }
  return (<Ticket { ...props } ticketID={pageSlugId} editorAPI={longtextAPI} onRefresh={onRefresh} togglePageSlugId={togglePageSlugId} />);
};

const Tickets = ({ title, toggleBar, type }) => {
  return (
    <TicketsPageProvider workspaceID={workspaceID} projectName={projectName} type={type}>
      <TicketTopBar title={title} type={type} permission={permission} />
      <Page toggleBar={toggleBar} type={type} />
    </TicketsPageProvider>
  );
};

export default Tickets;
