import React from 'react';
import { TicketsProvider, useTickets } from '../../hooks';
import AllTickets from './all-tickets';
import NewTicket from './new-ticket';
import Ticket from './ticket';
import { TICKET_PAGE_TYPE } from '../../constants';
import { CenteredLoading } from '../../../components';
import TicketTopBar from './ticket-top-bar';

import './index.css';

const {
  projectUuid, projectName,
} = window.app.pageOptions;

const Page = () => {
  const { isLoading, pageType } = useTickets();
  if (isLoading) return (<CenteredLoading />);
  if (pageType === TICKET_PAGE_TYPE.ALL) return (<AllTickets />);
  if (pageType === TICKET_PAGE_TYPE.NEW) return (<NewTicket />);
  return (<Ticket />);
};

const Index = ({ title }) => {
  return (
    <TicketsProvider projectUuid={projectUuid} projectName={projectName}>
      <TicketTopBar title={title} />
      <Page />
    </TicketsProvider>
  );
};

export default Index;
