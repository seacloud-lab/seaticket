import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SeaEmailEditor from '@seafile/sea-email-editor';
import { parseAndCleanHTML } from '@seafile/sea-email-editor/dist/utils/dom';
import { slateToHtml } from '@seafile/sea-email-editor/dist/slate-convert';
import { connectionsAPI } from '@/project/api';
import { CONNECTION_TYPE } from '@/project/main-panel/connections/constants';
import { initConnectionResourceDetails } from '@/project/main-panel/connections/utils';
import SendTo from '@/project/main-panel/connections/components/connection-resource-details/main/email-details/reply-email/send-to';
import { gettext } from '@/constants';
import {
  getDefaultEmailReplyTo,
  parseEmailSuggestionContent,
  serializeEmailSuggestionContent,
} from '@/project/main-panel/agent/utils';

import './index.css';

const { projectUuid } = window.app.pageOptions;

const EmailDetail = ({ isEdit, isSaving, value, sourceId, onChange }) => {
  const [draft, setDraft] = useState(() => parseEmailSuggestionContent(value));

  const [shouldLoadDefaultRecipient, setShouldLoadDefaultRecipient] = useState(false);
  const isReadonly = useMemo(() => !isEdit || isSaving, [isEdit, isSaving]);
  const safeHTML = useMemo(() => {
    if (!draft.isHtml || !draft.content) return '';
    return parseAndCleanHTML(draft.content).innerHTML;
  }, [draft.content, draft.isHtml]);

  // mdStringToSlate treats blank lines as paragraph separators and drops them,
  // so feed the editor per-line HTML to keep blank lines as empty paragraphs.
  const editorInitValue = useMemo(() => {
    if (draft.isHtml) return draft.content;
    return draft.content
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => {
        const escaped = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        return `<div>${escaped}</div>`;
      })
      .join('');
  }, [draft.content, draft.isHtml]);

  const emailEditorRef = useRef(null);

  // In edit mode the saved content must be HTML (is_html is forced to true), so always
  // serialize from the editor document; nextDraft.content may still be untouched plain text.
  const getEditorContent = useCallback((fallback) => {
    const editor = emailEditorRef.current?.getEditor?.();
    if (!editor) return fallback;
    return slateToHtml(editor.children);
  }, []);

  const emitChange = useCallback((nextDraft) => {
    const content = serializeEmailSuggestionContent({
      to: nextDraft.to,
      cc: nextDraft.cc,
      content: isEdit ? getEditorContent(nextDraft.content) : nextDraft.content,
      isHtml: isEdit ? true : nextDraft.isHtml,
    });
    onChange && onChange(content);
  }, [isEdit, onChange, getEditorContent]);

  const handleToChange = useCallback((to) => {
    setDraft((prev) => {
      const nextDraft = { ...prev, to };
      emitChange(nextDraft);
      return nextDraft;
    });
  }, [emitChange]);

  const handleCcChange = useCallback((cc) => {
    setDraft((prev) => {
      const nextDraft = { ...prev, cc };
      emitChange(nextDraft);
      return nextDraft;
    });
  }, [emitChange]);

  const handleContentChange = useCallback((content) => {
    setDraft((prev) => {
      const nextDraft = { ...prev, content };
      emitChange(nextDraft);
      return nextDraft;
    });
  }, [emitChange]);

  useEffect(() => {
    const parsed = parseEmailSuggestionContent(value);
    setDraft(parsed);
    setShouldLoadDefaultRecipient(!parsed.to.length);
  }, [value]);

  useEffect(() => {
    if (!shouldLoadDefaultRecipient || !sourceId) return;
    const sourceInfo = String(sourceId).split('_');
    if (sourceInfo.length !== 2) return;
    const connectionId = Number(sourceInfo[0]);
    const recordId = Number(sourceInfo[1]);
    if (!Number.isInteger(connectionId) || !Number.isInteger(recordId)) return;

    let isCanceled = false;
    connectionsAPI.getConnectionRecord(projectUuid, connectionId, recordId).then((res) => {
      if (isCanceled) return;
      const emails = initConnectionResourceDetails(CONNECTION_TYPE.EMAIL, res.data?.record || {});
      const defaultTo = getDefaultEmailReplyTo(emails);
      if (!defaultTo) return;

      setDraft((prev) => {
        if (prev.to.length > 0) return prev;
        const nextDraft = { ...prev, to: [defaultTo] };
        if (isEdit) emitChange(nextDraft);
        return nextDraft;
      });
    }).catch(() => {});

    return () => {
      isCanceled = true;
    };
  }, [emitChange, isEdit, shouldLoadDefaultRecipient, sourceId]);

  return (
    <div className="seaqa-email-suggestion-detail">
      <div className="seaqa-email-suggestion-detail-title">
        {gettext('Draft')}
      </div>
      <div className="seaqa-email-suggestion-detail-body">
        <div className="seaqa-email-suggestion-detail-line">
          <div className="seaqa-email-suggestion-detail-label">{gettext('To')}</div>
          <SendTo value={draft.to} readonly={isReadonly} onChange={handleToChange} />
        </div>
        <div className="seaqa-email-suggestion-detail-line">
          <div className="seaqa-email-suggestion-detail-label">{gettext('Cc')}</div>
          <SendTo value={draft.cc} readonly={isReadonly} onChange={handleCcChange} />
        </div>
        {isReadonly ? (
          <div className="seaqa-email-suggestion-detail-content">
            {draft.isHtml ? (
              <div dangerouslySetInnerHTML={{ __html: safeHTML }} />
            ) : (
              draft.content
            )}
          </div>
        ) : (
          <SeaEmailEditor
            ref={emailEditorRef}
            value={editorInitValue}
            isHtmlValue={true}
            onChange={handleContentChange}
          />
        )}
      </div>
    </div>
  );
};

export default EmailDetail;
