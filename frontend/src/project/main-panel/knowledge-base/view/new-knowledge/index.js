import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { LongTextInlineEditor, EventBus, EXTERNAL_EVENTS } from '@seafile/seafile-editor';
import { Button, Input, Label } from 'reactstrap';
import classnames from 'classnames';
import { name, avatarURL, username, gettext, lang, LONG_TEXT_EXCEED_LIMIT_MESSAGE } from '@/constants';
import { isLongTextValueExceedLimit } from '@/utils/long-text';
import { toaster } from '@/components';
import { KNOWLEDGE_PAGE_SLUG_ID } from '../../constants';
import { Utils } from '@/utils/utils';
import { knowledgeBaseAPI } from '@/project/api';
import { useKnowledgePage } from '../../hooks/knowledge-page';
import UploadFilesButton from '../../../tickets/components/upload-files-btn';

import './index.css';

const NewKnowledge = ({ editorAPI, projectUuid }) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
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
    return (!question || !question.trim()) || (!answer || !answer.text.trim()) || isSubmitting;
  }, [question, answer, isSubmitting]);

  const { togglePageSlugId } = useKnowledgePage();

  const onQuestionChange = useCallback((event) => {
    const newQuestion = event.target.value;
    if (newQuestion === question) return;
    setQuestion(newQuestion);
  }, [question]);

  const onAnswerChange = useCallback((value) => {
    if (isLongTextValueExceedLimit(value)) {
      toaster.closeAll();
      toaster.danger(LONG_TEXT_EXCEED_LIMIT_MESSAGE, { duration: null });
      return;
    }
    setAnswer(value);
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
    const validQuestion = question.trim();
    const data = { question: validQuestion, answer: answer.text };
    knowledgeBaseAPI.createRecord(projectUuid, data).then(res => {
      togglePageSlugId(KNOWLEDGE_PAGE_SLUG_ID.ALL);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setIsSubmitting(false);
    });
  }, [question, answer]);

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

  // 616: comment min-width(584) + gap: 16 * 2
  const isSmallScreen = containerWidth < 616;

  return (
    <div className={classnames('sea-qa-project-new-knowledge', { 'small': isSmallScreen })} ref={knowledgeRef}>
      {!isSmallScreen && (
        <div className="sea-qa-project-knowledge-user">
          <img src={user.avatar_url} alt={user.name} />
        </div>
      )}
      <div className="sea-qa-project-knowledge-settings">
        <div className="sea-qa-project-knowledge-name mb-3">{gettext('New knowledge')}</div>
        <div className="sea-qa-project-knowledge-settings-container">
          <div className="sea-qa-project-knowledge-content-settings">
            <div className="sea-qa-project-knowledge-title mb-4">
              <Label>
                {gettext('Question')}
                <span className="required-tip" title={gettext('Required')}>{'*'}</span>
              </Label>
              <Input autoFocus disabled={isSubmitting} value={question} onChange={onQuestionChange} />
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
                headerName={gettext('Answer')}
                value={answer || ''}
                autoSave={true}
                saveDelay={20 * 1000}
                isCheckBrowser={true}
                isImageUploadOnly={false}
                isSupportMultipleFiles={true}
                editorApi={editorAPI}
                autoFocus={false}
                onSaveEditorValue={onAnswerChange}
              />
            </div>
            <div className="sea-qa-project-knowledge-footer">
              <UploadFilesButton onChange={handleFiles} />
              {!isSmallScreen && renderSubmitBtns()}
            </div>
          </div>
          {isSmallScreen && renderSubmitBtns('sea-qa-project-knowledge-submit-btns')}
        </div>
      </div>
    </div>
  );

};

export default NewKnowledge;
