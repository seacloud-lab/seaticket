import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { LongTextInlineEditor, EventBus, EXTERNAL_EVENTS } from '@seafile/seafile-editor';
import { Button, Input, Label } from 'reactstrap';
import classnames from 'classnames';
import { name, avatarURL, username, gettext, lang, LONG_TEXT_EXCEED_LIMIT_MESSAGE } from '@/constants';
import { isLongTextValueExceedLimit } from '@/utils/long-text';
import { toaster } from '@/components';
import { KNOWLEDGE_PAGE_SLUG_ID } from '../../constants';
import { Utils } from '../../../../../utils/utils';
import { knowledgeBaseAPI } from '../../../../api';
import { useKnowledgePage } from '../../hooks/knowledge-page';
import UploadFilesButton from '../../../tickets/components/upload-files-btn';

import './index.css';

const NewKnowledge = ({ editorAPI, projectUuid }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  const contentEditorRef = useRef(null);
  const knowledgeRef = useRef(null);

  const user = useMemo(() => {
    return {
      name,
      username,
      avatar_url: avatarURL
    };
  }, []);
  const disabled = useMemo(() => {
    return (!title || !title.trim()) || (!content || !content.text.trim()) || isSubmitting;
  }, [title, content, isSubmitting]);

  const { togglePageSlugId } = useKnowledgePage();

  const onTitleChange = useCallback((event) => {
    const newTitle = event.target.value;
    if (newTitle === title) return;
    setTitle(newTitle);
  }, [title]);

  const onContentChange = useCallback((value) => {
    if (isLongTextValueExceedLimit(value)) {
      toaster.closeAll();
      toaster.danger(LONG_TEXT_EXCEED_LIMIT_MESSAGE, { duration: null });
      return;
    }
    setContent(value);
  }, []);

  const handleFiles = useCallback((files) => {
    if (files.length === 0) return;
    const editor = contentEditorRef.current.getEditor();
    const eventBus = EventBus.getInstance();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImage = /image/i.test(file.type);
      const fileName = file.name;
      editorAPI.uploadLocalImage(file).then(url => {
        eventBus.dispatch(EXTERNAL_EVENTS.INSERT_ATTACHMENTS, editor, { title: fileName, url, isImage });
      });
    }
  }, [editorAPI]);

  const onSubmit = useCallback(() => {
    const validTitle = title.trim();
    const data = { question: validTitle, answer: content.text };
    knowledgeBaseAPI.createRecord(projectUuid, data).then(res => {
      togglePageSlugId(KNOWLEDGE_PAGE_SLUG_ID.ALL);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setIsSubmitting(false);
    });
  }, [title, content]);

  useEffect(() => {
    const knowledgeDom = knowledgeRef.current;
    const handleResize = () => {
      if (!knowledgeDom) return;
      setContainerWidth(knowledgeDom.offsetWidth);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    knowledgeDom && resizeObserver.observe(knowledgeDom);

    return () => {
      knowledgeDom && resizeObserver.unobserve(knowledgeDom);
    };
  }, []);

  const renderSubmitBtns = useCallback((className = 'ml-2') => {
    return (
      <div className={className}>
        <Button className="mr-4" onClick={() => togglePageSlugId(KNOWLEDGE_PAGE_SLUG_ID.ALL)}>{gettext('Cancel')}</Button>
        <Button onClick={onSubmit} color="primary" disabled={disabled}>{gettext('Submit')}</Button>
      </div>
    );
  }, [disabled, togglePageSlugId, onSubmit]);

  // 892: comment min-width(584) + others min-width(260) + gap: 16 * 3
  const isSmallScreen = containerWidth < 892;

  return (
    <div className={classnames('sea-qa-project-new-knowledge', { 'small': isSmallScreen })} ref={knowledgeRef}>
      {!isSmallScreen && (
        <div className="sea-qa-project-knowledge-user">
          <img src={user.avatar_url} alt={user.name} />
        </div>
      )}
      <div className="sea-qa-project-knowledge-settings">
        <div className="sea-qa-project-knowledge-name mb-3">{gettext('Add a knowledge')}</div>
        <div className="sea-qa-project-knowledge-settings-container">
          <div className="sea-qa-project-knowledge-content-settings">
            <div className="sea-qa-project-knowledge-title mb-4">
              <Label>
                {gettext('Question')}
                <span className="required-tip" title={gettext('Required')}>{'*'}</span>
              </Label>
              <Input autoFocus disabled={isSubmitting} value={title} onChange={onTitleChange} />
            </div>
            <div className="sea-qa-project-knowledge-content mb-4">
              <Label>
                {gettext('Answer')}
                <span className="required-tip" title={gettext('Required')}>{'*'}</span>
              </Label>
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
                editorApi={editorAPI}
                autoFocus={false}
                onSaveEditorValue={onContentChange}
              />
            </div>
            <div className="sea-qa-project-knowledge-footer">
              <UploadFilesButton onChange={handleFiles} />
              {!isSmallScreen && renderSubmitBtns()}
            </div>
          </div>
          <div className="sea-qa-project-knowledge-other-settings"></div>
          {isSmallScreen && renderSubmitBtns('sea-qa-project-knowledge-submit-btns')}
        </div>
      </div>
    </div>
  );

};

export default NewKnowledge;
