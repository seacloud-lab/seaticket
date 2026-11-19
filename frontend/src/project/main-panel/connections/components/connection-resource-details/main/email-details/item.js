import React, { useCallback, useEffect, useMemo, useRef, useState, Fragment } from 'react';
import classnames from 'classnames';
import { CustomizeMarkdownViewer, IconTextBtn, IconTooltip, toaster, IconButton } from '@/components';
import { gettext, mediaUrl, PERMISSION_TYPES } from '@/constants';
import { connectionsAPI } from '@/project/api';
import dayjs from '@/utils/dayjs';
import { isString } from '@/utils/type-detection';
import { Utils } from '@/utils/utils';
import { parseEmailAddress, splitEmailAddresses } from '@/utils/validate';
import { generatorConnectionAssetURLPrefix } from '../../../../utils';
import DateFormatter from '../../../cell-formatter/date-formatter';
import HTMLContentWrapper from './html-content';
import ReplyEmail from './reply-email';

import './index.css';

const EmailUser = ({ emailAddress, isShowEmail = true }) => {
  const { username, email } = parseEmailAddress(emailAddress);
  return (
    <span
      title={emailAddress}
      className="font-size-14"
      onClick={(event) => {event.stopPropagation(); event.nativeEvent.stopImmediatePropagation();}}
    >
      {(isShowEmail && username) ? (
        <>
          <span>{username}</span>
          <span className="text-secondary">{` <${email}>`}</span>
        </>
      ) : (
        <>
          {username || email}
        </>
      )}
    </span>
  );
};

const ParticipantsCategory = ({ category, value, isShowEmail = true }) => {
  return (
    <div className="email-record-info-participants-category d-flex gap-1">
      <div className="email-record-info-participants-category-title flex-shrink-0">{`${category}: `}</div>
      <div className="email-record-info-participants-category-value flex-1 text-truncate">
        {value.map((emailAddress, index) => (
          <Fragment key={emailAddress || index}>
            {index !== 0 && (<span>{', '}</span>)}
            <EmailUser key={emailAddress} emailAddress={emailAddress} isShowEmail={isShowEmail} />
          </Fragment>
        ))}
      </div>
    </div>
  );
};

const Item = ({
  isLast, isExpand,
  detail, projectUuid, connection_id, setIsLastExpanded, recordId, permission,
  handleReplyEmailSuccess, onUnreadChange, isPortal = false, threadId,
}) => {
  const [isExpanded, setIsExpanded] = useState(isExpand);
  const [isShowReply, setIsShowReply] = useState(false);
  const [isUpdatingUnread, setIsUpdatingUnread] = useState(false);
  const [isParticipantsExpanded, setIsParticipantsExpanded] = useState(false);

  const ref = useRef(null);
  const replySendTo = useRef('');
  const expandedRef = useRef(null);

  const content = useMemo(() => detail.content || '', [detail.content]);
  const HTMLContent = useMemo(() => detail.html_content || '', [detail.html_content]);
  const isHTMLContent = useMemo(() => HTMLContent ? true : false, [HTMLContent]);
  const { sender, email } = useMemo(() => {
    const { username, email } = parseEmailAddress(detail['email_from']);
    return { sender: username || email, email };
  }, [detail]);
  const isReadonly = useMemo(() => permission === PERMISSION_TYPES.READ_ONLY, [permission]);
  const isUnread = Boolean(detail.unread);

  const contentStart = useMemo(() => {
    const hrefReg = /\[.+\]\(\S+\)|<img( width=[\\|/]?"(\d)+[\\|/|]?")? src="(\S+)" .?\/>|!\[\]\(\S+\)|!\[\]\((\S+)\)|<\S+>/g;
    let value = content ? content.replace(hrefReg, '').replace(/\r\n?|\n/g, ' ').substring(0, 150) : '';
    const emailText = email || '';
    const emailDomain = emailText.trim().toLowerCase().match(/^[^@\s<>]+@([^@\s<>]+)$/)?.[1];
    const isGitLog = emailDomain === 'github.com' || emailDomain === 'gitlab.com';
    if (!isGitLog) return value;
    if (value.startsWith(`@${sender}`)) {
      value = value.replace(`@${sender}`, '');
    }
    return value.charAt(0).toLowerCase() + value.slice(1);
  }, [content, sender, email]);

  const detailContent = useMemo(() => {
    const value = isHTMLContent ? HTMLContent : content;
    if (!isHTMLContent) return value;
    let trimmedValue = value.trim();
    if (trimmedValue.startsWith('```') && trimmedValue.endsWith('```')) {
      trimmedValue = trimmedValue.substring(3, trimmedValue.length - 3);
    }
    return trimmedValue;
  }, [isHTMLContent, content, HTMLContent]);

  const emailTo = useMemo(() => splitEmailAddresses(detail['email_to']), [detail]);
  const emailCc = useMemo(() => splitEmailAddresses(detail['cc']), [detail]);

  const toggleParticipantsExpanded = useCallback((event) => {
    event.stopPropagation();
    event.nativeEvent?.stopImmediatePropagation?.();
    setIsParticipantsExpanded(value => !value);
  }, []);

  const addQuoteToggleBtn = useCallback(() => {
    if (!ref.current || ref.current.querySelector('.email-item-toggle-btn')) return;
    const quotedEmails = ref.current.getElementsByTagName('blockquote');
    if (quotedEmails.length) {
      let qt = quotedEmails[0];
      let qtPrev = qt?.previousElementSibling;
      // handle special case
      if (!qtPrev) {
        qt = quotedEmails[1];
        qtPrev = qt?.previousElementSibling;
        if (!qtPrev) return;
      }

      const btn = document.createElement('div');
      btn.className = 'seaqa-icon-btn email-item-toggle-btn';
      btn.innerHTML = `<svg t="1751443664495" class="seaqa-icon-svg" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="7016" xmlns:xlink="http://www.w3.org/1999/xlink" width="200" height="200">
        <path d="M768 512c0 54.4 41.6 96 96 96s96-41.6 96-96-41.6-96-96-96-96 41.6-96 96z m-352 0c0 54.4 41.6 96 96 96s96-41.6 96-96-41.6-96-96-96-96 41.6-96 96z m-352 6.4c0 54.4 41.6 96 96 96s96-41.6 96-96-41.6-96-96-96-96 44.8-96 96z" p-id="7017"></path>
      </svg>`;
      if (!qt?.parentNode) return;
      qt.parentNode.insertBefore(btn, qtPrev);
      qt.style.display = 'none';
      qtPrev.style.display = 'none';
      btn.addEventListener('click', function () {
        if (qt.style.display === 'none') {
          qt.style.display = 'block';
          qtPrev.style.display = 'block';
        } else {
          qt.style.display = 'none';
          qtPrev.style.display = 'none';
        }
      });
    }
  }, []);

  const openExpanded = useCallback(() => {
    setIsExpanded(true);
  }, []);

  const closeExpanded = useCallback(() => {
    setIsExpanded(false);
    setIsParticipantsExpanded(false);
  }, []);

  const openReply = useCallback((event) => {
    if (isReadonly || isPortal) return;
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    setIsParticipantsExpanded(false);
    setIsShowReply(true);
  }, [isPortal, isReadonly]);

  const openReplyByEmail = useCallback((sendTo = '') => {
    if (isReadonly || isPortal) return;
    replySendTo.current = sendTo;
    setIsParticipantsExpanded(false);
    setIsShowReply(true);
  }, [isPortal, isReadonly]);

  const updateUnread = useCallback((nextUnread) => {
    if (isReadonly || isUpdatingUnread) return;

    onUnreadChange?.(detail._pk, nextUnread);
    setIsUpdatingUnread(true);
    connectionsAPI.unreadConnectionEmail(projectUuid, connection_id, {
      record_id: detail._pk,
      unread: nextUnread,
    }).catch((error) => {
      onUnreadChange?.(detail._pk, !nextUnread);
      toaster.danger(Utils.getErrorMsg(error));
    }).finally(() => {
      setIsUpdatingUnread(false);
    });
  }, [projectUuid, connection_id, detail._pk, isReadonly, isUpdatingUnread, onUnreadChange]);

  const toggleUnread = useCallback((event) => {
    event.stopPropagation();
    event.nativeEvent?.stopImmediatePropagation?.();
    updateUnread(!isUnread);
  }, [isUnread, updateUnread]);

  const onSubmit = useCallback(({ to, cc, content }, callback) => {
    if (isReadonly || isPortal) return;
    const payload = {
      html_content: content,
      to: to.join(','),
      cc: cc.join(','),
      email_id: detail._pk,
    };
    connectionsAPI.replyConnectionEmail(projectUuid, connection_id, payload).then((res) => {
      callback && callback();
      res.data.reply_to_pk = detail._pk;
      handleReplyEmailSuccess(res.data);
    }).catch((error) => {
      toaster.danger(Utils.getErrorMsg(error));
      callback && callback(true);
    });
  }, [projectUuid, detail, connection_id, handleReplyEmailSuccess, isPortal, isReadonly]);

  const renderReply = useCallback(() => {
    const sendTime = dayjs(detail.modified_time, 'YYYY-MM-DD HH:mm').locale('en');
    const tip = `On ${sendTime.format('ddd')}, ${sendTime.format('ll')}, at ${sendTime.format('LT')}, ${sender} wrote:`;

    let initValue = '';
    if (isHTMLContent) {
      initValue = '<div></div><div></div><div></div>';
      const parsed = new DOMParser().parseFromString(detailContent, 'text/html');
      const body = parsed.body;
      let quotedContent = body.innerHTML;
      if (quotedContent.startsWith('```')) {
        quotedContent = quotedContent.slice(3,);
        quotedContent = '<div>```</div>' + quotedContent;
      }
      initValue += '<div style="outline: 0;">';
      initValue += `<div>${tip}</div>`;
      initValue += `<blockquote style="margin: 0px 0px 0px 0.8ex; border-left: 2px solid rgba(0, 40, 100, .12); padding-left: 1ex;">${quotedContent}</blockquote>`;
      initValue += '</div>';
    } else {
      initValue = '\n\n\n';
      initValue += `${tip}\n`;
      initValue += `> ${detailContent.replace(/\r\n/g, '\n\n​').replace(/\n/g, '\n> ')}`;
    }

    let assetURLPrefix = generatorConnectionAssetURLPrefix(projectUuid, connection_id);
    assetURLPrefix = `${assetURLPrefix}${detail._pk}/`;

    return (
      <ReplyEmail
        emailTo={[replySendTo.current || detail['email_from']]}
        initValue={initValue}
        onToggle={() => setIsShowReply(false)}
        onSubmit={onSubmit}
        isHtmlValue={isHTMLContent}
        assetURLPrefix={assetURLPrefix}
      />
    );
  }, [detail, isHTMLContent, detailContent, sender, projectUuid, connection_id, onSubmit]);

  const onLinkClick = useCallback((link) => {
    if (!link || !isString(link)) return;
    if (link.startsWith('mailto:')) {
      if (isPortal || isReadonly) return;
      const email = link.slice(7);
      openReplyByEmail(email);
      return;
    }
    window.open(link, '_blank', 'noopener,noreferrer');
  }, [openReplyByEmail, isPortal, isReadonly]);

  const renderParticipants = useCallback(() => {
    const isValidCc = Array.isArray(emailCc) && emailCc.length > 0;
    return (
      <div className={classnames('email-record-info-participants gap-1 mr-2', { 'cc-invalid': !isValidCc })}>
        <ParticipantsCategory category={gettext('To')} value={emailTo} isShowEmail={false} />
        {isValidCc && (
          <ParticipantsCategory category={gettext('Cc')} value={emailCc} isShowEmail={false} />
        )}
        <IconButton
          icon="arrow-down-b"
          className={classnames('d-inline-flex', { 'rotate-icon-180': isParticipantsExpanded })}
          aria-label={isParticipantsExpanded ? gettext('Collapse') : gettext('Expand')}
          aria-expanded={isParticipantsExpanded}
          onClick={toggleParticipantsExpanded}
        />
      </div>
    );
  }, [emailTo, emailCc, isParticipantsExpanded, toggleParticipantsExpanded]);

  const renderParticipantsDetails = useCallback(() => {
    if (!isParticipantsExpanded) return null;
    return (
      <div className="email-record-info-participants-details-container w-100 d-flex flex-column gap-1 mt-1">
        <ParticipantsCategory category={gettext('From')} value={[detail['email_from']]} isShowEmail={true} />
        <ParticipantsCategory category={gettext('To')} value={emailTo} isShowEmail={true} />
        {Array.isArray(emailCc) && emailCc.length > 0 && (
          <ParticipantsCategory category={gettext('Cc')} value={emailCc} isShowEmail={true} />
        )}
      </div>
    );
  }, [isParticipantsExpanded, detail, emailTo, emailCc]);

  useEffect(() => {
    if (!isExpanded || isShowReply) return;
    let timer = null;
    if (HTMLContent) {
      addQuoteToggleBtn();
    } else {
      timer = setTimeout(() => {
        addQuoteToggleBtn();
        timer = null;
      });
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isExpanded, HTMLContent, isShowReply, addQuoteToggleBtn]);

  useEffect(() => {
    if (!isLast) return;
    setIsLastExpanded(isExpanded);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLast, isExpanded]);

  useEffect(() => {
    if (isShowReply) return;
    replySendTo.current = '';
  }, [isShowReply]);

  useEffect(() => {
    if (!expandedRef.current) return;
    expandedRef.current.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
  }, []);

  if (!isExpanded || isShowReply) {
    return (
      <>
        <div
          className={classnames('seaqa-connection-email-record-details collapsed', { 'seaqa-connection-resource-highlight': detail.highlight })}
          onClick={openExpanded}
        >
          <div className="email-avatar">
            <img alt='' src={`${mediaUrl}avatars/default.png`}/>
          </div>
          <div className="email-record-info">
            <div className="email-record-info-container">
              <span className="email-record-info-sender text-truncate" title={detail['email_from']}>{sender}</span>
              <span className="email-record-info-content text-truncate" title={contentStart}>{contentStart}</span>
              {isUnread && <div className="read-status unread" />}
              <DateFormatter value={detail.modified_time} className="email-record-info-time" />
            </div>
            <div className="email-record-info-participants-container gap-1">
              {renderParticipants()}
              {!isReadonly && !isPortal && !isShowReply && (
                <IconTextBtn icon="reply" color="default" text={gettext('Reply')} className="h-5" onClick={openReply} />
              )}
            </div>
            {renderParticipantsDetails()}
          </div>
        </div>
        {isShowReply && (<>{renderReply()}</>)}
      </>
    );
  }

  return (
    <div
      className={classnames('seaqa-connection-email-record-details expanded', { 'seaqa-connection-resource-highlight': detail.highlight })}
      ref={expandedRef}
    >
      <div className="email-header" onClick={closeExpanded}>
        <div className="email-avatar">
          <img alt='' src={`${mediaUrl}avatars/default.png`}/>
        </div>
        <div className="email-record-info">
          <div className="email-record-info-container">
            <span className="email-record-info-sender text-truncate" title={detail['email_from']}>{sender}</span>
            <span className="email-record-info-content text-truncate"></span>
            <DateFormatter value={detail.modified_time} className="email-record-info-time" />
          </div>
          <div className="email-record-info-participants-container gap-1">
            {renderParticipants()}
            {!isReadonly && !isPortal && (
              <IconTooltip
                className={classnames('email-record-read-status-wrapper', { disabled: isReadonly || isUpdatingUnread })}
                placement="bottom"
                icon=""
                hoverBackground={true}
                tip={isUnread ? gettext('Mark Read') : gettext('Mark unread')}
                onClick={toggleUnread}
              >
                <div className={classnames('read-status', { unread: isUnread })}/>
              </IconTooltip>
            )}
            {!isReadonly && !isPortal && !isShowReply && (
              <IconTextBtn icon="reply" color="default" text={gettext('Reply')} className="h-5" onClick={openReply} />
            )}
          </div>
          {renderParticipantsDetails()}
        </div>
      </div>
      <div className="email-body" ref={ref}>
        {isHTMLContent ? (
          <HTMLContentWrapper
            projectUuid={projectUuid}
            connectionId={connection_id}
            recordId={detail._pk}
            threadId={threadId}
            isPortal={isPortal}
            detail={detail}
            value={detailContent}
            isReadonly={isReadonly}
            className="email-content-detail"
            openReplyByEmail={isPortal || isReadonly ? () => {} : openReplyByEmail}
          />
        ) : (
          <CustomizeMarkdownViewer value={detailContent} onLinkClick={onLinkClick} />
        )}
      </div>
    </div>
  );
};

export default Item;
