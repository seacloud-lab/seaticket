import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Button, Label } from 'reactstrap';
import classnames from 'classnames';
import copy from 'copy-to-clipboard';
import { LongTextInlineEditor } from '@seafile/seafile-editor';
import { isLongTextValueExceedLimit } from '../../../../utils/long-text';
import { useTickets } from '../../../hooks';
import { CenteredLoading, Icon, IconButton, CustomizeMarkdownViewer, toaster, Collaborator, Option } from '../../../../components';
import { TICKET_STATUS } from '../../../constants';
import { gettext, name, username, avatarURL, lang, LONG_TEXT_EXCEED_LIMIT_MESSAGE } from '../../../../constants';
import { seaQAAPI } from '../../../../api/web-api';
import { Utils } from '../../../../utils/utils';
import { TICKET_TYPES } from '../../../constants';

import './index.css';

const {
  projectUuid,
} = window.app.pageOptions;

const Ticket = ({ togglePage }) => {
  const { isLoading, metadata } = useTickets();
  const [reply, setReply] = useState('');

  const user = useMemo(() => {
    return {
      name,
      username,
      avatar_url: avatarURL
    };
  }, []);
  const ticket = useMemo(() => {
    return metadata.rows[0];
  }, [metadata]);

  const replyEditorRef = useRef(null);

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

  const onSubmitReply = useCallback(() => {
    seaQAAPI.createProjectTicketReply(projectUuid, ticket.id, reply ? reply.text : '').then(res => {
      ticket.create_reply(res.data.ticket_reply);
      setReply('');
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [reply, ticket]);

  if (isLoading) return (<CenteredLoading />);

  const { id, status, title, creator, created_at, content, replies, participants = [], type } = ticket;
  const isOpen = status === '' || status === TICKET_STATUS.OPEN;
  const typeOption = TICKET_TYPES.find(o => o.id === type);

  return (
    <div className="sea-qa-project-ticket">
      <div className="sea-qa-project-ticket-header">
        <div className="sea-qa-project-ticket-header-left">
          <div className="sea-qa-project-ticket-title-number">
            <span className="sea-qa-project-ticket-title">{title}</span>
            <span className="sea-qa-project-ticket-number">{`#${id}`}</span>
          </div>
        </div>
        <div className="sea-qa-project-ticket-header-right">
          <Button color="primary" onClick={() => togglePage('new')}>{gettext('New ticket')}</Button>
          <IconButton icon="copy" className="sea-qa-project-ticket-copy ml-1" onClick={copyLink} />
        </div>
      </div>
      <div className="sea-qa-project-ticket-status-wrapper">
        <div className={classnames('sea-qa-project-ticket-status', { 'open': isOpen })}>
          <Icon symbol={isOpen ? 'circle-dot' : 'circle-check'} />
          <span>{isOpen ? gettext('Open') : gettext('Close')}</span>
        </div>
      </div>
      <div className="sea-qa-project-ticket-content-wrapper">
        <div className="sea-qa-project-ticket-main-content-wrapper">
          <div className="sea-qa-project-ticket-main-content-item">
            <div className="sea-qa-project-ticket-main-content-user-avatar">
              <img src={creator.avatar_url} alt={creator.name} />
            </div>
            <div className="sea-qa-project-ticket-main-content">
              <div className="sea-qa-project-ticket-main-content-op">
                <span className="sea-qa-project-ticket-main-content-user-name mr-1">{creator.name}</span>
                <span className="sea-qa-project-ticket-main-content-status mr-1">{gettext('Opened')}</span>
                <span className="sea-qa-project-ticket-main-content-time">{created_at}</span>
              </div>
              <div className="sea-qa-project-ticket-main-content-content">
                <CustomizeMarkdownViewer value={content} showTOC={false} />
              </div>
            </div>
          </div>
          {replies.map(reply => {
            const { creator, created_at, content, id } = reply;
            return (
              <div className="sea-qa-project-ticket-main-content-item" key={id}>
                <div className="sea-qa-project-ticket-main-content-user-avatar">
                  <img src={creator.avatar_url} alt={creator.name} />
                </div>
                <div className="sea-qa-project-ticket-main-content">
                  <div className="sea-qa-project-ticket-main-content-op">
                    <span className="sea-qa-project-ticket-main-content-user-name mr-1">{creator.name}</span>
                    <span className="sea-qa-project-ticket-main-content-status mr-1">{gettext('Opened')}</span>
                    <span className="sea-qa-project-ticket-main-content-time">{created_at}</span>
                  </div>
                  <div className="sea-qa-project-ticket-main-content-content">
                    <CustomizeMarkdownViewer value={content} showTOC={false} />
                  </div>
                </div>
              </div>
            );
          })}
          <div className="sea-qa-project-ticket-main-content-item sea-qa-project-ticket-add-comment-content">
            <div className="sea-qa-project-ticket-main-content-user-avatar">
              <img src={user.avatar_url} alt={user.name} />
            </div>
            <div className="sea-qa-project-ticket-main-content">
              <div className="sea-qa-project-ticket-main-content-op">
                <span className="sea-qa-project-ticket-main-content-add-comment">{gettext('Add a comment')}</span>
              </div>
              <div className="sea-qa-project-ticket-main-content-content">
                <LongTextInlineEditor
                  isAlwaysEnableEdit={true}
                  ref={replyEditorRef}
                  lang={lang}
                  headerName={gettext('Reply')}
                  value={reply || ''}
                  autoSave={true}
                  saveDelay={20 * 1000}
                  isCheckBrowser={true}
                  onSaveEditorValue={onReplyChange}
                />
              </div>
            </div>
          </div>
          <div className="sea-qa-project-ticket-comment-close">
            <Button className="mr-4" disabled={!isOpen}>{gettext('Close')}</Button>
            <Button disabled={!reply.text} color="primary" onClick={onSubmitReply}>{gettext('Comment')}</Button>
          </div>
        </div>
        <div className="sea-qa-project-ticket-other-settings">
          <div className="sea-qa-project-ticket-settings-item mb-4">
            <Label>{gettext('Assignees')}</Label>
            <div className="collaborators-formatter">
              {participants.length > 0 ? participants.map(assignee => {
                return (
                  <Collaborator collaborator={assignee} key={assignee.email} />
                );
              }) : (<div className="tip-default">{gettext('No one assigned')}</div>)}
            </div>
          </div>
          <div className="sea-qa-project-ticket-settings-item mb-4">
            <Label>{gettext('Labels')}</Label>
            <div className="labels-formatter">
              <div className="tip-default">{gettext('Not support(todo)')}</div>
            </div>
          </div>
          <div className="sea-qa-project-ticket-settings-item mb-4">
            <Label>{gettext('Type')}</Label>
            <div className="ticket-types-formatter">
              {typeOption ? (<Option option={typeOption} />) : (<div className="tip-default">{gettext('No type')}</div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Ticket;
