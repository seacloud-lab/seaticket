import React, { useEffect, useRef, useState } from 'react';
import classnames from 'classnames';
import { ticketsAPI } from '@/project/api';
import { Ticket as TicketModel } from '../../models';
import { Utils } from '@/utils/utils';
import { CenteredError, CenteredLoading } from '@/components';
import { gettext, lang } from '@/constants';
import { useTags } from '@/project/hooks';
import {
  CollaboratorsSettings, TypeSettings, RateSettings,
  StateSettings, SubStateSettings,
} from '../ticket-settings';
import Comment from '../comment';
import TagsSettings from '@/project/main-panel/tags/tags-settings';

import './index.css';

const TicketInDialog = ({ ticketID, projectUuid, updateTicket, getTicket }) => {
  const [isLoading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const { tagsData } = useTags();

  const ticketRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    setTicket(null);
    getTicket(projectUuid, ticketID).then(res => {
      const ticket = new TicketModel(res.data.ticket);
      setTicket(ticket);
      updateTicket(ticket);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      setErrorMessage(errorMessage);
    }).finally(() => {
      setLoading(false);
    });
  }, [projectUuid, ticketID]);

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

  const isSmallScreen = containerWidth < 780;

  const { state, comments = [], assignees = [], type, tags, priority, participants = [], substate } = ticket;
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
          <RateSettings isReadonly={true} value={priority} />
          <CollaboratorsSettings isReadonly={true} title={gettext('Assignees')} value={assignees} />
          <TagsSettings
            id="tags-editor-popover"
            isReadonly={true}
            value={tags}
            tagsData={tagsData}
          />
          <StateSettings isReadonly={true} state={state} substate={substate} />
          <SubStateSettings isReadonly={true} state={state} substate={substate} />
          <TypeSettings isReadonly={true} value={type} />
          <CollaboratorsSettings isReadonly={true} title={gettext('Participants')} value={participants} />
        </div>
      </div>
    </div>
  );

};

export default TicketInDialog;
