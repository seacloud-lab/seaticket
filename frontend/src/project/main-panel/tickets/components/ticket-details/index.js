import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Button } from 'reactstrap';
import { LongTextInlineEditor, EventBus, EXTERNAL_EVENTS } from '@seafile/seafile-editor';
import classnames from 'classnames';
import deepCopy from 'deep-copy';
import { CenteredLoading, toaster } from '@/components';
import {
  gettext, name, username, avatarURL, lang, LONG_TEXT_EXCEED_LIMIT_MESSAGE,
  server,
} from '@/constants';
import { portalAPI } from '@/portal/api';
import { ticketsAPI } from '@/project/api';
import { useData, useTags, useMetadata, usePortalIssuesMetadata } from '@/project/hooks';
import { useTicketTaskCreated } from '@/project/hooks/ticket-task-created';
import { PORTAL_ISSUE_TABLE_NAME } from '@/project/main-panel/portal-issues/constants';
import TagsSettings from '@/project/main-panel/tags/tags-settings';
import { useCollaborators } from '@/sea-metadata';
import { EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import context from '@/sea-metadata/context';
import { convertRowToKeyValue, getRowById } from '@/sea-metadata/utils/row';
import LongTextEditorUtilities, { isLongTextValueExceedLimit } from '@/utils/long-text';
import { hasOwnProperty } from '@/utils/object-utils';
import { canCheckSeafileEditorBrowser } from '@/utils/seafile-editor-browser';
import { isFunction } from '@/utils/type-detection';
import { Utils } from '@/utils/utils';
import {
  PREDEFINED_TICKET_COLUMN_NAME, TICKET_TABLE_NAME,
  AUTO_UPDATE_PARTICIPANTS_KEY, TICKET_TYPE,
} from '../../constants';
import { useCloseLinkedIssues } from '../../hooks';
import {
  convertSubstateToGitHubStateReason, generatorLinkedRecordsForClosedGitHubIssues,
} from '../../utils';
import Comment from '../comment';
import {
  CollaboratorsSettings, CustomerSettings, TypeSettings, PrioritySettings,
  StateSettings, SubStateSettings, DueDateSettings, LinkSettings,
} from '../ticket-settings';
import UploadFilesButton from '../upload-files-btn';
import StatusToggleButton from './status-toggle-btn';
import TicketLog from './ticket-log';

import './index.css';

const TicketDetails = forwardRef(({
  ticketType,
  permission, isAdmin = false,
  isShowOthersInfo = true,
  isShowCustomer = true,
  isMobile = false,
  smallScreenSize,
  projectUuid,
  ticket, setTicket, modifyTicket,
  linkedRecords, setLinkedRecords,
  createComment, modifyComment, deleteComment,
}, ref) => {
  const [comment, setComment] = useState('');
  const [activities, setActivities] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  const useMetadataContext = ticketType === TICKET_TYPE ? useMetadata : usePortalIssuesMetadata;
  const { typesData, statesData, substatesData } = useMetadataContext();
  const { modifyLocalRow, getTableByName } = useData();
  const { tagsData, createTag } = useTags();
  const { openCloseLinkedGitHubIssuesWarningDialog } = useCloseLinkedIssues();

  const containerRef = useRef(null);
  const commentEditorRef = useRef(null);
  const sessionIdRef = useRef(0);

  useEffect(() => {
    const sessionId = ++sessionIdRef.current;
    return () => {
      sessionIdRef.current = sessionId + 1;
    };
  }, [projectUuid, ticketType, ticket?.id]);

  const user = useMemo(() => {
    return {
      name,
      email: username,
      avatar_url: avatarURL
    };
  }, []);

  const editorAPI = useMemo(() => new LongTextEditorUtilities({ server, api: {
    uploadFile: (...params) => {
      if (ticketType === TICKET_TYPE) return ticketsAPI.uploadFile(projectUuid, ...params);
      return portalAPI.uploadFile(projectUuid, ...params);
    }
  } }), [ticketType, projectUuid]);

  const ticketKey = useMemo(() => `${ticketType}_${ticket?.id}`, [ticketType, ticket]);

  // Merge comments and activities into a timeline
  const timeline = useMemo(() => {
    if (!ticket) return [];
    const { comments = [] } = ticket;
    const items = [
      ...comments.map(c => ({ ...c, type: 'comment' })),
      ...activities.map(a => ({ ...a, type: 'log' }))
    ];
    // use original time for sorting: comments use _created_time, activities use created_time
    return items.sort((a, b) => {
      const timeA = a.type === 'comment' ? a._created_time : a.created_time;
      const timeB = b.type === 'comment' ? b._created_time : b.created_time;
      return new Date(timeA) - new Date(timeB);
    });
  }, [ticket, activities]);

  const isSmallScreen = useMemo(() => containerWidth < smallScreenSize, [containerWidth, smallScreenSize]);

  const updateActivities = useCallback((key, update) => {
    if (key !== ticketKey) return;
    setActivities(previous => {
      const nextActivities = isFunction(update) ? update(previous) : update;
      return Array.from(new Map(nextActivities.map(activity => [activity.id, activity])).values());
    });
  }, [ticketKey]);

  useTicketTaskCreated({ projectUuid, rowId: ticket?.id, onUpdate: ({ rowId, activities }) => {
    if (ticketType !== TICKET_TYPE || !ticket?.id || !Array.isArray(activities)) return;
    updateActivities(`${TICKET_TYPE}_${rowId}`, previous => [...previous, ...activities]);
  } });

  const canCheckEditorBrowser = canCheckSeafileEditorBrowser();

  const handleUpdateRowsCacheData = useCallback((ticketID, update) => {
    const tableName = ticketType === TICKET_TYPE ? TICKET_TABLE_NAME : PORTAL_ISSUE_TABLE_NAME;
    const table = getTableByName(tableName, null);
    if (!table) return;
    const columns = Object.values(table.key_column_map);
    if (columns.length === 0) return;
    const localRowUpdate = convertRowToKeyValue(update, { data: { columns: columns }, typesData, tagsData });
    if (Object.keys(localRowUpdate).length === 0) return;

    modifyLocalRow(tableName, ticketID, localRowUpdate);

    const pathname = window.location.pathname;
    const isTicketsView = ticketType === TICKET_TYPE
      ? pathname.endsWith('/tickets/') || pathname.endsWith('/my-tickets/')
      : pathname.endsWith('/portal-issues/');
    if (isTicketsView) {
      const eventBus = context.eventBus;
      eventBus.dispatch(EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, ticketID, localRowUpdate);
    }
  }, [ticketType, typesData, tagsData, getTableByName, modifyLocalRow]);

  // api
  const handleModifyTicket = useCallback((ticketID, data, { linkedGithubIssuesToClose = null } = {}) => {
    const sessionId = sessionIdRef.current;
    let serverData = {};
    const dataKeys = Object.keys(data);
    const isAutoUpdateParticipants = !dataKeys.includes(AUTO_UPDATE_PARTICIPANTS_KEY);

    dataKeys.filter(key => key !== AUTO_UPDATE_PARTICIPANTS_KEY).forEach(columnName => {
      let value = data[columnName];
      if (columnName === PREDEFINED_TICKET_COLUMN_NAME.TYPE && value) {
        const typeOption = getRowById(typesData, value);
        value = typeOption.name;
      } else if (columnName === PREDEFINED_TICKET_COLUMN_NAME.STATE && value) {
        value = getRowById(statesData, value)?.origin_name;
      } else if (columnName === PREDEFINED_TICKET_COLUMN_NAME.SUB_STATE && value) {
        value = getRowById(substatesData, value)?.origin_name;
      }
      serverData[columnName] = value;
    });
    if (linkedGithubIssuesToClose) {
      serverData.linked_github_issues_to_close = linkedGithubIssuesToClose;
    }

    return modifyTicket(projectUuid, ticketID, serverData).then(res => {
      let update = { ...data };
      const { participants = [] } = ticket;
      if (isAutoUpdateParticipants && !participants.includes(user.email)) {
        update['participants'] = [...participants, user.email];
      }
      if (hasOwnProperty(res.data.row, PREDEFINED_TICKET_COLUMN_NAME.CONTENT)) {
        update[PREDEFINED_TICKET_COLUMN_NAME.CONTENT] = res.data.row[PREDEFINED_TICKET_COLUMN_NAME.CONTENT];
      }
      const { assignees, modified_time } = res.data.row || {};
      if (Array.isArray(assignees)) {
        update.assignees = assignees;
        update.modified_time = modified_time;
      }
      handleUpdateRowsCacheData(ticketID, update);
      if (sessionId !== sessionIdRef.current) return update;

      const newTicket = ticket._update(update);
      setTicket(deepCopy(newTicket));
      const linkedRecordsInfo = res.data.linked_records_info || {};
      if (Object.keys(linkedRecordsInfo).length > 0) {
        setLinkedRecords(prevLinkedRecords => ({ ...prevLinkedRecords, ...linkedRecordsInfo }));
      }

      // update activities to immediately display new changes
      const newActivities = res.data.activities || [];
      if (newActivities.length > 0) {
        updateActivities(ticketKey, prevActivities => [...prevActivities, ...newActivities]);
      }

      return update;
    });
  }, [
    projectUuid, ticket, user, typesData, statesData, substatesData, ticketKey,
    handleUpdateRowsCacheData, modifyTicket, setTicket, setLinkedRecords, updateActivities,
  ]);

  const handleUpdateParticipants = useCallback((ticket) => {
    const { participants = [] } = ticket;
    if (!participants.includes(user.email)) {
      const update = { 'participants': [...participants, user.email] };
      ticket = ticket._update(update);
      handleUpdateRowsCacheData(ticket._id, update);
    }
  }, [user, handleUpdateRowsCacheData]);

  const handleCreateComment = useCallback((ticketID, comment) => {
    return createComment(projectUuid, ticketID, comment).then(res => {
      let newTicket = ticket._create_comment(res.data.comment);
      handleUpdateParticipants(newTicket);
      setTicket(deepCopy(newTicket));
      return res.data.comment;
    });
  }, [projectUuid, ticket, handleUpdateParticipants, createComment, setTicket]);

  const handleDeleteComment = useCallback((ticketID, commentID) => {
    return deleteComment(projectUuid, ticketID, commentID).then(res => {
      let newTicket = ticket._delete_comment(commentID);
      handleUpdateParticipants(newTicket);
      setTicket(deepCopy(newTicket));
      return newTicket;
    });
  }, [projectUuid, ticket, handleUpdateParticipants, deleteComment, setTicket]);

  const onCommentChange = useCallback((value) => {
    if (isLongTextValueExceedLimit(value)) {
      toaster.closeAll();
      toaster.danger(LONG_TEXT_EXCEED_LIMIT_MESSAGE, { duration: null });
      return;
    }
    setComment(value);
  }, []);

  const onPriorityChange = useCallback((priority = 0) => {
    handleModifyTicket(ticket.id, { priority }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [ticket, handleModifyTicket]);

  const onAssigneesChange = useCallback((assignees = []) => {
    handleModifyTicket(ticket.id, { assignees }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [ticket, handleModifyTicket]);

  const onStateChange = useCallback((state = '', substate = '') => {
    const sessionId = sessionIdRef.current;
    const nextStateName = (getRowById(statesData, state)?.origin_name || '').toLowerCase();
    const isClosing = nextStateName === 'closed';
    const openGithubIssues = Object.entries(linkedRecords || {}).reduce((issues, [key, record]) => {
      if (!record || record.connection_type !== 'github_issue') return issues;
      const issueState = (record.state || '').toString().toLowerCase();
      if (issueState === 'closed' || issueState === '0002') return issues;
      const [connectionId, recordPk] = key.split('_', 2);
      const parsedConnectionId = Number(connectionId);
      const parsedRecordPk = Number(recordPk);
      if (!Number.isInteger(parsedConnectionId) || !Number.isInteger(parsedRecordPk)) return issues;
      issues.push({
        connection_id: parsedConnectionId,
        record_pk: parsedRecordPk,
        title: record.title || '',
        state: record.state,
      });
      return issues;
    }, []);

    if (isClosing && openGithubIssues.length > 0) {
      const ticketToClose = {
        ticket_id: Number(ticket.id),
        ticket_title: ticket.title || '',
        open_github_issues: openGithubIssues,
      };
      const closePayload = [ticketToClose];
      const submitClose = (shouldCloseLinkedGithubIssues) => {
        const options = shouldCloseLinkedGithubIssues ? { linkedGithubIssuesToClose: closePayload } : undefined;
        return handleModifyTicket(ticket.id, { state, substate }, options).then(() => {
          if (shouldCloseLinkedGithubIssues && sessionId === sessionIdRef.current) {
            setLinkedRecords(pre => generatorLinkedRecordsForClosedGitHubIssues(pre, openGithubIssues));
          }
        });
      };
      openCloseLinkedGitHubIssuesWarningDialog({
        ticket: ticketToClose,
        stateReason: convertSubstateToGitHubStateReason(getRowById(substatesData, substate)?.origin_name),
        onCloseTicketOnly: () => submitClose(false),
        onCloseTicketAndGitHubIssues: () => submitClose(true),
      });
      return;
    }

    handleModifyTicket(ticket.id, { state, substate }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [ticket, statesData, substatesData, linkedRecords, handleModifyTicket, openCloseLinkedGitHubIssuesWarningDialog, setLinkedRecords]);

  const onSubstateChange = useCallback((substate) => {
    handleModifyTicket(ticket.id, { substate }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [ticket, handleModifyTicket]);

  const onTypeChange = useCallback((type = '') => {
    handleModifyTicket(ticket.id, { type }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [ticket, handleModifyTicket]);

  const onCustomerChange = useCallback((customerId) => {
    // kept as a string so it stays equal to the option values the editor holds;
    // the server parses it back to an int
    const value = customerId === '' || customerId === null || customerId === undefined ? '' : String(customerId);
    handleModifyTicket(ticket.id, { [PREDEFINED_TICKET_COLUMN_NAME.CUSTOMER_ID]: value }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [ticket, handleModifyTicket]);

  const onTagsChange = useCallback((tags) => {
    if (!Array.isArray(tags)) return;
    return handleModifyTicket(ticket.id, { tags }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [ticket, handleModifyTicket]);

  const onContentChange = useCallback((content, callback) => {
    handleModifyTicket(ticket.id, { content }).then(update => {
      callback && callback('', update.content);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      callback && callback(error);
    });
  }, [ticket, handleModifyTicket]);

  const onDueDateChange = useCallback((due_date = '') => {
    handleModifyTicket(ticket.id, { due_date }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [ticket, handleModifyTicket]);

  const onParticipantsChange = useCallback((participants = []) => {
    handleModifyTicket(ticket.id, { participants, [AUTO_UPDATE_PARTICIPANTS_KEY]: true }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [ticket, handleModifyTicket]);

  const handleFiles = useCallback((files) => {
    if (files.length === 0) return;
    const editor = commentEditorRef.current.getEditor();
    const eventBus = EventBus.getInstance();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImage = /image/i.test(file.type);
      const fileName = file.name;
      editorAPI.uploadLocalImage(file).then(url => {
        eventBus.dispatch(EXTERNAL_EVENTS.INSERT_ATTACHMENTS, editor, { title: fileName, url, isImage });
      });
    }
  }, [editorAPI]);

  const onSubmitComment = useCallback((callback) => {
    setIsSubmitting(true);
    handleCreateComment(ticket.id, comment).then(() => {
      const editor = commentEditorRef.current.getEditor();
      const eventBus = EventBus.getInstance();
      eventBus.dispatch(EXTERNAL_EVENTS.CLEAR_ARTICLE, editor);
      callback && callback();
      setTimeout(() => {
        containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
        setIsSubmitting(false);
      }, 1);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setIsSubmitting(false);
    });
  }, [comment, ticket, commentEditorRef, handleCreateComment]);

  const toggleState = useCallback((state = '', substate = '') => {
    if (comment && comment?.text) {
      onSubmitComment(() => onStateChange(state, substate));
      return;
    }

    onStateChange(state, substate);
  }, [comment, onSubmitComment, onStateChange]);

  const handleModifyComment = useCallback((commentID, content, callback) => {
    modifyComment(projectUuid, ticket.id, commentID, content).then(res => {
      const newTicket = ticket._modify_comment(commentID, res.data.comment);
      const newComment = newTicket._get_comment(commentID);
      handleUpdateParticipants(newTicket);
      setTicket(deepCopy(newTicket));
      callback && callback('', newComment?.content);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      callback && callback(error);
    });
  }, [projectUuid, ticket, modifyComment, setTicket, handleUpdateParticipants]);

  useEffect(() => {
    const ticketID = ticket?.id;
    const ticketKey = `${ticketType}_${ticket?.id}`;
    if (ticketType !== TICKET_TYPE || !ticket?.id) {
      updateActivities(ticketKey, []);
      return;
    }

    const controller = new AbortController();
    updateActivities(ticketKey, []);

    // Load activities
    ticketsAPI.listProjectTicketActivities(projectUuid, ticketID, 1, 100, controller.signal).then(res => {
      if (controller.signal.aborted) return;
      // Preserve activities added while the initial request was in flight.
      updateActivities(ticketKey, previous => [...(res.data.activities || []), ...previous]);
    }).catch(error => {
      if (controller.signal.aborted) return;
      // Activities loading failure is not critical
      // eslint-disable-next-line no-console
      console.error('Failed to load activities:', error);
    });

    return () => controller.abort();
  }, [projectUuid, ticket?.id, ticketType, updateActivities]);

  useEffect(() => {
    const detailsDom = containerRef.current;
    const handleResize = () => {
      if (!detailsDom) return;
      setContainerWidth(detailsDom.offsetWidth);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    detailsDom && resizeObserver.observe(detailsDom);

    return () => {
      detailsDom && resizeObserver.unobserve(detailsDom);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    setActivities: updateActivities,
    onChange: handleModifyTicket,
  }), [handleModifyTicket, updateActivities]);

  const {
    id, state, assignees = [], type, tags, priority, participants = [],
    substate, due_date, linked_connection_records, customer_id, linked_ticket,
  } = ticket;

  const canModifyTicket = isFunction(modifyTicket);
  const lastOpType = timeline.length > 0 ? timeline[timeline.length - 1].type : 'comment';
  const isTicket = ticketType === TICKET_TYPE;
  const canModifyCustomer = canModifyTicket && isTicket;
  const showCustomer = isTicket || isShowCustomer;

  return (
    <div
      className={classnames('seaqa-project-ticket-details', { 's': isSmallScreen })}
      ref={containerRef}
    >
      <div className="seaqa-project-ticket-comment-container-wrapper">
        <Comment
          isSmallScreen={isSmallScreen}
          comment={ticket}
          isShowStatus={true}
          className={classnames({ 'd-none-after': timeline.length === 0 })}
          readonly={!canModifyTicket}
          lang={lang}
          editorAPI={editorAPI}
          onModify={onContentChange}
        />
        {timeline.map((item, index) => {
          const className = classnames({ 'd-none-after': index === (timeline.length - 1) });
          if (item.type === 'log') {
            return (
              <TicketLog
                key={`ticket-log-${item.id}`}
                log={item}
                projectUuid={projectUuid}
                className={className}
                isSmallScreen={isSmallScreen}
                permission={permission}
              />
            );
          }
          const canModify = isFunction(modifyComment) && (item.creator === user.email || isAdmin);
          return (
            <Comment
              key={`comment-${item.id}`}
              isSmallScreen={isSmallScreen}
              readonly={!canModify}
              comment={item}
              className={className}
              projectUuid={projectUuid}
              editorAPI={editorAPI}
              onDelete={canModify && isFunction(deleteComment) ? (comment) => handleDeleteComment(id, comment.id) : null}
              onModify={canModify ? (content, callback) => handleModifyComment(item.id, content, callback) : null}
            />
          );
        })}
        {isFunction(createComment) && (
          <>
            <Comment
              className={classnames('seaqa-project-ticket-add-comment d-none-after mb-0', { 'mt-4': lastOpType === 'log', 'mt-3': lastOpType === 'comment' })}
              isSmallScreen={isSmallScreen}
              comment={{ creator: username }}
              onSubmitComment={onSubmitComment}
            >
              <span className="seaqa-project-ticket-add-comment-title">{gettext('Add a comment')}</span>
              <LongTextInlineEditor
                isAlwaysEnableEdit={true}
                ref={commentEditorRef}
                lang={lang}
                headerName={gettext('Comment')}
                value={comment || ''}
                autoSave={false}
                saveDelay={20 * 1000}
                isCheckBrowser={canCheckEditorBrowser}
                isImageUploadOnly={false}
                isSupportMultipleFiles={true}
                editorApi={editorAPI}
                onSaveEditorValue={onCommentChange}
              />
            </Comment>
            <div className="seaqa-project-ticket-footer">
              <UploadFilesButton
                className={classnames('mt-4', { 'mobile mr-auto': isMobile })}
                isShowText={!isMobile}
                onChange={handleFiles}
              />
              <div className="seaqa-project-ticket-submit-btns ml-2">
                {canModifyTicket && (
                  <StatusToggleButton
                    state={state}
                    substate={substate}
                    comment={comment?.text}
                    disabled={isSubmitting}
                    useMetadataContext={useMetadataContext}
                    onChange={toggleState}
                  />
                )}
                <Button
                  className="seaqa-project-ticket-footer-confirm-btn"
                  disabled={!comment.text || isSubmitting}
                  color="primary"
                  onClick={() => onSubmitComment()}
                >
                  {isSubmitting ? (<CenteredLoading />) : gettext('Comment')}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
      {isShowOthersInfo && (
        <div className="seaqa-project-ticket-other-settings">
          <PrioritySettings isReadonly={!canModifyTicket} value={priority} onChange={onPriorityChange} />
          {isTicket && (
            <CollaboratorsSettings
              id="assignees-editor-popover"
              isReadonly={!canModifyTicket}
              title={gettext('Assignees')}
              value={assignees}
              tip={gettext('No one assigned')}
              useCollaborators={useCollaborators}
              onChange={onAssigneesChange}
            />
          )}
          <TagsSettings
            id="tags-editor-popover"
            isReadonly={!canModifyTicket}
            value={tags}
            tagsData={tagsData}
            createTag={createTag}
            onChange={onTagsChange}
          />
          <StateSettings isReadonly={!canModifyTicket} state={state} substate={substate} useMetadataContext={useMetadataContext} onChange={onStateChange} />
          <SubStateSettings isReadonly={!canModifyTicket} state={state} substate={substate} useMetadataContext={useMetadataContext} onChange={onSubstateChange} />
          <TypeSettings id="type-editor-popover" isReadonly={!canModifyTicket} value={type} useMetadataContext={useMetadataContext} onChange={onTypeChange} />
          {isTicket && (
            <>
              <DueDateSettings isReadonly={!canModifyTicket} value={due_date} onChange={onDueDateChange} />
              <CollaboratorsSettings
                isReadonly={!canModifyTicket}
                title={gettext('Participants')}
                value={participants}
                useCollaborators={useCollaborators}
                tip={gettext('No participants')}
                onChange={onParticipantsChange}
              />
            </>
          )}
          <LinkSettings
            value={isTicket ? linked_connection_records : [linked_ticket]}
            linkedRecords={linkedRecords}
          />
          {showCustomer && (
            <CustomerSettings
              id="customer-editor-popover"
              isReadonly={!canModifyCustomer}
              value={customer_id}
              useMetadataContext={useMetadataContext}
              onChange={onCustomerChange}
            />
          )}
        </div>
      )}
    </div>
  );
});

export default TicketDetails;
