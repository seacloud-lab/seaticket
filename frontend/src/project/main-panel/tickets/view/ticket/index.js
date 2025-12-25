import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'reactstrap';
import classnames from 'classnames';
import copy from 'copy-to-clipboard';
import deepCopy from 'deep-copy';
import { LongTextInlineEditor, EventBus, EXTERNAL_EVENTS } from '@seafile/seafile-editor';
import { isLongTextValueExceedLimit } from '@/utils/long-text';
import { CenteredLoading, toaster, EmptyTip } from '@/components';
import { useDataCache } from '@/sea-metadata';
import { TICKET_STATE_CONFIG, PREDEFINED_TICKET_COLUMN_NAME } from '../../constants';
import { isShiftSlash } from '@/utils/hotkey';
import {
  gettext, name, username, avatarURL, lang, LONG_TEXT_EXCEED_LIMIT_MESSAGE, mediaUrl,
  PERMISSION_TYPES
} from '@/constants';
import { Utils } from '@/utils/utils';
import {
  CollaboratorsSettings, TagsSettings, TypeSettings, RateSettings,
  StateSettings, SubStateSettings,
} from '../../components/ticket-settings';
import Comment from '../../components/comment';
import StatusToggleButton from './status-toggle-btn';
import KeyboardShortcuts from '../../components/tickets-keyboard-shortcuts-dialog';
import { ticketsAPI } from '../../../../api';
import { Ticket as TicketModel } from '../../models';
import { useMetadata } from '../../hooks';
import UploadFilesButton from '../../components/upload-files-btn';
import { getRowById, getRowsByIds } from '@/sea-metadata/utils/row';
import Header from './header';

import './index.css';

const Ticket = ({ editorAPI, projectUuid, ticketID, permission, isAdmin }) => {
  const [isLoading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [ticket, setTicket] = useState(null);
  const [isShowStickyHeader, setIsShowStickyHeader] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isShowKeyboardShortcuts, setIsShowKeyboardShortcuts] = useState(false);

  const { isLoading: isMetadataLoading, typesData, tagsData, statesData, substatesData, createTag } = useMetadata();
  const { updateCacheData } = useDataCache();

  const user = useMemo(() => {
    return {
      name,
      email: username,
      avatar_url: avatarURL
    };
  }, []);

  const ticketRef = useRef(null);
  const commentEditorRef = useRef(null);
  const containerRef = useRef(null);
  const headerRef = useRef(null);

  const handleScroll = useCallback((event) => {
    if (!event) return;
    const dom = headerRef.current.getDom();
    const { height } = dom.getBoundingClientRect();
    setIsShowStickyHeader(event.target.scrollTop > height);
  }, [headerRef]);

  const handleUpdateRowsCacheData = useCallback((ticketID, update) => {
    updateCacheData('rows', String(ticketID), update, true);
  }, [updateCacheData]);

  // api
  const modifyTicket = useCallback((ticketID, data) => {
    let serverData = {};

    Object.keys(data).forEach(columnName => {
      let value = data[columnName];
      if (columnName === PREDEFINED_TICKET_COLUMN_NAME.TAGS && Array.isArray(value) && value.length > 0) {
        const tags = getRowsByIds(tagsData, value);
        value = tags.map(tag => tag.name);
      } else if (columnName === PREDEFINED_TICKET_COLUMN_NAME.TYPE && value) {
        const typeOption = getRowById(typesData, value);
        value = typeOption.name;
      } else if (columnName === PREDEFINED_TICKET_COLUMN_NAME.STATE && value) {
        value = getRowById(statesData, value)?.origin_name;
      } else if (columnName === PREDEFINED_TICKET_COLUMN_NAME.SUB_STATE && value) {
        value = getRowById(substatesData, value)?.origin_name;
      }
      serverData[columnName] = value;
    });

    return ticketsAPI.modifyProjectTicket(projectUuid, ticketID, serverData).then(res => {
      let update = { ...data };
      const { participants = [] } = ticket;
      if (!participants.includes(user.email)) {
        update['participants'] = [...participants, user.email];
      }
      const newTicket = ticket._update(update);
      handleUpdateRowsCacheData(String(ticketID), update);
      setTicket(deepCopy(newTicket));
      return data;
    });
  }, [projectUuid, ticket, user, tagsData, typesData, statesData, substatesData, handleUpdateRowsCacheData]);

  const handleUpdateParticipants = useCallback((ticket) => {
    const { participants = [] } = ticket;
    if (!participants.includes(user.email)) {
      const update = { 'participants': [...participants, user.email] };
      ticket = ticket._update(update);
      handleUpdateRowsCacheData(String(ticket._id), update);
    }
  }, [user, handleUpdateRowsCacheData]);

  const createComment = useCallback((ticketID, comment) => {
    return ticketsAPI.createProjectTicketComment(projectUuid, ticketID, comment).then(res => {
      let newTicket = ticket._create_comment(res.data.ticket_comment);
      handleUpdateParticipants(newTicket);
      setTicket(deepCopy(newTicket));
      return res.data.ticket_comment;
    });
  }, [projectUuid, ticket, handleUpdateParticipants]);

  const modifyComment = useCallback((ticketID, commentID, comment) => {
    return ticketsAPI.modifyProjectTicketComment(projectUuid, ticketID, commentID, comment).then(res => {
      let newTicket = ticket._modify_comment(commentID, comment);
      handleUpdateParticipants(newTicket);
      setTicket(deepCopy(newTicket));
      return newTicket;
    });
  }, [projectUuid, ticket, handleUpdateParticipants]);

  const deleteComment = useCallback((ticketID, commentID) => {
    return ticketsAPI.deleteProjectTicketComment(projectUuid, ticketID, commentID).then(res => {
      let newTicket = ticket._delete_comment(commentID);
      handleUpdateParticipants(newTicket);
      setTicket(deepCopy(newTicket));
      return newTicket;
    });
  }, [projectUuid, ticket, handleUpdateParticipants]);

  const copyLink = useCallback(() => {
    copy(window.location.href);
    toaster.success(gettext('The ticket link has been copied'));
  }, []);

  const onCommentChange = useCallback((value) => {
    if (isLongTextValueExceedLimit(value)) {
      toaster.closeAll();
      toaster.danger(LONG_TEXT_EXCEED_LIMIT_MESSAGE, { duration: null });
      return;
    }
    setComment(value);
  }, []);

  const onPriorityChange = useCallback((priority = 0) => {
    modifyTicket(ticket.id, { priority }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [ticket, modifyTicket]);

  const onAssigneesChange = useCallback((assignees = []) => {
    modifyTicket(ticket.id, { assignees }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [ticket, modifyTicket]);

  const onStateChange = useCallback((state = '', substate = '') => {
    modifyTicket(ticket.id, { state, substate }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [ticket, modifyTicket]);

  const onSubstateChange = useCallback((substate) => {
    modifyTicket(ticket.id, { substate }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [ticket, modifyTicket]);

  const onTypeChange = useCallback((type = '') => {
    modifyTicket(ticket.id, { type }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [ticket, modifyTicket]);

  const onTagsChange = useCallback((tags) => {
    if (!Array.isArray(tags)) return;
    return modifyTicket(ticket.id, { tags }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [ticket, modifyTicket]);

  const onContentChange = useCallback((content, callback) => {
    modifyTicket(ticket.id, { content }).then(res => {
      callback && callback();
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      callback && callback(error);
    });
  }, [ticket, modifyTicket]);

  const onTitleChange = useCallback((title, callback) => {
    modifyTicket(ticket.id, { title }).then(res => {
      callback && callback();
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      callback && callback(error);
    });
  }, [ticket, modifyTicket]);

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
    createComment(ticket.id, comment).then(() => {
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
  }, [comment, ticket, commentEditorRef, createComment]);

  const toggleState = useCallback((state = '', substate = '') => {
    const modifyState = () => {
      modifyTicket(ticket.id, { state, substate }).then(res => {
        // todo
      }).catch(error => {
        const errorMessage = Utils.getErrorMsg(error);
        toaster.danger(errorMessage);
      });
    };
    if (comment && comment?.text) {
      onSubmitComment(modifyState);
      return;
    }

    modifyState();
  }, [ticket, comment, modifyTicket, onSubmitComment]);

  const handleModifyComment = useCallback((commentID, content, callback) => {
    modifyComment(ticket.id, commentID, content).then(res => {
      callback && callback();
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      callback && callback(error);
    });
  }, [ticket, modifyComment]);

  useEffect(() => {
    setLoading(true);
    setTicket(null);
    ticketsAPI.getProjectTicket(projectUuid, ticketID).then(res => {
      const ticket = new TicketModel(res.data.ticket);
      setTicket(ticket);
      setLoading(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setLoading(false);
    });
  }, [projectUuid, ticketID]);

  useEffect(() => {
    if (isLoading || isMetadataLoading || !ticket) return;
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
  }, [isLoading, isMetadataLoading, ticket]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (isShiftSlash(event)) {
        event.preventDefault();
        event.stopPropagation();
        setIsShowKeyboardShortcuts(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  if (isLoading || isMetadataLoading) return (<CenteredLoading />);
  if (!ticket) return (<EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('Not found ticket')} />);

  const { id, state, title, creator, comments = [], assignees = [], type, tags, priority, participants = [], substate } = ticket;
  const typeOption = getRowById(typesData, type);
  const editable = creator === user.email || permission === PERMISSION_TYPES.READ_WRITE;
  const stateOption = TICKET_STATE_CONFIG[state];

  // 904: comment min-width(596) + others min-width(260) + gap: 16 * 3
  const isSmallScreen = containerWidth < 904;

  return (
    <div
      className={classnames('sea-qa-project-ticket', { 'small': isSmallScreen })}
      onScroll={handleScroll}
      ref={ticketRef}
    >
      <Header
        ref={headerRef}
        readonly={!editable}
        title={title}
        id={id}
        stateOption={stateOption}
        typeOption={typeOption}
        copyLink={copyLink}
        modifyTitle={onTitleChange}
      />
      <Header
        className={classnames('sea-qa-project-ticket-simple-info-wrapper-sticky', { 'd-none': !isShowStickyHeader })}
        title={title}
        id={id}
        stateOption={stateOption}
        typeOption={typeOption}
      />
      <div className="sea-qa-project-ticket-content-wrapper" ref={containerRef}>
        <div className="sea-qa-project-ticket-comment-container-wrapper">
          <Comment
            isSmallScreen={isSmallScreen}
            comment={ticket}
            isShowStatus={true}
            readonly={!editable}
            lang={lang}
            editorAPI={editorAPI}
            onModify={onContentChange}
          />
          {comments.map(comment => {
            return (
              <Comment
                key={comment.id}
                isSmallScreen={isSmallScreen}
                readonly={!(comment.creator === user.email || isAdmin)}
                comment={comment}
                projectUuid={projectUuid}
                editorAPI={editorAPI}
                onDelete={(comment) => deleteComment(id, comment.id)}
                onModify={(content, callback) => handleModifyComment(comment.id, content, callback)}
              />
            );
          })}
          <Comment className="sea-qa-project-ticket-add-comment mb-0" isSmallScreen={isSmallScreen} comment={{ creator: username }} onSubmitComment={onSubmitComment}>
            <span className="sea-qa-project-ticket-add-comment-title">{gettext('Add a comment')}</span>
            <LongTextInlineEditor
              isAlwaysEnableEdit={true}
              ref={commentEditorRef}
              lang={lang}
              headerName={gettext('Comment')}
              value={comment || ''}
              autoSave={false}
              saveDelay={20 * 1000}
              isCheckBrowser={true}
              isImageUploadOnly={false}
              isSupportMultipleFiles={true}
              editorApi={editorAPI}
              onSaveEditorValue={onCommentChange}
            />
          </Comment>
          <div className="sea-qa-project-ticket-footer">
            <UploadFilesButton className="mt-4" onChange={handleFiles} />
            <div className="sea-qa-project-ticket-submit-btns ml-2">
              <StatusToggleButton state={state} substate={substate} comment={comment?.text} disabled={isSubmitting} onChange={toggleState} />
              <Button
                className="sea-qa-project-ticket-footer-confirm-btn"
                disabled={!comment.text || isSubmitting}
                color="primary"
                onClick={() => onSubmitComment()}
              >
                {isSubmitting ? (<CenteredLoading />) : gettext('Comment')}
              </Button>
            </div>
          </div>
        </div>
        <div className="sea-qa-project-ticket-other-settings">
          <RateSettings isReadonly={!editable} value={priority} onChange={onPriorityChange} />
          <CollaboratorsSettings id="assignees-editor-popover" isReadonly={!editable} title={gettext('Assignees')} value={assignees} onChange={onAssigneesChange} />
          <TagsSettings
            id="tags-editor-popover"
            isReadonly={!editable}
            value={tags}
            isLoading={isMetadataLoading}
            tagsData={tagsData}
            createTag={createTag}
            onChange={onTagsChange}
          />
          <StateSettings isReadonly={!editable} state={state} substate={substate} onChange={onStateChange} />
          <SubStateSettings isReadonly={!editable} state={state} substate={substate} onChange={onSubstateChange} />
          <TypeSettings id="type-editor-popover" isReadonly={!editable} value={type} onChange={onTypeChange} />
          <CollaboratorsSettings isReadonly={true} title={gettext('Participants')} value={participants} />
        </div>
      </div>
      {isShowKeyboardShortcuts && (
        <KeyboardShortcuts toggle={() => setIsShowKeyboardShortcuts(false)} />
      )}
    </div>
  );
};

export default Ticket;
