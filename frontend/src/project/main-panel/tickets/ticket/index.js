import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from 'reactstrap';
import classnames from 'classnames';
import copy from 'copy-to-clipboard';
import { LongTextInlineEditor, EventBus, EXTERNAL_EVENTS } from '@seafile/seafile-editor';
import { isLongTextValueExceedLimit } from '../../../../utils/long-text';
import { useTickets } from '../../../hooks';
import { CenteredLoading, Icon, IconButton, toaster, Option, EmptyTip } from '../../../../components';
import { TICKET_PAGE_TYPE, TICKET_STATUS_CONFIG } from '../../../constants';
import { gettext, name, username, avatarURL, lang, LONG_TEXT_EXCEED_LIMIT_MESSAGE, mediaUrl } from '../../../../constants';
import { Utils } from '../../../../utils/utils';
import { TICKET_TYPES } from '../../../constants';
import { AssigneesSettings, TagsSettings, TypeSettings } from '../ticket-settings';
import Reply from '../reply';
import StatusToggleButton from './status-toggle-btn';

import './index.css';

const Ticket = ({ editorAPI }) => {
  const { isLoading, metadata, createReply, collaborators, modifyTicket, modifyTicketTags, getRowById, togglePageType } = useTickets();
  const [reply, setReply] = useState('');

  const user = useMemo(() => {
    return {
      name,
      email: username,
      avatar_url: avatarURL
    };
  }, []);

  const ticketID = useMemo(() => metadata.rows[0], [metadata]);
  const ticket = useMemo(() => getRowById(ticketID), [ticketID, getRowById]);

  const replyEditorRef = useRef(null);
  const containerRef = useRef(null);

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

  const onTypeChange = useCallback((type = '') => {
    modifyTicket(ticket.id, { type }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [ticket, modifyTicket]);

  const onTagsChange = useCallback((tags) => {
    modifyTicketTags(ticket.id, tags).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [ticket, modifyTicketTags]);

  const onSubmitReply = useCallback(() => {
    createReply(ticket.id, reply).then(() => {
      const eventBus = EventBus.getInstance();
      eventBus.dispatch(EXTERNAL_EVENTS.CLEAR_ARTICLE);
      setTimeout(() => containerRef.current.scrollTop = 10000000, 1);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [reply, ticket, createReply]);

  if (isLoading) return (<CenteredLoading />);
  if (!ticket) return (<EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('Not found ticket')} />);

  const { id, status, title, creator, replies, participants = [], type, tags } = ticket;
  const typeOption = TICKET_TYPES.find(o => o.id === type);
  const enableEditOtherSettings = creator?.email === user.email;
  const statusOption = TICKET_STATUS_CONFIG[status];

  return (
    <div className="sea-qa-project-ticket">
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
      <div className="sea-qa-project-ticket-content-wrapper" ref={containerRef}>
        <div className="sea-qa-project-ticket-reply-container-wrapper">
          <Reply reply={ticket} isFirst={true} />
          {replies.map(reply => {
            const { id } = reply;
            return (<Reply reply={reply} key={id} />);
          })}
          <Reply className="sea-qa-project-ticket-add-comment" reply={{ creator: user }} >
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
              editorApi={editorAPI}
              onSaveEditorValue={onReplyChange}
            />
          </Reply>
          <div className="sea-qa-project-ticket-footer-btns">
            <StatusToggleButton status={status} onChange={toggleStatus} />
            <Button disabled={!reply.text} color="primary" onClick={onSubmitReply}>{gettext('Comment')}</Button>
          </div>
        </div>
        <div className="sea-qa-project-ticket-other-settings">
          <AssigneesSettings isReadonly={true} value={participants} collaborators={collaborators} />
          <TagsSettings isReadonly={!enableEditOtherSettings} value={tags} onChange={onTagsChange} />
          <TypeSettings isReadonly={!enableEditOtherSettings} value={type} onChange={onTypeChange} />
        </div>
      </div>
    </div>
  );
};

export default Ticket;
