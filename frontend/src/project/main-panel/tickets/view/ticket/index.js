import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'reactstrap';
import classnames from 'classnames';
import copy from 'copy-to-clipboard';
import deepCopy from 'deep-copy';
import { LongTextInlineEditor, EventBus, EXTERNAL_EVENTS } from '@seafile/seafile-editor';
import { isLongTextValueExceedLimit } from '@/utils/long-text';
import { CenteredLoading, Icon, IconButton, toaster, Option, EmptyTip } from '@/components';
import { TICKET_PAGE_TYPE, TICKET_STATUS_CONFIG } from '../../constants';
import {
  gettext, name, username, avatarURL, lang, LONG_TEXT_EXCEED_LIMIT_MESSAGE, mediaUrl,
  PERMISSION_TYPES
} from '@/constants';
import { Utils } from '@/utils/utils';
import { AssigneesSettings, TagsSettings, TypeSettings } from '../../components/ticket-settings';
import Reply from '../../components/reply';
import StatusToggleButton from './status-toggle-btn';
import { ticketsAPI } from '../../../../api';
import { Ticket as TicketModel } from '../../models';
import { useTicketsPage, useTypes } from '../../hooks';
import UploadFilesButton from '../../components/upload-files-btn';
import { getRowById } from '@/sea-metadata/utils/row';

import './index.css';

const Ticket = ({ editorAPI, projectUuid, ticketID, permission }) => {
  const [isLoading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [ticket, setTicket] = useState({});
  const [scrollTop, setScrollTop] = useState(0);

  const { togglePageType } = useTicketsPage();
  const { typesData } = useTypes();

  const user = useMemo(() => {
    return {
      name,
      email: username,
      avatar_url: avatarURL
    };
  }, []);

  const replyEditorRef = useRef(null);
  const containerRef = useRef(null);

  const handleScroll = useCallback(Utils.throttle((event) => {
    if (!event) return;
    setScrollTop(event.target.scrollTop);
  }, 30), []);

  // api
  const modifyTicket = useCallback((ticketID, data) => {
    return ticketsAPI.modifyProjectTicket(projectUuid, ticketID, data).then(res => {
      const newTicket = ticket._update(data);
      setTicket(deepCopy(newTicket));
      return data;
    });
  }, [ticket]);

  const createReply = useCallback((ticketID, reply) => {
    return ticketsAPI.createProjectTicketReply(projectUuid, ticketID, reply).then(res => {
      const newTicket = ticket._create_reply(res.data.ticket_reply);
      setTicket(newTicket);
      return res.data.ticket_reply;
    });
  }, [ticket]);

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

  const toggleStatus = useCallback((status = '') => {
    modifyTicket(ticket.id, { status }).then(res => {
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
    return ticketsAPI.modifyProjectTicket(projectUuid, ticket.id, { tags }).then(res => {
      const newTicket = ticket._update({ tags: deepCopy(tags) });
      setTicket(deepCopy(newTicket));
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [ticket]);

  const handleFiles = useCallback((files) => {
    if (files.length === 0) return;
    const eventBus = EventBus.getInstance();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImage = /image/i.test(file.type);
      const fileName = file.name;
      editorAPI.uploadLocalImage(file).then(url => {
        eventBus.dispatch(EXTERNAL_EVENTS.INSERT_IMAGE, { title: fileName, url, isImage });
      });
    }
  }, [editorAPI]);

  const onSubmitReply = useCallback(() => {
    createReply(ticket.id, reply).then(() => {
      const eventBus = EventBus.getInstance();
      eventBus.dispatch(EXTERNAL_EVENTS.CLEAR_ARTICLE);
      setTimeout(() => {
        containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
      }, 1);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [reply, ticket, createReply]);

  useEffect(() => {
    setLoading(true);
    setTicket({});
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

  if (isLoading) return (<CenteredLoading />);
  if (!ticket) return (<EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('Not found ticket')} />);
  const { id, status, title, creator, replies, assignees = [], type, tags } = ticket;
  const typeOption = getRowById(typesData, type);
  const editable = creator === user.email || permission === PERMISSION_TYPES.READ_WRITE;
  const statusOption = TICKET_STATUS_CONFIG[status];

  return (
    <div className="sea-qa-project-ticket" onScroll={handleScroll}>
      <div className="sea-qa-project-ticket-header">
        <div className="sea-qa-project-ticket-header-left">
          <div className="sea-qa-project-ticket-title-number">
            <span className="sea-qa-project-ticket-title">{title}</span>
            <span className="sea-qa-project-ticket-number ml-1">{`#${id}`}</span>
          </div>
        </div>
        <div className="sea-qa-project-ticket-header-right">
          <Button color="primary" onClick={() => togglePageType(TICKET_PAGE_TYPE.NEW)}>{gettext('New ticket')}</Button>
          <IconButton icon="copy" className="sea-qa-project-ticket-copy ml-1" onClick={copyLink} />
        </div>
      </div>
      <div className="sea-qa-project-ticket-status-wrapper">
        <div className={classnames('sea-qa-project-ticket-status', status)}>
          <Icon symbol={statusOption?.icon} />
          <span>{statusOption?.statusName}</span>
        </div>
        {typeOption && (<Option className="sea-qa-project-ticket-status ml-3" option={typeOption} />)}
      </div>
      <div className={classnames('sea-qa-project-ticket-simple-info-wrapper-sticky', { 'd-none': scrollTop < 121, 'd-flex': scrollTop >= 121 })}>
        <div className={classnames('sea-qa-project-ticket-status', status)}>
          <Icon symbol={statusOption?.icon} />
          <span>{statusOption?.statusName}</span>
        </div>
        <div className="sea-qa-project-ticket-title-number-type">
          <div className="sea-qa-project-ticket-title-number">
            <span className="sea-qa-project-ticket-title">{title}</span>
            <span className="sea-qa-project-ticket-number ml-1">{`#${id}`}</span>
          </div>
          {typeOption && (<div className="text-truncate w-100">{typeOption.name}</div>)}
        </div>
        <IconButton icon="copy" className="sea-qa-project-ticket-copy ml-1" onClick={copyLink} />
      </div>
      <div className="sea-qa-project-ticket-content-wrapper" ref={containerRef}>
        <div className="sea-qa-project-ticket-reply-container-wrapper">
          <Reply reply={ticket} isFirst={true} />
          {replies.map(reply => {
            const { id } = reply;
            return (<Reply reply={reply} key={id} projectUuid={projectUuid} />);
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
              <StatusToggleButton status={status} onChange={toggleStatus} />
              <Button disabled={!reply.text} color="primary" onClick={onSubmitReply}>{gettext('Comment')}</Button>
            </div>
          </div>
        </div>
        <div className="sea-qa-project-ticket-other-settings">
          <AssigneesSettings isReadonly={!editable} value={assignees} onChange={onAssigneesChange} />
          <TagsSettings isReadonly={!editable} value={tags} onChange={onTagsChange} />
          <TypeSettings isReadonly={!editable} value={type} onChange={onTypeChange} />
        </div>
      </div>
    </div>
  );
};

export default Ticket;
