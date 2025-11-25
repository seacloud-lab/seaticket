import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'reactstrap';
import classnames from 'classnames';
import copy from 'copy-to-clipboard';
import deepCopy from 'deep-copy';
import { LongTextInlineEditor, EventBus, EXTERNAL_EVENTS } from '@seafile/seafile-editor';
import { isLongTextValueExceedLimit } from '@/utils/long-text';
import { CenteredLoading, toaster, EmptyTip } from '@/components';
import { TICKET_STATE_CONFIG } from '../../constants';
import {
  gettext, name, username, avatarURL, lang, LONG_TEXT_EXCEED_LIMIT_MESSAGE, mediaUrl,
  PERMISSION_TYPES
} from '@/constants';
import { Utils } from '@/utils/utils';
import { CollaboratorsSettings, TagsSettings, TypeSettings, RateSettings } from '../../components/ticket-settings';
import Reply from '../../components/reply';
import StatusToggleButton from './status-toggle-btn';
import { ticketsAPI } from '../../../../api';
import { Ticket as TicketModel } from '../../models';
import { useDataCache, useMetadata } from '../../hooks';
import UploadFilesButton from '../../components/upload-files-btn';
import { getRowById, getRowsByIds } from '@/sea-metadata/utils/row';
import Header from './header';

import './index.css';

const Ticket = ({ editorAPI, projectUuid, ticketID, permission, isAdmin }) => {
  const [isLoading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [ticket, setTicket] = useState(null);
  const [isShowStickyHeader, setIsShowStickyHeader] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { isLoading: isMetadataLoading, typesData, tagsData } = useMetadata();
  const { updateCacheData } = useDataCache();

  const user = useMemo(() => {
    return {
      name,
      email: username,
      avatar_url: avatarURL
    };
  }, []);

  const replyEditorRef = useRef(null);
  const containerRef = useRef(null);
  const headerRef = useRef(null);

  const handleScroll = useCallback(Utils.throttle((event) => {
    if (!event) return;
    const dom = headerRef.current.getDom();
    const { height } = dom.getBoundingClientRect();
    setIsShowStickyHeader(event.target.scrollTop > height);
  }, 30), [headerRef]);

  const handleUpdateRowsCacheData = useCallback((ticketID, update) => {
    updateCacheData('rows', String(ticketID), update, true);
  }, [updateCacheData]);

  // api
  const modifyTicket = useCallback((ticketID, data) => {
    let serverData = {};

    Object.keys(data).forEach(columnName => {
      let value = data[columnName];
      if (columnName === 'tags' && Array.isArray(value) && value.length > 0) {
        const tags = getRowsByIds(tagsData, value);
        value = tags.map(tag => tag.name);
      } else if (columnName === 'type' && value) {
        const typeOption = getRowById(typesData, value);
        value = typeOption.name;
      } else if (columnName === 'state' && value) {
        value = value === '0001' ? 'open' : 'closed';
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
  }, [projectUuid, ticket, user, tagsData, typesData, handleUpdateRowsCacheData]);

  const handleUpdateParticipants = useCallback((ticket) => {
    const { participants = [] } = ticket;
    if (!participants.includes(user.email)) {
      const update = { 'participants': [...participants, user.email] };
      ticket = ticket._update(update);
      handleUpdateRowsCacheData(String(ticket._id), update);
    }
  }, [user, handleUpdateRowsCacheData]);

  const createReply = useCallback((ticketID, reply) => {
    return ticketsAPI.createProjectTicketReply(projectUuid, ticketID, reply).then(res => {
      let newTicket = ticket._create_reply(res.data.ticket_reply);
      handleUpdateParticipants(newTicket);
      setTicket(deepCopy(newTicket));
      return res.data.ticket_reply;
    });
  }, [projectUuid, ticket, handleUpdateParticipants]);

  const modifyReply = useCallback((ticketID, replyID, reply) => {
    return ticketsAPI.modifyProjectTicketReply(projectUuid, ticketID, replyID, reply).then(res => {
      let newTicket = ticket._modify_reply(replyID, reply);
      handleUpdateParticipants(newTicket);
      setTicket(deepCopy(newTicket));
      return newTicket;
    });
  }, [projectUuid, ticket, handleUpdateParticipants]);

  const deleteReply = useCallback((ticketID, replyID) => {
    return ticketsAPI.deleteProjectTicketReply(projectUuid, ticketID, replyID).then(res => {
      let newTicket = ticket._delete_reply(replyID);
      handleUpdateParticipants(newTicket);
      setTicket(deepCopy(newTicket));
      return newTicket;
    });
  }, [projectUuid, ticket, handleUpdateParticipants]);

  const copyLink = useCallback(() => {
    copy(window.location.href);
    toaster.success(gettext('The ticket link has been copied'));
  }, []);

  const onReplyChange = useCallback((value) => {
    if (isLongTextValueExceedLimit(value)) {
      toaster.closeAll();
      toaster.danger(LONG_TEXT_EXCEED_LIMIT_MESSAGE, { duration: null });
      return;
    }
    setReply(value);
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

  const onTypeChange = useCallback((type = '') => {
    modifyTicket(ticket.id, { type }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [ticket, modifyTicket]);

  const onTagsChange = useCallback((tags) => {
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
    const editor = replyEditorRef.current.getEditor();
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

  const onSubmitReply = useCallback((callback) => {
    setIsSubmitting(true);
    createReply(ticket.id, reply).then(() => {
      const editor = replyEditorRef.current.getEditor();
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
  }, [reply, ticket, replyEditorRef, createReply]);

  const toggleState = useCallback((state = '') => {
    const modifyState = () => {
      modifyTicket(ticket.id, { state }).then(res => {
        // todo
      }).catch(error => {
        const errorMessage = Utils.getErrorMsg(error);
        toaster.danger(errorMessage);
      });
    };
    if (reply && reply?.text) {
      onSubmitReply(modifyState);
      return;
    }

    modifyState();
  }, [ticket, reply, modifyTicket, onSubmitReply]);

  const handleModifyReply = useCallback((replyID, content, callback) => {
    modifyReply(ticket.id, replyID, content).then(res => {
      callback && callback();
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      callback && callback(error);
    });
  }, [ticket, modifyReply]);

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

  if (isLoading || isMetadataLoading) return (<CenteredLoading />);
  if (!ticket) return (<EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('Not found ticket')} />);
  const { id, state, title, creator, replies = [], assignees = [], type, tags, priority, participants = [] } = ticket;
  const typeOption = getRowById(typesData, type);
  const editable = creator === user.email || permission === PERMISSION_TYPES.READ_WRITE;
  const stateOption = TICKET_STATE_CONFIG[state];

  return (
    <div className="sea-qa-project-ticket" onScroll={handleScroll}>
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
        <div className="sea-qa-project-ticket-reply-container-wrapper">
          <Reply
            reply={ticket}
            isShowStatus={true}
            readonly={!editable}
            lang={lang}
            editorAPI={editorAPI}
            onModify={onContentChange}
          />
          {replies.map(reply => {
            return (
              <Reply
                key={reply.id}
                readonly={!(reply.creator === user.email || isAdmin)}
                reply={reply}
                projectUuid={projectUuid}
                editorAPI={editorAPI}
                onDelete={(reply) => deleteReply(id, reply.id)}
                onModify={(content, callback) => handleModifyReply(reply.id, content, callback)}
              />
            );
          })}
          <Reply className="sea-qa-project-ticket-add-comment" reply={{ creator: username }} >
            <span className="sea-qa-project-ticket-add-comment-title">{gettext('Add a comment')}</span>
            <LongTextInlineEditor
              isAlwaysEnableEdit={true}
              ref={replyEditorRef}
              lang={lang}
              headerName={gettext('Reply')}
              value={reply || ''}
              autoSave={false}
              saveDelay={20 * 1000}
              isCheckBrowser={true}
              isImageUploadOnly={false}
              isSupportMultipleFiles={true}
              editorApi={editorAPI}
              onSaveEditorValue={onReplyChange}
            />
          </Reply>
          <div className="sea-qa-project-ticket-footer">
            <UploadFilesButton onChange={handleFiles} />
            <div className="ml-2">
              <StatusToggleButton state={state} disabled={isSubmitting} onChange={toggleState} />
              <Button
                className="sea-qa-project-ticket-footer-confirm-btn"
                disabled={!reply.text || isSubmitting}
                color="primary"
                onClick={() => onSubmitReply()}
              >
                {isSubmitting ? (<CenteredLoading />) : gettext('Comment')}
              </Button>
            </div>
          </div>
        </div>
        <div className="sea-qa-project-ticket-other-settings">
          <RateSettings isReadonly={!editable} value={priority} onChange={onPriorityChange} />
          <CollaboratorsSettings isReadonly={!editable} title={gettext('Assignees')} value={assignees} onChange={onAssigneesChange} />
          <TagsSettings isReadonly={!editable} value={tags} onChange={onTagsChange} />
          <TypeSettings isReadonly={!editable} value={type} onChange={onTypeChange} />
          <CollaboratorsSettings isReadonly={true} title={gettext('Participants')} value={participants} />
        </div>
      </div>
    </div>
  );
};

export default Ticket;
