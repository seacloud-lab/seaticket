import React, { useMemo } from 'react';
import { TagsProvider, TicketsProvider, useTickets } from '../../hooks';
import Tags from './tags';
import AllTickets from './all-tickets';
import NewTicket from './new-ticket';
import Ticket from './ticket';
import { TICKET_PAGE_TYPE } from '../../constants';
import { CenteredLoading } from '../../../components';
import TicketTopBar from './ticket-top-bar';
import { server } from '../../../constants';
import LongTextEditorUtilities from '../../../utils/long-text';
import { seaQAAPI } from '../../../api/web-api';

import './index.css';

const {
  projectUuid, projectName,
} = window.app.pageOptions;

const Page = () => {
  const { isLoading, pageType } = useTickets();
  const editorAPI = useMemo(() => new LongTextEditorUtilities({ server, projectUuid, api: seaQAAPI }), []);
  if (isLoading) return (<CenteredLoading />);
  if (pageType === TICKET_PAGE_TYPE.ALL) return (<AllTickets />);
  const tagsCount = pageType === TICKET_PAGE_TYPE.TAGS ? 1 : 0;
  let ChildrenComponent = Ticket;
  if (pageType === TICKET_PAGE_TYPE.TAGS) ChildrenComponent = Tags;
  if (pageType === TICKET_PAGE_TYPE.NEW) ChildrenComponent = NewTicket;
  return (
    <TagsProvider projectUuid={projectUuid} tagsCount={tagsCount}>
      <ChildrenComponent editorAPI={editorAPI} />
    </TagsProvider>
  );
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
