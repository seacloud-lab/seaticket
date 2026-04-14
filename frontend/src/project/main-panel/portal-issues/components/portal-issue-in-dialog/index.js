import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import classnames from 'classnames';
import deepCopy from 'deep-copy';
import { Button } from 'reactstrap';
import { LongTextInlineEditor, EventBus, EXTERNAL_EVENTS } from '@seafile/seafile-editor';
import { CenteredLoading, CenteredError, toaster, Icon } from '@/components';
import { gettext, lang, username, name, avatarURL, server } from '@/constants';
import { Utils } from '@/utils/utils';
import { isLongTextValueExceedLimit, default as LongTextEditorUtilities } from '@/utils/long-text';
import { portalAPI } from '@/portal/api';
import { Ticket as TicketModel } from '@/project/main-panel/tickets/models';
import Comment from '@/project/main-panel/tickets/components/comment';
import Header from '@/project/main-panel/tickets/view/ticket/header';
import UploadFilesButton from '@/project/main-panel/tickets/components/upload-files-btn';
import {
  CollaboratorsSettings, PrioritySettings,
  DueDateSettings, LinkSettings, StateSettings, SubStateSettings
} from '@/project/main-panel/tickets/components/ticket-settings';
import TagsSettings from '@/project/main-panel/tags/tags-settings';
import { useTags, useMetadata } from '@/project/hooks';
import { getRowById } from '@/sea-metadata/utils/row';
import PortalTypeSettings from '../portal-type-settings';

import './index.css';

const PortalIssueInDialog = ({
  projectUuid,
  issueId,
  updateIssue,
}) => {
  const [isLoading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [issue, setIssue] = useState(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [linkedRecords, setLinkedRecords] = useState({});
  const [newComment, setNewComment] = useState('');

  const { typesData, statesData, substatesData } = useMetadata();
  const { tagsData } = useTags();

  const issueRef = useRef(null);
  const commentEditorRef = useRef(null);

  const editorAPI = useMemo(() => new LongTextEditorUtilities({ server, api: {
    uploadFile: (...params) => portalAPI.uploadFile(projectUuid, ...params)
  } }), [projectUuid]);

  useEffect(() => {
    setLoading(true);
    setIssue(null);
    portalAPI.getPortalIssueAsTicket(projectUuid, issueId).then(res => {
      const issue = new TicketModel(res.data.ticket);
      setIssue(issue);
      updateIssue(issue);
      setLinkedRecords(res.data?.linked_record_titles || {});
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      setErrorMessage(errorMessage);
    }).finally(() => {
      setLoading(false);
    });
  }, [projectUuid, issueId]);

  useEffect(() => {
    if (isLoading || !issue) return;
    const issueDom = issueRef.current;
    const handleResize = () => {
      if (!issueDom) return;
      setContainerWidth(issueDom.offsetWidth);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    issueDom && resizeObserver.observe(issueDom);

    return () => {
      issueDom && resizeObserver.unobserve(issueDom);
    };
  }, [isLoading, issue]);

  // Modify issue content
  const modifyIssueContent = useCallback((content, callback) => {
    portalAPI.updatePortalIssue(projectUuid, issueId, { content }).then(res => {
      const newIssue = issue._update({ content });
      setIssue(deepCopy(newIssue));
      callback && callback(null);
    }).catch(error => {
      callback && callback(error);
    });
  }, [projectUuid, issueId, issue]);

  const onTitleChange = useCallback((title, callback) => {
    portalAPI.updatePortalIssue(projectUuid, issueId, { title }).then(res => {
      const newIssue = issue._update({ title });
      setIssue(deepCopy(newIssue));
      callback && callback(null);
    }).catch(error => {
      callback && callback(error);
    });
  }, [projectUuid, issueId, issue]);

  // Comments
  const createComment = useCallback((content) => {
    const contentText = typeof content === 'object' ? content.text : content;
    return portalAPI.createPortalIssueComment(projectUuid, issueId, contentText).then(res => {
      const commentData = res.data.comment;
      let newIssue = issue._create_comment({
        id: commentData._pk,
        number: commentData._pk,
        content: commentData.content,
        created_time: commentData.created_time,
        modified_time: commentData.modified_time,
        creator: commentData.creator,
      });
      setIssue(deepCopy(newIssue));
      return commentData;
    });
  }, [projectUuid, issueId, issue]);

  const modifyComment = useCallback((commentId, content, callback) => {
    const contentText = typeof content === 'object' ? content.text : content;
    portalAPI.modifyPortalIssueComment(projectUuid, issueId, commentId, contentText).then(res => {
      let newIssue = issue._modify_comment(commentId, contentText);
      setIssue(deepCopy(newIssue));
      callback && callback(null);
    }).catch(error => {
      callback && callback(error);
    });
  }, [projectUuid, issueId, issue]);

  const deleteComment = useCallback((commentId) => {
    return portalAPI.deletePortalIssueComment(projectUuid, issueId, commentId).then(res => {
      let newIssue = issue._delete_comment(commentId);
      setIssue(deepCopy(newIssue));
      return newIssue;
    });
  }, [projectUuid, issueId, issue]);

  const closeIssue = useCallback(() => {
    portalAPI.updatePortalIssue(projectUuid, issueId, { state: 'closed' }).then(res => {
      const newIssue = issue._update({ state: '0002' });
      setIssue(deepCopy(newIssue));
    }).catch(error => {
      toaster.danger(Utils.getErrorMsg(error));
    });
  }, [projectUuid, issueId, issue]);

  // Comment submit
  const onNewCommentChange = useCallback((value) => {
    if (isLongTextValueExceedLimit(value)) {
      toaster.danger(gettext('Comment exceeds limit'));
      return;
    }
    setNewComment(value);
  }, []);

  const submitComment = useCallback(() => {
    const content = typeof newComment === 'object' ? newComment.text : newComment;
    if (!content || !content.trim()) {
      toaster.danger(gettext('Please enter a comment'));
      return;
    }
    createComment(newComment).then(() => {
      setNewComment('');
      if (commentEditorRef.current) {
        const editor = commentEditorRef.current.getEditor();
        const eventBus = EventBus.getInstance();
        eventBus.dispatch(EXTERNAL_EVENTS.CLEAR_ARTICLE, editor);
      }
    }).catch(error => {
      toaster.danger(Utils.getErrorMsg(error));
    });
  }, [newComment, createComment]);

  // Modify issue fields
  const modifyIssue = useCallback((data) => {
    const requestData = { ...data };

    // Convert state from ticket format to portal format for backend
    if (requestData.state === '0001') {
      requestData.state = 'open';
    } else if (requestData.state === '0002') {
      requestData.state = 'closed';
    }

    // Convert type ID to type name for backend
    if (requestData.type) {
      const typeOption = getRowById(typesData, requestData.type);
      if (typeOption) {
        requestData.type = typeOption.name;
      }
    }

    // Convert substate ID to substate name for backend
    if (requestData.substate) {
      const substateOption = getRowById(substatesData, requestData.substate);
      if (substateOption) {
        requestData.substate = substateOption.name;
      }
    }

    return portalAPI.updatePortalIssue(projectUuid, issueId, requestData).then(res => {
      const newIssue = issue._update(data);
      setIssue(deepCopy(newIssue));
      return data;
    });
  }, [projectUuid, issueId, issue, typesData, substatesData]);

  if (isLoading) return (<CenteredLoading />);
  if (errorMessage) return (<CenteredError>{errorMessage}</CenteredError>);
  if (!issue) return (<CenteredError>{gettext('Issue not found')}</CenteredError>);

  const isSmallScreen = containerWidth < 904;
  const { state, comments = [], assignees = [], type, tags, priority, participants = [], substate, due_date, linked_connection_records } = issue;

  const stateOption = statesData?.rows?.find(s => s._id === state);
  const typeOption = typesData?.rows?.find(t => t._id === type);

  return (
    <div className={classnames('sea-qa-project-ticket sea-qa-project-ticket-in-dialog', { 'small': isSmallScreen })} ref={issueRef}>
      <Header
        readonly={false}
        title={issue.title}
        id={issueId}
        stateOption={{
          value: state,
          icon: state === '0001' ? 'dot-circle-stroked' : 'check-circle-stroked',
          statusName: stateOption?.display_name || (state === '0001' ? 'Open' : 'Closed')
        }}
        typeOption={typeOption}
        modifyTitle={onTitleChange}
      />
      <div className="sea-qa-project-ticket-content-wrapper">
        <div className="sea-qa-project-ticket-comment-container-wrapper">
          {/* Main issue content */}
          <Comment
            isSmallScreen={isSmallScreen}
            comment={issue}
            isShowStatus={true}
            readonly={false}
            lang={lang}
            projectUuid={projectUuid}
            editorAPI={editorAPI}
            onModify={(content, callback) => modifyIssueContent(content, callback)}
          />
          {/* Comments list */}
          {comments.map(comment => {
            const canEdit = comment.creator === username;
            return (
              <Comment
                key={comment.id}
                isSmallScreen={isSmallScreen}
                readonly={!canEdit}
                comment={comment}
                projectUuid={projectUuid}
                editorAPI={editorAPI}
                onModify={(content, callback) => modifyComment(comment.id, content, callback)}
                onDelete={() => deleteComment(comment.id)}
              />
            );
          })}
          {/* New comment input */}
          <div className={classnames('sea-qa-project-ticket-comment sea-qa-project-ticket-add-comment', { 'small': isSmallScreen })}>
            <div className="sea-qa-project-ticket-comment-user-avatar">
              <img src={avatarURL} alt={name} />
            </div>
            <div className="sea-qa-project-ticket-comment-container">
              <div className="sea-qa-project-ticket-comment-op">
                {gettext('Add a comment')}
              </div>
              <div className="sea-qa-project-ticket-comment-content editing p-2">
                <LongTextInlineEditor
                  ref={commentEditorRef}
                  isAlwaysEnableEdit={true}
                  lang={lang}
                  headerName={gettext('Add comment')}
                  value={newComment}
                  autoSave={true}
                  saveDelay={20 * 1000}
                  isCheckBrowser={true}
                  isImageUploadOnly={false}
                  isSupportMultipleFiles={true}
                  editorApi={editorAPI}
                  autoFocus={false}
                  onSaveEditorValue={onNewCommentChange}
                />
                <div className="sea-qa-project-ticket-footer mt-2 pl-0">
                  <UploadFilesButton onChange={(files) => {
                    if (files.length === 0) return;
                    // Handle file uploads
                  }} />
                  <div className="ml-2 sea-qa-project-ticket-submit-btns">
                    {state === '0001' && (
                      <Button
                        className="sea-qa-project-ticket-title-cancel-btn mr-2"
                        onClick={closeIssue}
                      >
                        <Icon symbol="check-circle-stroked" className="mr-1" />
                        {gettext('Close as completed')}
                      </Button>
                    )}
                    <Button
                      color="primary"
                      className="sea-qa-project-ticket-title-submit-btn"
                      onClick={submitComment}
                      disabled={!newComment || (typeof newComment === 'object' && !newComment.text?.trim())}
                    >
                      {gettext('Comment')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Side settings */}
        <div className="sea-qa-project-ticket-other-settings">
          <PrioritySettings
            isReadonly={false}
            value={priority}
            onChange={(value) => modifyIssue({ priority: value })}
          />
          <CollaboratorsSettings
            isReadonly={false}
            title={gettext('Assignees')}
            value={assignees}
            onChange={(value) => modifyIssue({ assignees: value })}
          />
          <TagsSettings
            id="portal-issue-tags-editor-popover"
            isReadonly={false}
            value={tags}
            tagsData={tagsData}
            onChange={(value) => modifyIssue({ tags: value })}
          />
          <StateSettings
            isReadonly={false}
            state={state}
            substate={substate}
            substatesData={substatesData}
            onChange={(newState, newSubstate) => modifyIssue({ state: newState, substate: newSubstate })}
          />
          <SubStateSettings
            isReadonly={false}
            state={state}
            substate={substate}
            substatesData={substatesData}
            onChange={(newState, newSubstate) => modifyIssue({ substate: newSubstate })}
          />
          <PortalTypeSettings
            isReadonly={false}
            value={type}
            typesData={typesData}
            onChange={(value) => modifyIssue({ type: value })}
          />
          <DueDateSettings
            isReadonly={false}
            value={due_date}
            onChange={(value) => modifyIssue({ due_date: value })}
          />
          <CollaboratorsSettings
            isReadonly={false}
            title={gettext('Participants')}
            value={participants}
            onChange={(value) => modifyIssue({ participants: value })}
          />
          <LinkSettings value={linked_connection_records} linkedRecords={linkedRecords} />
        </div>
      </div>
    </div>
  );
};

export default PortalIssueInDialog;
