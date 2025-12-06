import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'reactstrap';
import classnames from 'classnames';
import copy from 'copy-to-clipboard';
import deepCopy from 'deep-copy';
import { LongTextInlineEditor, EventBus, EXTERNAL_EVENTS } from '@seafile/seafile-editor';
import { isLongTextValueExceedLimit } from '@/utils/long-text';
import { CenteredLoading, toaster, EmptyTip } from '@/components';
// import { TICKET_STATE_CONFIG, PREDEFINED_TICKET_COLUMN_NAME } from '../../../tickets/constants';
import {
  gettext, name, username, avatarURL, lang, LONG_TEXT_EXCEED_LIMIT_MESSAGE, mediaUrl,
  PERMISSION_TYPES
} from '@/constants';
import { Utils } from '@/utils/utils';
import Comment from '../../../tickets/components/comment';
// import StatusToggleButton from './status-toggle-btn';
import { ticketsAPI } from '../../../../api';
import { knowledgeBaseAPI } from '@/project/api';
// import { Ticket as TicketModel } from '../../models';
// import { useDataCache, useMetadata } from '../../hooks';
// import UploadFilesButton from '../../components/upload-files-btn';
import { getRowById, getRowsByIds } from '@/sea-metadata/utils/row';
import Header from './header';

import './index.css';

const EditKnowledge = ({ editorAPI, projectUuid, knowledgeID, permission, isAdmin }) => {
  const [isLoading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [knowledge, setKnowledge] = useState(null);
  const [isShowStickyHeader, setIsShowStickyHeader] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  // const { isLoading: isMetadataLoading, tagsData, statesData, substatesData } = useMetadata();
  // const { updateCacheData } = useDataCache();

  const user = useMemo(() => {
    return {
      name,
      email: username,
      avatar_url: avatarURL
    };
  }, []);

  const knowledgeRef = useRef(null);
  const commentEditorRef = useRef(null);
  const containerRef = useRef(null);
  const headerRef = useRef(null);

  const handleScroll = useCallback((event) => {
    if (!event) return;
    const dom = headerRef.current.getDom();
    const { height } = dom.getBoundingClientRect();
    setIsShowStickyHeader(event.target.scrollTop > height);
  }, [headerRef]);

  const handleUpdateRowsCacheData = useCallback((knowledgeID, update) => {
    // updateCacheData('rows', String(knowledgeID), update, true);
  }, []);

  // api
  const modifyTicket = useCallback((knowledgeID, data) => {
    let serverData = {};

    return ticketsAPI.modifyProjectTicket(projectUuid, knowledgeID, serverData).then(res => {
      let update = { ...data };
      const { participants = [] } = knowledge;
      if (!participants.includes(user.email)) {
        update['participants'] = [...participants, user.email];
      }
      const newTicket = knowledge._update(update);
      handleUpdateRowsCacheData(String(knowledgeID), update);
      setKnowledge(deepCopy(newTicket));
      return data;
    });
  }, [projectUuid, knowledge, user, handleUpdateRowsCacheData]);

  const createComment = useCallback((knowledgeID, comment) => {
    return ticketsAPI.createProjectTicketComment(projectUuid, knowledgeID, comment).then(res => {
      let newTicket = knowledge._create_comment(res.data.ticket_comment);
      setKnowledge(deepCopy(newTicket));
      return res.data.ticket_comment;
    });
  }, [projectUuid, knowledge]);

  const modifyComment = useCallback((knowledgeID, commentID, comment) => {
    return ticketsAPI.modifyProjectTicketComment(projectUuid, knowledgeID, commentID, comment).then(res => {
      let newTicket = knowledge._modify_comment(commentID, comment);
      setKnowledge(deepCopy(newTicket));
      return newTicket;
    });
  }, [projectUuid, knowledge]);

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

  // const onContentChange = useCallback((content, callback) => {
  //   modifyTicket(ticket.id, { content }).then(res => {
  //     callback && callback();
  //   }).catch(error => {
  //     const errorMessage = Utils.getErrorMsg(error);
  //     toaster.danger(errorMessage);
  //     callback && callback(error);
  //   });
  // }, [ticket, modifyTicket]);

  const modifyQuestion = useCallback((title, callback) => {
    modifyTicket(knowledge.id, { title }).then(res => {
      callback && callback();
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      callback && callback(error);
    });
  }, [knowledge, modifyTicket]);

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
    createComment(knowledge.id, comment).then(() => {
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
  }, [comment, knowledge, commentEditorRef, createComment]);

  const toggleState = useCallback((state = '', substate = '') => {
    const modifyState = () => {
      modifyTicket(knowledge.id, { state, substate }).then(res => {
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
  }, [knowledge, comment, modifyTicket, onSubmitComment]);

  const handleModifyComment = useCallback((commentID, content, callback) => {
    modifyComment(knowledge.id, commentID, content).then(res => {
      callback && callback();
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      callback && callback(error);
    });
  }, [knowledge, modifyComment]);

  useEffect(() => {
    setLoading(true);
    setKnowledge(null);
    knowledgeBaseAPI.getRecord(projectUuid, knowledgeID).then(res => {
      console.log('res', res);
      setKnowledge(res.data.record);
      setLoading(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setLoading(false);
    });
  }, [projectUuid, knowledgeID]);

  useEffect(() => {
    if (isLoading || !knowledge) return;
    const knowledgeDom = knowledgeRef.current;
    const handleResize = () => {
      if (!knowledgeDom) return;
      setContainerWidth(knowledgeDom.offsetWidth);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    knowledgeDom && resizeObserver.observe(knowledgeDom);

    return () => {
      knowledgeDom && resizeObserver.unobserve(knowledgeDom);
    };
  }, [isLoading, knowledge]);

  if (isLoading) return (<CenteredLoading />);
  if (!knowledge) return (<EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('Not found ticket')} />);

  const { _pk, state, question, creator, comments = [], assignees = [], type, tags, priority, participants = [], substate } = knowledge;
  // const typeOption = getRowById(typesData, type);
  const editable = creator === user.email || permission === PERMISSION_TYPES.READ_WRITE;
  // const stateOption = TICKET_STATE_CONFIG[state];

  // 904: comment min-width(596) + others min-width(260) + gap: 16 * 3
  const isSmallScreen = containerWidth < 904;

  return (
    <div
      className={classnames('sea-qa-project-knowledge', { 'small': isSmallScreen })}
      onScroll={handleScroll}
      ref={knowledgeRef}
    >
      <Header
        ref={headerRef}
        readonly={!editable}
        question={question}
        id={_pk}
        copyLink={copyLink}
        modifyQuestion={modifyQuestion}
      />
      <Header
        className={classnames('sea-qa-project-knowledge-simple-info-wrapper-sticky', { 'd-none': !isShowStickyHeader })}
        question={question}
        id={_pk}
      />
      <div className="sea-qa-project-knowledge-content-wrapper" ref={containerRef}>
        <div className="sea-qa-project-ticket-comment-container-wrapper">
          {/* <Comment className="sea-qa-project-ticket-add-comment mb-0" isSmallScreen={isSmallScreen} comment={{ creator: username }}> */}
          <span className="sea-qa-project-ticket-add-comment-title">{gettext('Add a comment')}</span>
          {/* <LongTextInlineEditor
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
          /> */}
          {/* </Comment> */}
          <div className="sea-qa-project-ticket-footer">
            {/* <UploadFilesButton className="mt-4" onChange={handleFiles} /> */}
            <div className="sea-qa-project-ticket-submit-btns ml-2">
              {/* <StatusToggleButton state={state} substate={substate} comment={comment?.text} disabled={isSubmitting} onChange={toggleState} /> */}
              {/* <Button
                className="sea-qa-project-ticket-footer-confirm-btn"
                disabled={!comment.text || isSubmitting}
                color="primary"
                onClick={() => onSubmitComment()}
              >
                {isSubmitting ? (<CenteredLoading />) : gettext('Comment')}
              </Button> */}
            </div>
          </div>
        </div>
        <div className="sea-qa-project-ticket-other-settings"></div>
      </div>
    </div>
  );
};

export default EditKnowledge;
