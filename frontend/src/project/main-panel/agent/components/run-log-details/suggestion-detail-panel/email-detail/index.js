import React, { useCallback, useEffect, useMemo, useState } from 'react';
import classnames from 'classnames';
import SeaEmailEditor from '@seafile/sea-email-editor';
import { gettext } from '@/constants';
import ReplyTo from '@/project/main-panel/connections/components/connection-resource-details/main/email-details/reply-email/reply-to';
import { parseEmailReplySuggestion, sanitizeEmailHtml } from '../../../../utils';

import './index.css';

const serializeDraft = (draft) => JSON.stringify({
  to: draft.to || [],
  cc: draft.cc || [],
  content: draft.content || '',
  is_html: Boolean(draft.is_html),
});

const escapeHtml = (text) => String(text)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const plainTextToEmailHtml = (text) => {
  const normalized = String(text || '').replace(/\r\n/g, '\n');
  if (!normalized) return '<p><br></p>';
  return normalized
    .split('\n')
    .map(line => `<p>${line ? escapeHtml(line) : '<br>'}</p>`)
    .join('');
};

const EmailDetail = ({ isEdit, isSaving, value, defaultReplyTo, onChange }) => {
  const initDraft = useMemo(
    () => parseEmailReplySuggestion(value, defaultReplyTo),
    [value, defaultReplyTo]
  );
  const [draft, setDraft] = useState(initDraft);
  const isReadonly = useMemo(() => !isEdit || isSaving, [isEdit, isSaving]);
  const editorValue = useMemo(() => (
    draft.is_html ? draft.content : plainTextToEmailHtml(draft.content)
  ), [draft.content, draft.is_html]);
  const safeHtmlContent = useMemo(
    () => (draft.is_html ? sanitizeEmailHtml(draft.content) : draft.content),
    [draft.content, draft.is_html]
  );

  const emitChange = useCallback((nextDraft) => {
    setDraft(nextDraft);
    onChange && onChange(serializeDraft(nextDraft));
  }, [onChange]);

  const handleRecipientsChange = useCallback((field, emails) => {
    emitChange({ ...draft, [field]: emails });
  }, [draft, emitChange]);

  const handleContentChange = useCallback((nextContent) => {
    if (nextContent === draft.content) return;
    emitChange({
      ...draft,
      content: nextContent,
      is_html: true,
    });
  }, [draft, emitChange]);

  useEffect(() => {
    setDraft(parseEmailReplySuggestion(value, defaultReplyTo));
  }, [value, defaultReplyTo]);

  return (
    <div className="seaqa-email-reply-suggestion-detail">
      <div className="seaqa-email-reply-to-container">
        <ReplyTo
          title={gettext('To')}
          value={draft.to}
          readonly={isReadonly}
          onChange={(emails) => handleRecipientsChange('to', emails)}
        />
        <ReplyTo
          title={gettext('Cc')}
          value={draft.cc}
          readonly={isReadonly}
          onChange={(emails) => handleRecipientsChange('cc', emails)}
        />
      </div>
      {isEdit ? (
        <SeaEmailEditor
          value={editorValue}
          isHtmlValue={true}
          onChange={handleContentChange}
        />
      ) : (
        <div className={classnames('seaqa-email-reply-suggestion-content', { 'is-html': draft.is_html })}>
          {draft.is_html ? (
            <div dangerouslySetInnerHTML={{ __html: safeHtmlContent }} />
          ) : (
            safeHtmlContent
          )}
        </div>
      )}
    </div>
  );
};

export default EmailDetail;
