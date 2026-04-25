import React, { useCallback, useMemo, useState, useRef } from 'react';
import { Button } from 'reactstrap';
import { gettext } from '@constants';
import { Loading, toaster, } from '@/components';
import LongTextEditorUtilities, { isLongTextValueExceedLimit } from '@/utils/long-text';
import { ticketsAPI } from '@/project/api/tickets-api';
import { server, lang, LONG_TEXT_EXCEED_LIMIT_MESSAGE, mediaUrl } from '@/constants';
import { LongTextInlineEditor } from '@seafile/seafile-editor';

import './index.css';

const { projectUuid } = window.app.pageOptions;

const ReplyDiscourse = ({ onToggle, onSubmit }) => {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const contentEditorRef = useRef(null);

  const ableSubmitting = useMemo(() => {
    return content.trim() && !isSubmitting;
  }, [content, isSubmitting]);

  const editorApi = useMemo(() => new LongTextEditorUtilities({ server, api: {
    uploadFile: (...params) => ticketsAPI.uploadFile(projectUuid, ...params)
  } }), []);

  const onContentChange = useCallback(({ text, preview }) => {
    if (isLongTextValueExceedLimit(preview)) {
      toaster.closeAll();
      toaster.danger(LONG_TEXT_EXCEED_LIMIT_MESSAGE, { duration: null });
      return;
    }
    setContent(text);
  }, []);

  const handleSubmit = useCallback(() => {
    if (content.length < 6) {
      toaster.danger(gettext('The content is too short, at least 6 characters.'));
      return;
    }
    setIsSubmitting(true);
    onSubmit({ content: content.trim() }, (error) => {
      if (error) {
        setIsSubmitting(false);
        return;
      }
      onToggle();
    });
  }, [content, onToggle, onSubmit]);

  return (
    <div className="sea-ticket-discourse-reply-container">
      <div className="author-info-wrapper">
        <div className="author-info-left">
          <div className="author-avatar">
            <img alt='' src={`${mediaUrl}avatars/default.png`}/>
          </div>
          <div className="author-name">{gettext('Add a reply')}</div>
        </div>
      </div>
      <div className="content-editor-wrapper">
        <LongTextInlineEditor
          isAlwaysEnableEdit={true}
          ref={contentEditorRef}
          lang={lang}
          headerName={gettext('Content')}
          value={content || ''}
          autoSave={true}
          saveDelay={20 * 1000}
          isCheckBrowser={true}
          isImageUploadOnly={false}
          isSupportMultipleFiles={true}
          editorApi={editorApi}
          autoFocus={false}
          onSaveEditorValue={onContentChange}
        />
      </div>
      <div className="sea-ticket-discourse-reply-op-btns">
        <Button color="secondary" onClick={onToggle}>{gettext('Cancel')}</Button>
        <Button color="primary" disabled={!ableSubmitting} onClick={handleSubmit}>
          {isSubmitting ? (<Loading />) : (<>{gettext('Submit')}</>)}
        </Button>
      </div>
    </div>
  );
};

export default ReplyDiscourse;
