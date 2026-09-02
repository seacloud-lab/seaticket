import React, { useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { parseEmailReplySuggestion } from '../../../../../../../utils';

import './index.css';

const RecipientRow = ({ title, emails }) => {
  return (
    <div className="suggestion-email-preview-row">
      <div className="suggestion-email-preview-label">{title}</div>
      <div className="suggestion-email-preview-tags">
        {emails.map(email => (
          <div className="suggestion-email-preview-tag text-truncate" title={email} key={email}>
            {email}
          </div>
        ))}
      </div>
    </div>
  );
};

const EmailPreview = ({ value, defaultReplyTo }) => {
  const [displayMask, setDisplayMask] = useState(false);
  const previewRef = useRef(null);
  const { to, cc, content, is_html } = useMemo(
    () => parseEmailReplySuggestion(value, defaultReplyTo),
    [value, defaultReplyTo]
  );

  useEffect(() => {
    const dom = previewRef.current;
    if (!dom) return;
    setDisplayMask(dom.scrollHeight > dom.clientHeight);
  }, [content]);

  return (
    <div className="suggestion-email-preview-wrapper">
      <div className="suggestion-email-preview-recipients">
        <RecipientRow title={gettext('To')} emails={to} />
        <RecipientRow title={gettext('Cc')} emails={cc} />
      </div>
      <div
        ref={previewRef}
        className={classnames('suggestion-email-preview-content', {
          'is-html': is_html,
          'display-mask': displayMask,
        })}
      >
        {is_html ? (
          <div dangerouslySetInnerHTML={{ __html: content }} />
        ) : (
          content
        )}
      </div>
    </div>
  );
};

export default EmailPreview;
