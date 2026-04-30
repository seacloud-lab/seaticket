import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dayjs from '@/utils/dayjs';
import { gettext, mediaUrl, PERMISSION_TYPES } from '@/constants';
import { CustomizeMarkdownViewer, IconTextBtn, toaster } from '@/components';
import DateFormatter from '../../../cell-formatter/date-formatter';
import { generatorConnectionAssetURLPrefix, getInfoByEmailFrom } from '../../../../utils';
import HTMLContentWrapper from './html-content';
import ReplyEmail from './reply-email';
import { connectionsAPI } from '@/project/api';
import { Utils } from '@/utils/utils';
import { isString } from '@/utils/type-detection';

import './index.css';

const Item = ({ isLast, isExpand, detail, projectUuid, connection_id, setIsLastExpanded, recordId, permission, handleReplyEmailSuccess }) => {
  const [isExpanded, setIsExpanded] = useState(isExpand);
  const [isShowReply, setIsShowReply] = useState(false);

  const ref = useRef(null);
  const replySendTo = useRef('');

  const content = useMemo(() => detail.content || '', [detail.content]);
  const HTMLContent = useMemo(() => detail.html_content || '', [detail.html_content]);
  const isHTMLContent = useMemo(() => HTMLContent ? true : false, [HTMLContent]);
  const { sender, email } = useMemo(() => getInfoByEmailFrom(detail['email_from']), [detail]);
  const isReadonly = useMemo(() => permission === PERMISSION_TYPES.READ_ONLY, [permission]);

  const contentStart = useMemo(() => {
    const hrefReg = /\[.+\]\(\S+\)|<img( width=[\\|/]?"(\d)+[\\|/|]?")? src="(\S+)" .?\/>|!\[\]\(\S+\)|!\[\]\((\S+)\)|<\S+>/g;
    let value = content ? content.replace(hrefReg, '').replace('\n', ' ').substring(0, 150) : '';
    const emailText = email || '';
    const isGitLog = emailText.indexOf('github.com') > -1 || emailText.indexOf('gitlab') > -1;
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

  const emailTo = useMemo(() => detail['email_to']?.split(',')?.join(', '), [detail]);

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
      btn.className = 'sea-qa-icon-btn email-item-toggle-btn';
      btn.innerHTML = `<svg t="1751443664495" class="sea-qa-icon-svg" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="7016" xmlns:xlink="http://www.w3.org/1999/xlink" width="200" height="200">
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

  const openReply = useCallback((event) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    setIsShowReply(true);
  }, []);

  const openReplyByEmail = useCallback((sendTo = '') => {
    replySendTo.current = sendTo;
    setIsShowReply(true);
  }, []);

  const onSubmit = useCallback(({ to, cc, content }, callback) => {
    const payload = {
      html_content: content,
      to: to.join(','),
      cc: cc.join(','),
      email_id: detail._pk,
    };
    connectionsAPI.replyConnectionEmail(projectUuid, connection_id, payload).then((res) => {
      callback && callback();
      handleReplyEmailSuccess(res.data);
    }).catch((error) => {
      toaster.danger(Utils.getErrorMsg(error));
      callback && callback(true);
    });
  }, [projectUuid, connection_id, handleReplyEmailSuccess]);

  const renderReply = useCallback(() => {
    const sendTime = dayjs(detail.modified_time, 'YYYY-MM-DD HH:mm');
    let tip = gettext('On {day}, {date_year}, at {time}, {email_from} wrote:');
    tip = tip.replace('{day}', sendTime.format('ddd'))
      .replace('{date_year}', sendTime.format('ll'))
      .replace('{time}', sendTime.format('LT'))
      .replace('{email_from}', sender);

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
      initValue += `> ${detailContent.replace(/\n/g, '\n> ')}`;
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
      const email = link.slice(7);
      openReplyByEmail(email);
      return;
    }
    window.open(link, '_blank', 'noopener,noreferrer');
  }, [openReplyByEmail]);

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
  }, [isExpanded, isShowReply]);

  useEffect(() => {
    if (!isLast) return;
    setIsLastExpanded(isExpanded);
  }, [isLast, isExpanded]);

  useEffect(() => {
    if (isShowReply) return;
    replySendTo.current = '';
  }, [isShowReply]);

  if (!isExpanded || isShowReply) {
    return (
      <>
        <div className="sea-ticket-connection-email-record-details collapsed" onClick={openExpanded}>
          <div className="email-avatar">
            <img alt='' src={`${mediaUrl}avatars/default.png`}/>
          </div>
          <div className="email-record-info">
            <div className="email-record-info-container">
              <span className="email-record-info-sender text-truncate" title={sender}>{sender}</span>
              <span className="email-record-info-content text-truncate" title={contentStart}>{contentStart}</span>
              <DateFormatter value={detail.modified_time} className="email-record-info-time" />
            </div>
            <div className="email-record-info-to-container">
              <div className="email-record-info-to">
                {gettext('To')}: {emailTo}
              </div>
              {!isReadonly && !isShowReply && (
                <IconTextBtn icon="reply" color="default" text={gettext('Reply')} className="h-5" onClick={openReply} />
              )}
            </div>
          </div>
        </div>
        {isShowReply && (<>{renderReply()}</>)}
      </>
    );
  }

  return (
    <div className="sea-ticket-connection-email-record-details expanded">
      <div className="email-header" onClick={() => setIsExpanded(false)}>
        <div className="email-avatar">
          <img alt='' src={`${mediaUrl}avatars/default.png`}/>
        </div>
        <div className="email-record-info">
          <div className="email-record-info-container">
            <span className="email-record-info-sender text-truncate" title={detail['email_from']}>{detail['email_from']}</span>
            <span className="email-record-info-content text-truncate"></span>
            <DateFormatter value={detail.modified_time} className="email-record-info-time" />
          </div>
          <div className="email-record-info-to-container">
            <div className="email-record-info-to">
              {gettext('To')}: {emailTo}
            </div>
            {!isReadonly && !isShowReply && (
              <IconTextBtn icon="reply" color="default" text={gettext('Reply')} className="h-5" onClick={openReply} />
            )}
          </div>
        </div>
      </div>
      <div className="email-body" ref={ref}>
        {isHTMLContent ? (
          <HTMLContentWrapper
            projectUuid={projectUuid}
            connectionId={connection_id}
            recordId={detail._pk}
            detail={detail}
            value={detailContent}
            isReadonly={isReadonly}
            className="email-content-detail"
            openReplyByEmail={openReplyByEmail}
          />
        ) : (
          <CustomizeMarkdownViewer value={detailContent} onLinkClick={onLinkClick} />
        )}
      </div>
    </div>
  );
};

export default Item;
