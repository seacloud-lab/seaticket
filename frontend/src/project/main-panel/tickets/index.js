import React, { useMemo } from 'react';
import { TagsProvider, TicketsPageProvider, useTicketsPage } from './hooks';
import Tags from './view/tags';
import TagTickets from './view/tag-tickets';
import AllTickets from './view/all-tickets';
import NewTicket from './view/new-ticket';
import Ticket from './view/ticket';
import { TICKET_CHILDREN_PAGE_TYPE, TICKET_PAGE_TYPE } from '../../constants';
import TicketTopBar from './components/ticket-top-bar';
import { CollaboratorsProvider } from '@/sea-metadata';
import { ticketsAPI } from '../../api';
import LongTextEditorUtilities from '@/utils/long-text';
import { server } from '@/constants';

import './index.css';

const {
  projectUuid, projectName, workspaceID, permission
} = window.app.pageOptions;

const Page = () => {
  const longtextAPI = useMemo(() => new LongTextEditorUtilities({ server, api: {
    uploadFile: (...params) => ticketsAPI.uploadFile(projectUuid, ...params)
  } }), []);

  const { isLoading, pageType, childrenPageType } = useTicketsPage();
  if (isLoading) return null;
  if (pageType === TICKET_PAGE_TYPE.TAGS) {
    if (childrenPageType === TICKET_CHILDREN_PAGE_TYPE.ALL) return (<Tags projectUuid={projectUuid} permission={permission} />);
    return (<TagTickets projectUuid={projectUuid} workspaceID={workspaceID} projectName={projectName} permission={permission} />);
  }
  if (pageType === TICKET_PAGE_TYPE.ALL) return (<AllTickets projectUuid={projectUuid} workspaceID={workspaceID} projectName={projectName} permission={permission} />);
  if (pageType === TICKET_PAGE_TYPE.NEW) return (<NewTicket projectUuid={projectUuid} editorAPI={longtextAPI} />);
  return (<Ticket projectUuid={projectUuid} ticketID={pageType} editorAPI={longtextAPI} permission={permission} />);
};

const Index = ({ title }) => {
  return (
    <CollaboratorsProvider
      listUserInfo={(...params) => ticketsAPI.listUserInfo(...params)}
      getCollaborators={() => ticketsAPI.listProjectRelatedUsers(projectUuid)}
    >
      <TagsProvider projectUuid={projectUuid}>
        <TicketsPageProvider workspaceID={workspaceID} projectName={projectName}>
          <TicketTopBar title={title} />
          <Page />
        </TicketsPageProvider>
      </TagsProvider>
    </CollaboratorsProvider>
  );
};

export default Index;
