import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { gettext, mediaUrl } from '@/constants';
import { CustomizeMarkdownViewer } from '@/components';
import DateFormatter from '../../cell-formatter/date-formatter';
import { getInfoByEmailFrom } from '../../../utils';
import HTMLContentWrapper from './html-content';

import './index.css';

const Item = ({ isLast, isExpand, detail, projectUuid, connection_id, setIsLastExpanded }) => {
  const [isExpanded, setIsExpanded] = useState(isExpand);

  const ref = useRef(null);

  const content = useMemo(() => detail.content || '', [detail.content]);
  const HTMLContent = useMemo(() => detail.html_content || '', [detail.html_content]);
  const isHTMLContent = useMemo(() => HTMLContent ? true : false, [HTMLContent]);
  const { sender, email } = useMemo(() => getInfoByEmailFrom(detail['email_from']), [detail]);

  const contentStart = useMemo(() => {
    const hrefReg = /\[.+\]\(\S+\)|<img( width=[\\|/]?"(\d)+[\\|/|]?")? src="(\S+)" .?\/>|!\[\]\(\S+\)|!\[\]\((\S+)\)|<\S+>/g;
    let value = content ? content.replace(hrefReg, '').replace('\n', ' ').substring(0, 150) : '';
    const isGitLog = email.indexOf('github.com') > -1 || email.indexOf('gitlab') > -1;
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

  useEffect(() => {
    if (!isExpanded) return;
    if (HTMLContent) {
      addQuoteToggleBtn();
    } else {
      setTimeout(() => {
        addQuoteToggleBtn();
      });
    }
  }, [isExpanded]);

  useEffect(() => {
    if (!isLast) return;
    setIsLastExpanded(isExpanded);
  }, [isLast, isExpanded]);

  if (!isExpanded) {
    return (
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
          <div className="email-record-info-to" title={emailTo}>
            {gettext('To')}: {emailTo}
          </div>
        </div>
      </div>
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
          <div className="email-record-info-to" title={emailTo}>
            {gettext('To')}: {emailTo}
          </div>
        </div>
      </div>
      <div className="email-body" ref={ref}>
        {isHTMLContent ? (
          <HTMLContentWrapper projectUuid={projectUuid} connection_id={connection_id} detail={detail} value={detailContent} className="email-content-detail" />
        ) : (
          <CustomizeMarkdownViewer value={detailContent} />
        )}
      </div>
    </div>
  );
};

export default Item;
