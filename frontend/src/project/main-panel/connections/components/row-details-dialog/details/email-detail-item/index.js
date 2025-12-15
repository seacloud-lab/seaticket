import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DateFormatter from '../../../cell-formatter/date-formatter';
import { gettext } from '@/constants';
import { CustomizeMarkdownViewer } from '@/components';
import HTMLContentWrapper from './html-content';

import './index.css';

const EmailDetailItem = ({ detail, assetURLPrefix }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const ref = useRef(null);

  const content = useMemo(() => detail.content || '', [detail.content]);
  const HTMLContent = useMemo(() => detail.html_content || '', [detail.html_content]);
  const isHTMLContent = useMemo(() => HTMLContent ? true : false, [HTMLContent]);

  const contentStart = useMemo(() => {
    const hrefReg = /\[.+\]\(\S+\)|<img( width=[\\|/]?"(\d)+[\\|/|]?")? src="(\S+)" .?\/>|!\[\]\(\S+\)|!\[\]\((\S+)\)|<\S+>/g;
    return content ? content.replace(hrefReg, '').replace('\n', ' ').substring(0, 150) : '';
  }, [content]);

  const detailContent = useMemo(() => {
    const value = isHTMLContent ? HTMLContent : content;
    // HTML Content contains '```' at begin and end
    return isHTMLContent ? value.trim().substring(3, value.length - 3) : value;
  }, [isHTMLContent, content, HTMLContent]);

  const addQuoteToggleBtn = useCallback(() => {
    const quotedEmails = ref.current.getElementsByTagName('blockquote');
    if (quotedEmails.length) {
      let qt = quotedEmails[0];
      let qtPrev = qt.previousElementSibling;
      // handle special case
      if (!qtPrev) {
        qt = quotedEmails[1];
        qtPrev = qt.previousElementSibling;
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

  if (!isExpanded) {
    return (
      <div className="sea-qa-connection-email-item" onClick={openExpanded}>
        <div className="email-subject">{detail['email_from']}</div>
        <div className="email-content">{contentStart}</div>
        <div className="email-time">
          <DateFormatter value={detail.modified_time} />
        </div>
      </div>
    );
  }

  return (
    <div className="sea-qa-connection-email-item sea-qa-connection-expand-email-item">
      <div className="email-header" onClick={() => setIsExpanded(false)}>
        <div className="email-from-to">
          <div className="email-message">{gettext('From')}: {detail['email_from']}</div>
          <div className="email-message">{gettext('To')}: {detail['email_to'].split(',').join(', ')}</div>
        </div>
        <div className="text-right flex-shrink-0 ml-1">
          <div className="email-message date">
            <DateFormatter value={detail.modified_time} />
            <span>{''}</span>
          </div>
        </div>
      </div>
      <div className="email-body" ref={ref}>
        {isHTMLContent ? (
          <HTMLContentWrapper assetURLPrefix={assetURLPrefix} value={detailContent} className="email-content-detail" />
        ) : (
          <CustomizeMarkdownViewer value={detailContent} />
        )}
      </div>
    </div>
  );
};

export default EmailDetailItem;
