import React, { useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import ReplyTo from '@/project/main-panel/connections/components/connection-resource-details/main/email-details/reply-email/reply-to';
import { parseEmailReplySuggestion } from '../../../../../../../utils';

import './index.css';

const EmailPreview = ({ value, defaultReplyTo }) => {
  const [displayMask, setDisplayMask] = useState(false);
  const previewRef = useRef(null);
  const { to, cc, content } = useMemo(() => parseEmailReplySuggestion(value, defaultReplyTo), [value, defaultReplyTo]);

  useEffect(() => {
    const dom = previewRef.current;
    if (!dom) return;
    setDisplayMask(dom.scrollHeight > dom.clientHeight);
  }, [content]);

  return (
    <div className="suggestion-content-preview-wrapper email">
      <div className={classnames('suggestion-content-preview', { 'display-mask': displayMask })} ref={previewRef}>
        <ReplyTo title={gettext('To')} size="s" value={to} readonly={true} className="pt-0 pb-1 border-0" />
        <ReplyTo title={gettext('Cc')} size="s" value={cc} readonly={true} className="pt-1 pb-2"/>
        <div className="suggestion-email-preview-content pt-3">
          {content}
        </div>
      </div>
    </div>
  );
};

export default EmailPreview;
