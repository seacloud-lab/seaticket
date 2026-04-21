import React, { useEffect, useRef, useState } from 'react';
import classnames from 'classnames';
import { CenteredLoading, CenteredError } from '@/components';
import { gettext, lang } from '@/constants';
import { Utils } from '@/utils/utils';
import { portalAPI } from '@/portal/api';
import { Issus as IssueModel } from '../../models';
import Comment from '@/project/main-panel/tickets/components/comment';
import {
  CollaboratorsSettings, PrioritySettings,
  DueDateSettings, LinkSettings, StateSettings, SubStateSettings, TypeSettings
} from '@/project/main-panel/tickets/components/ticket-settings';
import TagsSettings from '@/project/main-panel/tags/tags-settings';
import { useTags } from '@/project/hooks';
import { usePortalIssuesMetadata } from '../../hooks';

import '@/project/main-panel/connections/components/create-ticket-dialog/index.css';

const IssueInDialog = ({
  issueID,
  projectUuid,
  updateIssue,
  getIssue = (projectUuid, issueID) => portalAPI.getPortalIssue(projectUuid, issueID),
}) => {
  const [isLoading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [issue, setIssue] = useState(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [linkedRecords, setLinkedRecords] = useState({});

  const { tagsData } = useTags();

  const ticketRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    setIssue(null);
    getIssue(projectUuid, issueID).then(res => {
      const issue = new IssueModel(res.data.issue);
      setIssue(issue);
      updateIssue(issue);
      setLinkedRecords(res.data?.linked_record_titles || {});
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      setErrorMessage(errorMessage);
    }).finally(() => {
      setLoading(false);
    });
  }, [projectUuid, issueID]);

  useEffect(() => {
    if (isLoading || !issue) return;
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
  }, [isLoading, issue]);

  if (isLoading) return (<CenteredLoading />);
  if (errorMessage) return (<CenteredError>{errorMessage}</CenteredError>);
  if (!issue) return (<CenteredError>{gettext('Issue not found')}</CenteredError>);

  const isSmallScreen = containerWidth < 780;

  const { state, comments = [], assignees = [], type, tags, priority, participants = [], substate, due_date, linked_connection_records } = issue;
  return (
    <div className={classnames('sea-qa-project-ticket sea-qa-project-ticket-in-dialog', { 'small': isSmallScreen })} ref={ticketRef}>
      <div className="sea-qa-project-ticket-content-wrapper">
        <div className="sea-qa-project-ticket-comment-container-wrapper">
          <Comment
            isSmallScreen={isSmallScreen}
            comment={issue}
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
          <StateSettings isReadonly={true} state={state} substate={substate} useMetadataContext={usePortalIssuesMetadata} />
          <SubStateSettings isReadonly={true} state={state} substate={substate} useMetadataContext={usePortalIssuesMetadata} />
          <TypeSettings isReadonly={true} value={type} useMetadataContext={usePortalIssuesMetadata} />
          <DueDateSettings isReadonly={true} value={due_date} onChange={() => {}} />
          <CollaboratorsSettings isReadonly={true} title={gettext('Participants')} value={participants} />
          <LinkSettings value={linked_connection_records} linkedRecords={linkedRecords} />
        </div>
      </div>
    </div>
  );

};

export default IssueInDialog;
