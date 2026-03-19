import React, { useCallback, useMemo, useRef, useState } from 'react';
import { LongTextInlineEditor, EventBus, EXTERNAL_EVENTS } from '@seafile/seafile-editor';
import { Button } from 'reactstrap';
import { gettext, lang, name, username, avatarURL } from '@/constants';
import { isLongTextValueExceedLimit } from '@/utils/long-text';
import { toaster } from '@/components';
import { LONG_TEXT_EXCEED_LIMIT_MESSAGE } from '@/constants';
import { connectionsAPI } from '@/project/api';
import { Utils } from '@/utils/utils';

import './index.css';

const GitHubCommentEditor = ({
  projectUuid,
  connectionId,
  recordId,
  onChange,
}) => {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const contentEditorRef = useRef(null);

  const user = useMemo(() => {
    return {
      name,
      email: username,
      avatar_url: avatarURL
    };
  }, []);

  const isValid = useMemo(() => {
    if (!content) return false;
    return Boolean(content.text);
  }, [content]);

  const onContentChange = useCallback((value) => {
    if (isLongTextValueExceedLimit(value)) {
      toaster.closeAll();
      toaster.danger(LONG_TEXT_EXCEED_LIMIT_MESSAGE, { duration: null });
      return;
    }
    setContent(value);
  }, []);

  const onSubmit = useCallback(() => {
    if (!content || isSubmitting) return;
    setIsSubmitting(true);
    connectionsAPI.createGithubIssueComment(projectUuid, connectionId, recordId, content.text).then((res) => {
      const editor = contentEditorRef.current.getEditor();
      const eventBus = EventBus.getInstance();
      eventBus.dispatch(EXTERNAL_EVENTS.CLEAR_ARTICLE, editor);
      const comment = res?.data?.comment;
      onChange && onChange(comment);
      setIsSubmitting(false);
    }).catch((error) => {
      const errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
      setIsSubmitting(false);
    });
  }, [content, projectUuid, connectionId, recordId, onChange]);

  return (
    <div className="sea-ticket-github-comment-editor">
      <div className="sea-ticket-github-comment-user-avatar">
        <img src={user.avatar_url} alt={user.name} />
      </div>
      <div className="sea-ticket-github-comment-container">
        <div className="sea-ticket-github-comment-title">
          {gettext('Add a comment')}
        </div>
        <div className="sea-ticket-github-comment-content">
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
            autoFocus={false}
            onSaveEditorValue={onContentChange}
          />
        </div>
        <div className="sea-ticket-github-comment-content-ops">
          <Button color="primary" onClick={onSubmit} disabled={isSubmitting || !isValid}>
            {gettext('Comment')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GitHubCommentEditor;
