import React, { useEffect, useRef, useState } from 'react';
import classnames from 'classnames';
import { Ticket as TicketModel } from '../../models';
import { Issus as IssueModel } from '@/project/main-panel/portal-issues/models';
import { Utils } from '@/utils/utils';
import { CenteredError, CenteredLoading } from '@/components';
import { gettext, lang } from '@/constants';
import { useTags, useMetadata as useTicketMetadata, usePortalIssuesMetadata } from '@/project/hooks';
import {
  CollaboratorsSettings, TypeSettings, PrioritySettings,
  StateSettings, SubStateSettings, DueDateSettings, LinkSettings
} from '../ticket-settings';
import Comment from '../comment';
import TagsSettings from '@/project/main-panel/tags/tags-settings';
import { ticketsAPI } from '@/project/api';
import { TICKET_TYPE } from '../../constants';

import './index.css';

const TicketInDialog = ({
  ticketID,
  projectUuid,
  updateTicket,
  ticketType = TICKET_TYPE,
  getTicket = (projectUuid, ticketID) => ticketsAPI.getProjectTicket(projectUuid, ticketID),
}) => {
  const [isLoading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [linkedRecords, setLinkedRecords] = useState({});

  const { tagsData } = useTags();

  const ticketRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    setTicket(null);
    getTicket(projectUuid, ticketID).then(res => {
      const ticket = ticketType === TICKET_TYPE ? new TicketModel(res.data.ticket) : new IssueModel(res.data.issue);
      setTicket(ticket);
      updateTicket(ticket);
      const linkedRecords = ticketType === TICKET_TYPE ? res.data?.linked_records_info : { [ticket.linked_ticket || '']: res.data?.linked_ticket_title };
      setLinkedRecords(linkedRecords || {});
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      setErrorMessage(errorMessage);
    }).finally(() => {
      setLoading(false);
    });
  }, [projectUuid, ticketID, ticketType]);

  useEffect(() => {
    if (isLoading || !ticket) return;
    const ticketDom = ticketRef.current;
    const handleResize = () => {
      if (!ticketDom) return;
      setContainerWidth(ticketDom.offsetWidth);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    ticketDom && resizeObserver.observe(ticketDom);

    return () => {
      ticketDom && resizeObserver.unobserve(ticketDom);
    };
  }, [isLoading, ticket]);

  if (isLoading) return (<CenteredLoading />);
  if (errorMessage) return (<CenteredError>{errorMessage}</CenteredError>);
  if (!ticket) return (<CenteredError>{ticketType === TICKET_TYPE ? gettext('Ticket not found') : gettext('Issue not found')}</CenteredError>);

  const isSmallScreen = containerWidth < 780;

  const { state, comments = [], assignees = [], type, tags, priority, participants = [], substate, due_date } = ticket;
  const useMetadata = ticketType === TICKET_TYPE ? useTicketMetadata : usePortalIssuesMetadata;
  return (
    <div className={classnames('sea-qa-project-ticket sea-qa-project-ticket-in-dialog', { 'small': isSmallScreen })} ref={ticketRef}>
      <div className="sea-qa-project-ticket-content-wrapper">
        <div className="sea-qa-project-ticket-comment-container-wrapper">
          <Comment
            isSmallScreen={isSmallScreen}
            comment={ticket}
            isShowStatus={true}
            readonly={true}
            lang={lang}
          />
          {comments.map(comment => {
            return (
              <Comment
                key={comment.id}
                isSmallScreen={isSmallScreen}
                readonly={true}
                comment={comment}
                projectUuid={projectUuid}
              />
            );
          })}
        </div>
        <div className="sea-qa-project-ticket-other-settings">
          <PrioritySettings isReadonly={true} value={priority} />
          <CollaboratorsSettings isReadonly={true} title={gettext('Assignees')} value={assignees} />
          <TagsSettings
            id="tags-editor-popover"
            isReadonly={true}
            value={tags}
            tagsData={tagsData}
          />
          <StateSettings isReadonly={true} state={state} substate={substate} useMetadataContext={useMetadata} />
          <SubStateSettings isReadonly={true} state={state} substate={substate} useMetadataContext={useMetadata} />
          <TypeSettings isReadonly={true} value={type} useMetadataContext={useMetadata} />
          <DueDateSettings isReadonly={true} value={due_date} onChange={() => {}} />
          <CollaboratorsSettings isReadonly={true} title={gettext('Participants')} value={participants} />
          <LinkSettings
            value={ticketType === TICKET_TYPE ? ticket.linked_connection_records : [ticket.linked_ticket]}
            linkedRecords={linkedRecords}
          />
        </div>
      </div>
    </div>
  );

};

export default TicketInDialog;
